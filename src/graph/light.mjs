import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, projectFile, readJson, readProjectFile, updateRun } from './storage.mjs';
import { executeCheck, findReusableReceipt, indexReceipt, receiptTail, verificationProfile } from './verification.mjs';
import { boundApproval, checkG4Record, storyG4Mode } from './approvals.mjs';

// The light lane: no Graph. One check run, one review and G4, each bound to the code snapshot.
// Requirements, G1 binding and the profile are re-validated on every command.

const LANE_LIGHT = /^Lane:[\t ]*light[\t ]*$/im;

export function lightCommands({ root, loadStory, checkGate, snapshot }) {
  const bindG1 = (story, contract) => boundApproval({ root, story, gate: 'G1', expected: { storyHash: contract.fingerprint }, checkGate });

  const load = async runFile => {
    const run = await readJson(root, runFile);
    if (run?.version !== 3 || run.kind !== 'light' || typeof run.runId !== 'string' || !run.story?.path) throw new Error('Invalid light run.');
    const text = await readProjectFile(root, run.story.path);
    if (!LANE_LIGHT.test(text)) throw new Error('The Story is no longer on the light lane; continue in the standard Graph with init.');
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
      const text = await readProjectFile(root, story);
      if (!LANE_LIGHT.test(text)) throw new Error('The light lane needs "Lane: light" in the Story footer.');
      const contract = await loadStory(story);
      const directory = path.dirname(await projectFile(root, runFile));
      for (const name of await fs.readdir(directory).catch(() => [])) {
        if (!name.endsWith('.json') || name === path.basename(runFile)) continue;
        const other = await fs.readFile(path.join(directory, name), 'utf8').then(JSON.parse, () => null);
        if (other?.kind === 'delivery' && other.story?.path === story) {
          throw new Error(`A standard run already exists for this Story (${name}); moving down to light needs a new G1.`);
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
