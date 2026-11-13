import fs from 'node:fs/promises';
import path from 'node:path';
import { projectFile, readJson, readProjectFile } from './storage.mjs';
import { storyContract } from './workflow.mjs';
import { setRecordLine, storyLane } from './light.mjs';

// approve writes what a human decision needs on disk: the bound approval JSON, the Story's
// footer lines and Status. It never decides: the host calls it only after the human's actual
// reply, saved in --response. Writing it here keeps hashes and bindings out of model turns.

const today = () => new Date().toISOString().slice(0, 10);
const RESPONSE_DIRS = ['.ai-workflow/approvals/', '.ai-workflow/evidence/'];

async function humanReply(root, response) {
  const file = path.posix.normalize(response ?? '');
  if (!RESPONSE_DIRS.some(dir => file.startsWith(dir))) {
    throw new Error(`Save the human's reply under .ai-workflow/approvals/ and pass it as --response <file>; elsewhere it would change the code snapshot.`);
  }
  const text = (await readProjectFile(root, file)).trim();
  if (!text) throw new Error("--response must hold the human's actual reply.");
  return { file, text };
}

async function writeRecord(root, story, gate, value) {
  const file = `.ai-workflow/approvals/${path.posix.basename(story, '.md')}-${gate}.json`;
  const absolute = await projectFile(root, file);
  await fs.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  await fs.writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return file;
}

/** G1: bind the human's approval to the Story's requirements and mark it Approved. */
export async function approveG1({ root, story, response, checkArtifact, checkGate }) {
  story = path.posix.normalize(story);
  const reply = await humanReply(root, response);
  const original = await readProjectFile(root, story);
  const shape = await checkArtifact({ root, file: story, kind: 'story' });
  if (!shape.ok) throw new Error(shape.errors.join('\n'));
  const lane = storyLane(original);
  const record = await writeRecord(root, story, 'G1', { gate: 'G1', storyHash: storyContract(original).fingerprint,
    responseRef: reply.file, ...(lane === 'light' ? { lane: 'light' } : {}) });
  let text = setRecordLine(original, /^Status:/i, 'Status: Approved');
  text = setRecordLine(text, /^Understanding gate \(G1\):/i, `Understanding gate (G1): ${record} · ${today()} · Check-in: accepted`);
  const storyFile = await projectFile(root, story);
  await fs.writeFile(storyFile, text);
  const results = [await checkArtifact({ root, file: story, kind: 'story' }), await checkGate({ root, file: story, gate: 'G1' })];
  const errors = results.flatMap(result => result.errors);
  if (errors.length) {
    await fs.writeFile(storyFile, original);
    throw new Error(errors.join('\n'));
  }
  return { gate: 'G1', status: 'Approved', record, next: lane === 'light' ? 'go (light lane)' : 'go' };
}

/** G4: bind the human's approval of the AI summary (or their restatement) to the final snapshot, then deliver. */
export async function approveG4({ root, runFile, summary, response, mode = 'ai-summary', call }) {
  if (!['ai-summary', 'human-restatement'].includes(mode)) throw new Error('--mode must be ai-summary or human-restatement.');
  const run = await readJson(root, runFile);
  const state = await call(['status', runFile]);
  if (state.action !== 'g4') throw new Error(`G4 needs the run at action g4 (now: ${state.action}).`);
  const reply = await humanReply(root, response);
  const lines = mode === 'ai-summary' ? (await readProjectFile(root, summary ?? '')).split('\n').map(line => line.trim()).filter(Boolean) : [];
  if (mode === 'ai-summary' && lines.length !== 4) throw new Error('--summary must hold the four numbered lines shown to the human.');
  const story = run.story.path;
  const original = await readProjectFile(root, story);
  const record = await writeRecord(root, story, 'G4', { gate: 'G4', mode,
    ...(mode === 'ai-summary' ? { summary: lines, approvalText: reply.text } : {}),
    storyHash: run.story.fingerprint, snapshot: state.snapshot, runId: run.runId, responseRef: reply.file });
  const owner = original.match(/^Owner:[\t ]*(.+)$/m)?.[1]?.trim() ?? 'owner';
  let text = setRecordLine(original, /^Status:/i, 'Status: Delivered');
  text = setRecordLine(text, /^Understanding gate \(G4\):/i,
    `Understanding gate (G4): ${record} · ${today()} · Check-in: accepted${mode === 'ai-summary' ? ' · Mode: ai-summary' : ''}`);
  text = setRecordLine(text, /^G4:/i, mode === 'ai-summary'
    ? `G4: APPROVED — ${owner} approved the AI summary` : `G4: PASS — ${reply.text.split('\n')[0]}`);
  const storyFile = await projectFile(root, story);
  await fs.writeFile(storyFile, text);
  try {
    const delivered = await call(['delivery', runFile]);
    return { gate: 'G4', action: delivered.action, record, snapshot: state.snapshot };
  } catch (error) {
    await fs.writeFile(storyFile, original);
    await fs.rm(await projectFile(root, record), { force: true });
    throw error;
  }
}
