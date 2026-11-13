import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, projectFile, readJson, readProjectFile, updateRun } from './storage.mjs';
import { executeCheck, findReusableReceipt, indexReceipt, receiptTail, verificationProfile } from './verification.mjs';
import { boundApproval, checkG4Record, storyG4Mode } from './approvals.mjs';
import { assertNotesPath } from './advance.mjs';

// The light lane: no Graph. One check run, one review and G4, each bound to the code snapshot.
// Requirements, G1 binding and the profile are re-validated on every command.

const RECORD = /^(?:Status|Owner|Lane|Understanding gate \(G[134]\)|G4):/i;
const FENCE = /^\s*(?:`{3,}|~{3,})/;

/** Indexes of the Story's record lines zone: the preamble before the first "##" and the trailing footer, outside fences. */
export function recordZoneIndexes(text) {
  const lines = text.split(/\r?\n/);
  const fencedAt = [];
  let fenced = false;
  let firstSection = lines.length;
  lines.forEach((line, index) => {
    const marker = FENCE.test(line);
    if (marker) fenced = !fenced;
    fencedAt[index] = fenced || marker;
    if (!fencedAt[index] && firstSection === lines.length && /^##\s+/.test(line)) firstSection = index;
  });
  let start = lines.length;
  const record = index => !fencedAt[index] && (RECORD.test(lines[index].trim()) || !lines[index].trim() || /^---\s*$/.test(lines[index]));
  while (start > firstSection && record(start - 1)) start -= 1;
  return [...Array(firstSection).keys(), ...Array.from({ length: lines.length - start }, (_, i) => start + i)];
}

/**
 * The Story's lane from its preamble or record footer, outside fences: 'light', 'standard',
 * 'moved-up' (standard, from light) or null. A Lane line inside a section is content.
 */
export function storyLane(text) {
  const lines = text.split(/\r?\n/);
  const lane = recordZoneIndexes(text).map(index => lines[index].trim()).filter(line => /^Lane:/i.test(line)).at(-1);
  const value = lane?.replace(/^Lane:[\t ]*/i, '');
  if (/^light$/i.test(value ?? '')) return 'light';
  if (/^standard[\t ]*\(from light:/i.test(value ?? '')) return 'moved-up';
  if (/^standard$/i.test(value ?? '')) return 'standard';
  return null;
}

/** Replace the record line matching pattern in the record zone, or add it after the last record line. */
export function setRecordLine(text, pattern, line) {
  const lines = text.split(/\r?\n/);
  const zone = recordZoneIndexes(text);
  const existing = zone.find(index => pattern.test(lines[index].trim()));
  if (existing !== undefined) lines[existing] = line;
  else {
    const after = zone.filter(index => RECORD.test(lines[index].trim())).at(-1);
    const title = lines.findIndex(entry => /^#\s+Story:/.test(entry));
    lines.splice((after ?? title) + 1, 0, line);
  }
  return lines.join('\n');
}

export function lightCommands({ root, loadStory, checkGate, snapshot }) {
  // Lane stays out of the Story hash, so the G1 record itself says the human approved the light lane.
  const bindG1 = (story, contract) => boundApproval({ root, story, gate: 'G1', expected: { storyHash: contract.fingerprint }, checkGate,
    validate: value => {
      if (value.lane !== 'light') throw new Error('The light lane needs a G1 that approved Lane: light (lane: "light" in the G1 record); moving down from standard needs a new G1.');
    } });

  const load = async runFile => {
    const run = await readJson(root, runFile);
    if (run?.version !== 3 || run.kind !== 'light' || typeof run.runId !== 'string' || !run.story?.path) throw new Error('Invalid light run.');
    const text = await readProjectFile(root, run.story.path);
    if (storyLane(text) !== 'light') throw new Error('The Story is no longer on the light lane; continue in the standard Graph with init.');
    const contract = await loadStory(run.story.path);
    if (contract.fingerprint !== run.story.fingerprint) throw new Error('Story requirements changed; start a new light run after G1.');
    if (JSON.stringify(await bindG1(run.story.path, contract)) !== JSON.stringify(run.approval)) throw new Error('G1 approval changed; create a new run.');
    const profile = await verificationProfile(root, contract.ids);
    if (profile.fingerprint !== run.verification.fingerprint) throw new Error('Verification profile changed; start a new light run.');
    run.verification = profile;
    return run;
  };

  // A stored result counts only for the code it was made on.
  const progress = (run, code) => {
    const checked = run.checks?.passed === true && run.checks.snapshot === code;
    const reviewed = run.review?.verdict === 'pass' && run.review.snapshot === code;
    return { checked, reviewed, action: !checked ? 'check' : !reviewed ? 'review' : 'g4' };
  };

  return {
    async create(story, runFile) {
      story = path.posix.normalize(story);
      const text = await readProjectFile(root, story);
      if (storyLane(text) !== 'light') throw new Error('The light lane needs "Lane: light" in the Story footer.');
      const contract = await loadStory(story);
      const own = await projectFile(root, runFile);
      const directories = new Set([path.dirname(own), await projectFile(root, '.ai-workflow/runs')]);
      for (const directory of directories) {
        for (const name of await fs.readdir(directory).catch(() => [])) {
          if (!name.endsWith('.json') || path.join(directory, name) === own) continue;
          const other = await fs.readFile(path.join(directory, name), 'utf8').then(JSON.parse, () => null);
          if (other?.kind === 'delivery' && path.posix.normalize(other.story?.path ?? '') === story) {
            throw new Error(`A standard run already exists for this Story (${path.relative(root, path.join(directory, name))}); moving down to light needs a new G1.`);
          }
        }
      }
      const profile = await verificationProfile(root, contract.ids);
      if (profile.value.requiresG3) throw new Error('Work that needs G3 cannot use the light lane.');
      const approval = await bindG1(story, contract);
      const run = await updateRun(root, runFile, async () => ({ version: 3, kind: 'light', runId: randomUUID(),
        story: { path: story, fingerprint: contract.fingerprint }, approval, verification: profile, receipts: {}, history: [] }), { create: true });
      return { runId: run.runId, lane: 'light', checks: profile.value.checks.map(check => check.id), next: 'check' };
    },

    async check(runFile) {
      const run = await load(runFile);
      const code = (await snapshot(run)).fingerprint;
      const receipts = {};
      let failing;
      for (const check of run.verification.value.checks) {
        let found = await findReusableReceipt(root, run, check, code);
        if (!found) {
          found = await executeCheck({ root, run, nodeId: 'check', token: null, check, snapshotBefore: code, snapshot });
          await indexReceipt(root, runFile, check, found.receipt, found.file);
        }
        receipts[check.id] = { file: found.file, hash: found.hash };
        if (!found.receipt.passed) { failing = { check: check.id, tail: await receiptTail(root, found.receipt) }; break; }
      }
      await updateRun(root, runFile, async previous => ({ ...structuredClone(previous),
        checks: { snapshot: code, passed: !failing, receipts },
        history: [...previous.history, { event: 'check', passed: !failing, snapshot: code, at: new Date().toISOString() }] }));
      return { passed: !failing, snapshot: code, ...(failing ? { failing } : {}), next: failing ? 'fix, then check' : progress({ ...run, checks: { passed: true, snapshot: code } }, code).action };
    },

    async review(runFile, { verdict, notes }) {
      if (!['pass', 'fix'].includes(verdict)) throw new Error('review needs --verdict pass|fix, and --notes <file> with the findings.');
      assertNotesPath(notes);
      const text = notes ? (await readProjectFile(root, notes)).trim() : '';
      if (verdict === 'fix' && !text) throw new Error('A fix verdict needs feedback: pass --notes <file> with the findings.');
      const run = await load(runFile);
      const code = (await snapshot(run)).fingerprint;
      const review = { verdict, snapshot: code, ...(notes ? { notes, notesHash: digest(text) } : {}), at: new Date().toISOString() };
      const next = await updateRun(root, runFile, async previous => {
        const value = { ...structuredClone(previous), review, history: [...previous.history, { event: 'review', ...review }] };
        if (verdict === 'fix') delete value.checks; // the fix changes the code; its checks must run again
        return value;
      });
      return { verdict, snapshot: code, next: progress(next, code).action };
    },

    async status(runFile) {
      const run = await load(runFile);
      const code = (await snapshot(run)).fingerprint;
      return { runId: run.runId, lane: 'light', snapshot: code, ...progress(run, code),
        gate: 'Checks and review never approve G4. G4 remains human-owned.' };
    },

    async delivery(runFile) {
      const run = await load(runFile);
      const code = (await snapshot(run)).fingerprint;
      const state = progress(run, code);
      if (!state.reviewed) throw new Error('Light delivery needs a passing review of the current code; run review again after the last change.');
      if (!state.checked) throw new Error('Light delivery needs passing checks on the current code; run check.');
      for (const check of run.verification.value.checks) {
        const binding = run.checks.receipts[check.id];
        const receipt = binding && await readJson(root, binding.file);
        if (!receipt || digest(JSON.stringify(receipt)) !== binding.hash || !receipt.passed || receipt.runId !== run.runId
          || receipt.snapshotBefore !== code || receipt.snapshotAfter !== code) throw new Error(`Check receipt missing or changed: ${check.id}; run check.`);
      }
      const mode = storyG4Mode(await readProjectFile(root, run.story.path));
      await boundApproval({ root, story: run.story.path, gate: 'G4', expected: { storyHash: run.story.fingerprint, snapshot: code, runId: run.runId },
        checkGate, validate: value => checkG4Record(value, { mode, requiresG3: false }) });
      return { runId: run.runId, lane: 'light', snapshot: code, action: 'delivered' };
    },
  };
}
