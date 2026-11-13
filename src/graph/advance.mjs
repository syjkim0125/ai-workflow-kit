import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { projectFile, readProjectFile } from './storage.mjs';
import { dependencyIds, nodeById } from './task-graph.mjs';
import { taskToken } from './workflow.mjs';
import { executeCheck, needsExecution, receiptTail } from './verification.mjs';

// begin/complete wrap the 5.3.0 commands (status, start, verify, record, reset) so a node
// costs two model calls instead of start → result JSON → verify → record. Every rule of
// those commands still applies, because they still run.

export const VERDICTS = ['pass', 'fix', 'human', 'replan'];
const BRIEF_TEXT = 360;

const clip = (text, size) => (text.length > size ? `${text.slice(0, size - 1)}…` : text);

function outItems(text) {
  const body = text.match(/^##\s+OUT\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im)?.[1] ?? '';
  return [...body.matchAll(/^[-*]\s+(.+)$/gm)].map(match => match[1].trim());
}

/** Start a ready node and return a compact brief. */
export async function begin({ root, runFile, nodeId, call, beforeStart }) {
  const state = await call(['status', runFile]);
  const ready = state.ready.find(node => node.id === nodeId);
  if (!ready) {
    const hint = state.action === 'stale' ? ` Code changed since ${state.stale.join(', ')} began; reset: graph.mjs reset ${runFile} <node> "<reason>".` : '';
    throw new Error(`Node is not ready: ${nodeId} (action: ${state.action}).${hint}`);
  }
  await beforeStart?.(ready);
  const { started } = await call(['start', runFile, nodeId, ready.token]);
  const story = await readProjectFile(root, started.input.story);
  const failure = started.input.messages.filter(message => message.event === 'failure' || message.event === 'feedback').at(-1);
  const feedback = failure?.feedback ?? failure?.summary;
  return {
    node: nodeId,
    covers: started.covers,
    area: clip([started.description, ...outItems(story).map(item => `OUT: ${item}`)].join(' | '), BRIEF_TEXT),
    checks: (started.input.verification?.checks ?? []).map(check => check.id),
    token: started.token,
    ...(feedback ? { feedback: clip(feedback, BRIEF_TEXT), feedbackFile: (failure.output?.evidence ?? failure.evidence)?.[0] } : {}),
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
  const run = await loadRun();
  const node = nodeById(run.graph, nodeId);
  if (run.state.nodes[nodeId].status !== 'running') throw new Error(`Node is not running: ${nodeId}. Start it with: graph.mjs begin ${runFile} ${nodeId}`);
  const verifies = needsExecution(run, nodeId);
  const reviews = node.access === 'read' && !verifies;
  if (reviews && !verdict) throw new Error('Review nodes need --verdict pass|fix|human|replan, and --notes <file> with the findings.');
  const notes = notesFile ? (await readProjectFile(root, notesFile)).trim() : '';
  if (verdict && verdict !== 'pass' && !notes) throw new Error('Failed evaluation needs feedback: pass --notes <file> with the findings.');
  const state = await call(['status', runFile]);
  if (state.action === 'stale' && state.stale.includes(nodeId)) {
    throw new Error(`Code changed since ${nodeId} began; its result is stale. Reset it: graph.mjs reset ${runFile} ${nodeId} "<reason>", then begin again.`);
  }

  const token = taskToken(run, nodeId);
  const checks = (run.verification?.value.checks ?? []).filter(check => check.covers.some(id => node.covers.includes(id)));
  const receipts = [];
  let failing;
  if (!reviews) {
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
  const summary = notes.split('\n').find(line => line.trim())?.trim() ?? `${nodeId} completed by complete`;
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
  return {
    node: nodeId,
    status: passed ? 'completed' : 'failed',
    next: after.ready[0]?.id ?? after.action,
    ...(failing ? { failing: { check: failing.check, tail: clip(failing.tail, 600) } } : {}),
    ...(note ? { note: clip(note, 200) } : {}),
  };
}

