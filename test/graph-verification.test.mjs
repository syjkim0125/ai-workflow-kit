import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { graphProject } from './fixtures/graph-project.mjs';

test('verification refuses a prose-only pass without an actual execution', async t => {
  const f = await graphProject(t);
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement');
  await f.record('workflow-review');
  const task = f.start('workflow-verify');
  const recorded = await f.result(task);
  assert.equal(recorded.status, 1);
  assert.match(recorded.stderr, /execution|verification.*required|checks/i);
});

test('all configured checks for a V must run; one convenient passing check cannot stand in for another journey', async t => {
  const f = await graphProject(t, { profile: { checks: [
    { id: 'addition', covers: ['V1'], argv: [process.execPath, 'check.mjs'] },
    { id: 'other-entry', covers: ['V1'], argv: [process.execPath, '-e', 'process.exit(1)'] },
  ] } });
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement'); await f.record('workflow-review');
  const task = f.start('workflow-verify');
  f.ok('verify', 'run.json', task.id, task.token, 'addition');
  assert.equal((await f.result(task)).status, 1);
  assert.equal(f.ok('verify', 'run.json', task.id, task.token, 'other-entry').verification.passed, false);
  assert.equal((await f.result(task)).status, 1);
});

test('real failing command cannot be overridden by passed true', async t => {
  const f = await graphProject(t, { broken: true });
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement');
  await f.record('workflow-review');
  const task = f.start('workflow-verify');
  const executed = f.ok('verify', 'run.json', task.id, task.token, 'addition');
  assert.equal(executed.verification.exitCode, 1);
  assert.equal(executed.verification.passed, false);
  const recorded = await f.result(task);
  assert.equal(recorded.status, 1);
  assert.notEqual(f.ok('status', 'run.json').action, 'g4');
  const log = await fs.readFile(path.join(f.root, executed.verification.stderr), 'utf8');
  assert.match(log, /AssertionError/);
});

test('changing product code after successful verification makes evidence stale without rewriting state', async t => {
  const f = await graphProject(t);
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement');
  await f.record('workflow-review');
  assert.equal((await f.record('workflow-verify')).action, 'g4');
  await f.put('app.mjs', 'export const add = () => -1;\n');
  const before = await fs.readFile(path.join(f.root, 'run.json'), 'utf8');
  const status = f.ok('status', 'run.json');
  assert.equal(status.action, 'stale');
  assert.equal(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'), before);
  const reset = f.ok('reset', 'run.json', 'workflow-review', 'Review changed code again');
  assert.deepEqual(reset.ready.map(node => node.id), ['workflow-review']);
  await f.record('workflow-review');
  const task = f.start('workflow-verify');
  assert.equal(f.ok('verify', 'run.json', task.id, task.token, 'addition').verification.passed, false);
  assert.equal((await f.result(task)).status, 1);
});

test('legacy role v2 remains inspectable without being reported role-complete', async t => {
  const f = await graphProject(t);
  await f.put('assignment.json', { version: 1, taskId: 'review-1', role: 'reviewer', source: 'story.md', scope: ['M1', 'V1'], targetRevision: 'fixture-target' });
  f.ok('init-role', 'assignment.json', 'run.json');
  const run = JSON.parse(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'));
  run.version = 2; delete run.kind;
  await f.put('legacy.json', run);
  assert.equal(f.ok('status', 'legacy.json').action, 'upgrade-required');
  assert.equal(f.cli('start', 'legacy.json', 'review', 'old-token').status, 1);
});

test('legacy recorded success remains readable but cannot start new work or claim strengthened readiness', async t => {
  const f = await graphProject(t);
  f.ok('init', '-', 'run.json', 'story.md');
  const run = JSON.parse(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'));
  run.version = 1;
  delete run.kind;
  await f.put('legacy.json', run);
  const status = f.ok('status', 'legacy.json');
  assert.equal(status.action, 'upgrade-required');
  assert.equal(f.cli('start', 'legacy.json', 'implement', 'old-token').status, 1);
});
