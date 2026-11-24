import fs from 'node:fs/promises';
import path from 'node:path';
import { projectFile, readJson, readProjectFile } from './storage.mjs';
import { storyContract } from './workflow.mjs';
import { setRecordLine, storyLane } from './light.mjs';

// approve writes what a human decision needs on disk: the bound approval JSON, the Story's
// footer lines and Status. It never decides: the host calls it only after the human's actual
// reply, saved in --response. Writing it here keeps hashes and bindings out of model turns.

const APPROVALS = '.ai-workflow/approvals/';
const today = () => new Date().toLocaleDateString('sv-SE'); // local YYYY-MM-DD

/** A file the host saved under .ai-workflow/approvals/, outside the code snapshot. */
async function approvalFile(root, file, flag, what) {
  const normal = path.posix.normalize(file ?? '');
  if (!normal.startsWith(APPROVALS)) {
    throw new Error(`Save ${what} under ${APPROVALS} and pass it as ${flag} <file>; elsewhere it would change the code snapshot.`);
  }
  const text = (await readProjectFile(root, normal)).trim();
  if (!text) throw new Error(`${flag} must hold ${what}.`);
  return { file: normal, text };
}

/** Record name from the full Story path, so two Stories never share a record. */
const recordName = (story, gate) => `${APPROVALS}${story.replace(/\.md$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-')}-${gate}.json`;

/** Write files and keep their earlier bytes, so a failed approval restores everything. */
async function transaction(root) {
  const saved = [];
  return {
    async write(file, text) {
      const absolute = await projectFile(root, file);
      const before = await fs.readFile(absolute).catch(() => null);
      saved.push([absolute, before]);
      await fs.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
      await fs.writeFile(absolute, text);
    },
    async restore() {
      for (const [absolute, before] of saved.reverse()) {
        if (before === null) await fs.rm(absolute, { force: true });
        else await fs.writeFile(absolute, before);
      }
    },
  };
}

/** G1: bind the human's approval to the Story's requirements and mark it Approved. */
export async function approveG1({ root, story, response, checkArtifact, checkGate }) {
  story = path.posix.normalize(story);
  const reply = await approvalFile(root, response, '--response', "the human's actual reply");
  // No pre-check: the Story may already say Approved; the checks after writing decide, and roll back.
  const original = await readProjectFile(root, story);
  const lane = storyLane(original);
  const record = recordName(story, 'G1');
  const files = await transaction(root);
  await files.write(record, `${JSON.stringify({ gate: 'G1', storyHash: storyContract(original).fingerprint,
    responseRef: reply.file, ...(lane === 'light' ? { lane: 'light' } : {}) }, null, 2)}\n`);
  let text = setRecordLine(original, /^Status:/i, 'Status: Approved');
  text = setRecordLine(text, /^Understanding gate \(G1\):/i, `Understanding gate (G1): ${record} · ${today()} · Check-in: accepted`);
  await files.write(story, text);
  const results = [await checkArtifact({ root, file: story, kind: 'story' }), await checkGate({ root, file: story, gate: 'G1' })];
  const errors = results.flatMap(result => result.errors);
  if (errors.length) {
    await files.restore();
    throw new Error(errors.join('\n'));
  }
  return { gate: 'G1', status: 'Approved', record, next: 'go' };
}

/**
 * G4: bind the human's decision to the final snapshot, then deliver. ai-summary: --summary holds
 * the four lines shown. human-restatement: --summary holds what the human correctly restated.
 */
export async function approveG4({ root, runFile, summary, response, mode = 'ai-summary', call }) {
  if (!['ai-summary', 'human-restatement'].includes(mode)) throw new Error('--mode must be ai-summary or human-restatement.');
  const run = await readJson(root, runFile);
  const state = await call(['status', runFile]);
  if (state.action !== 'g4') throw new Error(`G4 needs the run at action g4 (now: ${state.action}).`);
  const reply = await approvalFile(root, response, '--response', "the human's actual reply");
  const shown = await approvalFile(root, summary, '--summary', mode === 'ai-summary' ? 'the four lines shown to the human' : 'what the human correctly restated');
  if (shown.file === reply.file) throw new Error('--summary and --response must be separate files: what was shown, and what the human replied.');
  const lines = shown.text.split('\n').map(line => line.trim()).filter(Boolean);
  if (mode === 'ai-summary' && lines.length !== 4) throw new Error('--summary must hold the four numbered lines shown to the human.');
  const story = run.story.path;
  const original = await readProjectFile(root, story);
  const record = recordName(story, 'G4');
  const files = await transaction(root);
  await files.write(record, `${JSON.stringify({ gate: 'G4', mode,
    ...(mode === 'ai-summary' ? { summary: lines, approvalText: reply.text } : {}),
    storyHash: run.story.fingerprint, snapshot: state.snapshot, runId: run.runId, responseRef: reply.file }, null, 2)}\n`);
  const owner = original.match(/^Owner:[\t ]*(.+)$/m)?.[1]?.trim() ?? 'owner';
  let text = setRecordLine(original, /^Status:/i, 'Status: Delivered');
  text = setRecordLine(text, /^Understanding gate \(G4\):/i,
    `Understanding gate (G4): ${record} · ${today()} · Check-in: accepted${mode === 'ai-summary' ? ' · Mode: ai-summary' : ''}`);
  text = setRecordLine(text, /^G4:/i, mode === 'ai-summary' ? `G4: APPROVED — ${owner} approved the AI summary` : `G4: PASS — ${lines[0]}`);
  await files.write(story, text);
  try {
    const delivered = await call(['delivery', runFile]);
    return { gate: 'G4', action: delivered.action, record, snapshot: state.snapshot };
  } catch (error) {
    await files.restore();
    throw error;
  }
}
