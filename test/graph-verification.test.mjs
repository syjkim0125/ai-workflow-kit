import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { graphProject } from './fixtures/graph-project.mjs';

test('project recipe is bound to tasks and receipts; edits stale completed verification', async t => {
  const f = await graphProject(t, { profile: { recipe: 'verify/SKILL.md' } });
  const body = '# Verify CLI\nDrive: node check.mjs\n';
  await f.put('verify/SKILL.md', body);
  const recipe = { path: 'verify/SKILL.md', hash: createHash('sha256').update(body).digest('hex') };
  const initial = f.ok('init', '-', 'run.json', 'story.md');
  assert.deepEqual(initial.ready[0].input.verification.recipe, recipe);
  await f.record('implement'); await f.record('workflow-review');
  const task = f.start('workflow-verify');
  assert.deepEqual(task.input.verification.checks, [{ id: 'addition', covers: ['V1'] }]);
  const executed = f.ok('verify', 'run.json', task.id, task.token, 'addition').verification;
  assert.deepEqual(executed.recipe, recipe);
  assert.equal(executed.passed, true);
  assert.equal((await f.result(task)).status, 0);
  await f.put('verify/SKILL.md', `${body}Cleanup: no long-lived processes.\n`);
  const before = await fs.readFile(path.join(f.root, 'run.json'), 'utf8');
  assert.equal(f.ok('status', 'run.json').action, 'stale');
  assert.equal(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'), before);
  f.ok('reset', 'run.json', 'workflow-review', 'Review updated recipe');
  await f.record('workflow-review');
  const fresh = f.start('workflow-verify');
  const rerun = f.ok('verify', 'run.json', fresh.id, fresh.token, 'addition').verification;
  assert.notEqual(rerun.recipe.hash, recipe.hash);
  assert.equal(rerun.passed, true);
  assert.equal((await f.result(fresh)).status, 0);
  assert.equal(f.ok('status', 'run.json').action, 'g4');
});

for (const [name, recipe, body] of [
  ['missing', 'verify/SKILL.md', undefined],
  ['blank', 'verify/SKILL.md', '  \n'],
  ['escape', '../verify.md', undefined],
  ['invalid type', 3, undefined],
]) test(`profile rejects ${name} project recipes`, async t => {
  const f = await graphProject(t, { profile: { recipe } });
  if (body !== undefined) await f.put(recipe, body);
  assert.equal(f.cli('init', '-', 'run.json', 'story.md').status, 1);
});

test('profile rejects symlink recipes', async t => {
  const f = await graphProject(t, { profile: { recipe: 'verify.md' } });
  await fs.symlink('check.mjs', path.join(f.root, 'verify.md'));
  assert.equal(f.cli('init', '-', 'run.json', 'story.md').status, 1);
});

test('review budget is passed only to delivery and role review tasks', async t => {
  const f = await graphProject(t);
  const initial = f.ok('init', '-', 'run.json', 'story.md');
  assert.equal(initial.ready[0].input.reviewBudget, undefined);
  const reviewed = await f.record('implement');
  const budget = reviewed.ready[0].input.reviewBudget;
  assert.equal(budget.defaultAgents, 3);
  assert.equal(budget.scope, 'whole-review-round');
  assert.equal(budget.nestedDelegation, false);
  assert.equal(budget.dispatchOwner, 'host');
  await f.put('assignment.json', { version: 1, taskId: 'review-1', role: 'reviewer', source: 'story.md', scope: ['M1', 'V1'], targetRevision: 'fixture-target' });
  const role = f.ok('init-role', 'assignment.json', 'role.json');
  assert.deepEqual(role.ready[0].input.reviewBudget, budget);
});

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
