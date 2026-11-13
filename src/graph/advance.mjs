import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { projectFile, readJson, readProjectFile } from './storage.mjs';
import { dependencyIds, nodeById } from './task-graph.mjs';
import { taskInput, taskToken } from './workflow.mjs';
import { executeCheck, needsExecution, receiptTail } from './verification.mjs';

// begin/complete wrap the 5.3.0 commands (status, start, verify, record, reset) so a node
// costs two model calls instead of start → result JSON → verify → record. Every rule of
// those commands still applies, because they still run.

export const VERDICTS = ['pass', 'fix', 'human', 'replan'];
const BRIEF_TEXT = 360;

const clip = (text, size) => (text.length > size ? `${text.slice(0, size - 1)}…` : text);
const clipEnd = (text, size) => (text.length > size ? `…${text.slice(-(size - 1))}` : text);

// Notes elsewhere in a git repository are untracked code to the snapshot: they would make the
// review stale. .ai-workflow/evidence is outside the snapshot.
export const NOTES_DIR = '.ai-workflow/evidence/';
export function assertNotesPath(file) {
  if (file !== undefined && !path.posix.normalize(file).startsWith(NOTES_DIR)) {
    throw new Error(`Write review notes under ${NOTES_DIR} (for example ${NOTES_DIR}review-1.md); a notes file elsewhere changes the code snapshot and makes the review stale.`);
  }
}

