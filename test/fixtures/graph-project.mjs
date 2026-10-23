import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installWorkflow } from '../../src/install.mjs';
import { storyContract } from '../../src/graph/workflow.mjs';

export const story = `# Story: addition behavior
Status: Approved
Owner: fixture owner
Understanding gate (G1): approval.json · 2026-10-21 · Check-in: accepted
## Goal
Add two numbers.
## Domain
- Invariant: preserve the inputs.
## MUST
- M1. Adding two and two returns four.
## SHOULD
- S1. Stay clear.
## OUT
- O1. Other operations.
## Decisions
- D1. Fixture-only approval.
## Verify
- V1 [M1]. Execute the addition and assert four.
`;

export async function graphProject(t, { broken = false, profile = {} } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-proof-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const put = async (file, value) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  };
  await installWorkflow({ root, hosts: ['codex'] });
  await put('story.md', story);
  await put('approval.json', { gate: 'G1', storyHash: storyContract(story).fingerprint, responseRef: 'fixture:user-approved' });
  await put('app.mjs', `export const add = (a, b) => ${broken ? '0' : 'a + b'};\n`);
  await put('check.mjs', "import assert from 'node:assert/strict'; import {add} from './app.mjs'; assert.equal(add(2,2),4);\n");
  await put('.ai-workflow/verification.json', { version: 1, inputs: ['app.mjs', 'check.mjs'], checks: [
    { id: 'addition', covers: ['V1'], argv: [process.execPath, 'check.mjs'] },
  ], ...profile });
  const cli = (...args) => spawnSync(process.execPath, [path.join(root, '.ai-workflow/bin/graph.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const ok = (...args) => {
    const result = cli(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const start = nodeId => {
    const state = ok('status', 'run.json');
    const ready = state.ready.find(node => node.id === nodeId);
    assert.ok(ready, `${nodeId} ready: ${JSON.stringify(state)}`);
    return ok('start', 'run.json', nodeId, ready.token).started;
  };
  const result = async (task, evaluation = { passed: true }, extra = {}) => {
    const evidence = `.ai-workflow/evidence/${task.id}-${task.token}.txt`;
    await put(evidence, 'Fixture review / implementation observation.');
    await put('result.json', { token: task.token, output: { summary: 'Fixture result', evidence: [evidence], ...extra }, evaluation });
    return cli('record', 'run.json', task.id, 'result.json');
  };
  const record = async nodeId => {
    const task = start(nodeId);
    if (nodeId === 'workflow-verify' || nodeId === 'self-check') ok('verify', 'run.json', nodeId, task.token, 'addition');
    const recorded = await result(task);
    assert.equal(recorded.status, 0, recorded.stderr);
    return JSON.parse(recorded.stdout);
  };
  return { root, put, cli, ok, start, result, record };
}