function outItems(text) {
  const body = text.match(/^##\s+OUT\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im)?.[1] ?? '';
  return [...body.matchAll(/^[-*]\s+(.+)$/gm)].map(match => match[1].trim());
}

/** Start a ready node, or re-read a running one, and return a compact brief. */
export async function begin({ root, runFile, nodeId, call, beforeStart }) {
  const state = await call(['status', runFile]);
  let started;
  if (state.running.includes(nodeId)) started = taskInput(await readJson(root, runFile), nodeId);
  else {
    const ready = state.ready.find(node => node.id === nodeId);
    if (!ready) {
      const hint = state.action === 'stale' ? ` Code changed since ${state.stale.join(', ')} began; reset: graph.mjs reset ${runFile} <node> "<reason>".` : '';
      throw new Error(`Node is not ready: ${nodeId} (action: ${state.action}).${hint}`);
    }
    await beforeStart?.(ready);
    ({ started } = await call(['start', runFile, nodeId, ready.token]));
  }
  const story = await readProjectFile(root, started.input.story);
  const failure = started.input.messages.filter(message => message.event === 'failure' || message.event === 'feedback').at(-1);
  const feedback = failure?.feedback ?? failure?.summary;
  return {
    node: nodeId,
    covers: started.covers,
    area: clip([started.description, ...outItems(story).map(item => `OUT: ${item}`)].join(' | '), BRIEF_TEXT),
    checks: (started.input.verification?.checks ?? []).map(check => check.id),
    token: started.token,
    // A check failure ends in its most useful lines; review notes start with theirs.
    ...(feedback ? { feedback: (feedback.startsWith('Check ') ? clipEnd : clip)(feedback, BRIEF_TEXT), feedbackFile: (failure.output?.evidence ?? failure.evidence)?.[0] } : {}),
  };
}

/** Write nodes a failed node sends its fix to: itself, or the nearest write nodes it depends on. */
function fixTargets(graph, nodeId) {
  const node = nodeById(graph, nodeId);
  if (node.access !== 'read') return [nodeId];
  const targets = [];
  const visit = id => {
    for (const dependency of dependencyIds(graph, id)) {
      if (nodeById(graph, dependency).access !== 'read') { if (!targets.includes(dependency)) targets.push(dependency); }
      else visit(dependency);
    }
  };
  visit(nodeId);
  return targets;
}

async function writeEvidence(root, runId, name, text) {
  const file = `.ai-workflow/evidence/${runId}/complete/${name}`;
  await fs.mkdir(path.dirname(await projectFile(root, file)), { recursive: true, mode: 0o700 });
  await fs.writeFile(await projectFile(root, file), text, { flag: 'wx', mode: 0o600 });
  return file;
}

/** Run a node's checks, record its result and route the next step. */
export async function complete({ root, runFile, nodeId, verdict, notesFile, call, loadRun, snapshot, indexReceipt, reuseReceipt }) {
  if (verdict !== undefined && !VERDICTS.includes(verdict)) throw new Error(`--verdict must be one of ${VERDICTS.join(', ')}.`);
  assertNotesPath(notesFile);
  const run = await loadRun();
  const node = nodeById(run.graph, nodeId);
  if (run.state.nodes[nodeId].status !== 'running') throw new Error(`Node is not running: ${nodeId}. Start it with: graph.mjs begin ${runFile} ${nodeId}`);
  const verifies = needsExecution(run, nodeId);
  const reviews = node.access === 'read' && !verifies;
  if (reviews && !verdict) throw new Error('Review nodes need --verdict pass|fix|human|replan, and --notes <file> with the findings.');
  const notes = notesFile ? (await readProjectFile(root, notesFile)).trim() : '';
  if (verdict && verdict !== 'pass' && !notes) throw new Error('Failed evaluation needs feedback: pass --notes <file> with the findings.');
  const fixes = run.history.filter(entry => entry.event === 'record' && entry.nodeId === nodeId && entry.result?.evaluation?.action === 'fix').length;
  if (reviews && verdict === 'fix' && fixes >= 1) {
    throw new Error('One review round per run: record --verdict pass and list the remaining findings in --notes (they go to the G4 summary as unverified), or use --verdict human for a blocking problem.');
  }
  // Only a pass is refused on changed code; a fix, human or replan result is still recorded.
  const wantsPass = (verdict ?? 'pass') === 'pass';
  const state = await call(['status', runFile]);
  if (wantsPass && state.action === 'stale' && state.stale.includes(nodeId)) {
    throw new Error(`Code changed since ${nodeId} began; its result is stale. Reset it: graph.mjs reset ${runFile} ${nodeId} "<reason>", then begin again.`);
  }

  const token = taskToken(run, nodeId);
  const checks = (run.verification?.value.checks ?? []).filter(check => check.covers.some(id => node.covers.includes(id)));
  const receipts = [];
  let failing;
  if (!reviews && wantsPass) {
    for (const check of checks) {
      let receipt;
      let file;
      if (verifies) {
        const result = await call(['verify', runFile, nodeId, token, check.id]);
        receipt = result.verification;
        file = receipt.receipt;
      } else {
        const before = (await snapshot(run)).fingerprint;
        const reused = await reuseReceipt?.(run, check, before);
        if (reused) ({ receipt, file } = reused);
        else {
          ({ receipt, file } = await executeCheck({ root, run, nodeId, token, check, snapshotBefore: before, snapshot }));
          if (receipt.passed) await indexReceipt?.(check, receipt, file);
        }
      }
      receipts.push(file);
      if (!receipt.passed) {
        failing = { check: check.id, tail: await receiptTail(root, receipt) };
        break;
      }
    }
  }

  const passed = !failing && (verdict ?? 'pass') === 'pass';
  const action = failing ? 'fix' : verdict;
  const feedback = failing ? `Check ${failing.check} failed:\n${failing.tail}` : notes;
  const label = `${nodeId}-${run.state.nodes[nodeId].attempts}-${randomUUID().slice(0, 8)}`;
  const summary = notes.split('\n').find(line => line.trim())?.trim() ?? `${nodeId} ${passed ? 'passed' : 'failed'} (recorded by complete)`;
  const notesEvidence = await writeEvidence(root, run.runId, `${label}.md`,
    `${summary}\n\n${notes || (failing ? feedback : 'No notes.')}\n`);
  const resultFile = await writeEvidence(root, run.runId, `${label}.json`, JSON.stringify({
    token,
    output: { summary: clip(summary, 200), evidence: [notesEvidence, ...receipts] },
    evaluation: passed ? { passed: true } : { passed: false, action, feedback },
  }));
  await call(['record', runFile, nodeId, resultFile]);

  let note;
  if (!passed && action === 'fix') {
    for (const target of fixTargets(run.graph, nodeId)) {
      try { await call(['reset', runFile, target, clip(`fix from ${nodeId}: ${feedback}`, 300)]); }
      catch (error) { note = error.message; break; }
    }
  }
  const after = await call(['status', runFile]);
  // Begin the next node here: one call fewer per node, and its brief is what the host needs next.
  const nextId = after.running.length === 0 ? after.ready[0]?.id : undefined;
  const brief = nextId ? await begin({ root, runFile, nodeId: nextId, call }) : undefined;
  return {
    node: nodeId,
    status: passed ? 'completed' : 'failed',
    next: nextId ?? after.ready[0]?.id ?? after.action,
    ...(brief ? { brief } : {}),
    ...(failing ? { failing: { check: failing.check, tail: clipEnd(failing.tail, 600) } } : {}),
    ...(note ? { note: clip(note, 200) } : {}),
  };
}

