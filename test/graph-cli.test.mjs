import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { installWorkflow, removeWorkflow } from '../src/install.mjs';

const packageRoot = path.resolve(import.meta.dirname, '..');
const story = `# Story: safe edit
Status: Approved
Owner: human owner
Understanding gate (G1): approval.md · 2026-09-19 · Check-in: accepted

## Goal
Make the requested edit.
## Domain
- Invariant: preserve unrelated behavior.
## MUST
- M1. The requested behavior works.
## SHOULD
- S1. Keep the code clear.
## OUT
- O1. Unrelated changes.
## Decisions
- D1. User requested implementation.
## Verify
- V1 [M1]. Exercise the changed behavior.
`;

async function fixture(host = 'codex') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-graph-cli-'));
  await fs.writeFile(path.join(root, 'story.md'), story);
  await fs.writeFile(path.join(root, 'approval.md'), 'User approved this scope.');
  await installWorkflow({ root, hosts: [host] });
  const cli = (...args) => spawnSync(process.execPath, [path.join(root, '.ai-workflow/bin/graph.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const ok = (...args) => {
    const result = cli(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const put = async (file, data) => fs.writeFile(path.join(root, file), typeof data === 'string' ? data : JSON.stringify(data));
  const record = async (node, passed = true, action = 'fix') => {
    const state = ok('status', 'run.json');
    const ready = state.ready.find(entry => entry.id === node);
    assert.ok(ready, `${node} should be ready`);
    const task = ok('start', 'run.json', node, ready.token).started;
    const evidence = `${node}-${task.token}.txt`;
    await put(evidence, passed ? 'Observed expected behavior.' : 'Observed test failure.');
    await put('result.json', { token: task.token, output: { summary: 'Observed result', evidence: [evidence] },
      evaluation: passed ? { passed: true } : { passed: false, action, feedback: 'Needs attention' } });
    return ok('record', 'run.json', node, 'result.json');
  };
  return { root, cli, ok, put, record };
}

for (const host of ['codex', 'claude']) test(`installed ${host} graph completes a failure/fix cycle without node_modules or gate approval`, async () => {
  const f = await fixture(host);
  const first = f.ok('init', '-', 'run.json', 'story.md');
  assert.equal(first.action, 'execute');
  assert.equal(first.ready[0].id, 'implement');
  assert.equal((await f.record('implement', false)).action, 'fix');
  f.ok('reset', 'run.json', 'implement', 'Corrected failing behavior');
  await f.record('implement');
  await f.record('workflow-review');
  const done = await f.record('workflow-verify');
  assert.equal(done.action, 'g4');
  assert.match(done.gate, /G4/);
  assert.equal(await fs.readFile(path.join(f.root, 'story.md'), 'utf8'), story);
  await assert.rejects(fs.access(path.join(f.root, 'node_modules')));
  const before = await fs.readFile(path.join(f.root, 'run.json'), 'utf8');
  await installWorkflow({ root: f.root, hosts: [host] });
  assert.equal(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'), before);
  await removeWorkflow({ root: f.root });
  assert.equal(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'), before);
  await assert.rejects(fs.access(path.join(f.root, '.ai-workflow/bin/graph.mjs')));
  await assert.rejects(fs.access(path.join(f.root, '.ai-workflow/graph')));
});

test('custom graph preserves independent evidence when a failed node is reset', async () => {
  const f = await fixture();
  await f.put('plan.json', { id: 'parallel', nodes: [
    { id: 'A', description: 'Read behavior', access: 'read', covers: ['M1'], verify: 'Inspect the code' },
    { id: 'B', description: 'Read tests', access: 'read', covers: ['V1'], verify: 'Inspect the tests' },
  ], edges: [] });
  const first = f.ok('init', 'plan.json', 'run.json', 'story.md');
  assert.deepEqual(first.ready.map(node => node.id), ['A', 'B']);
  await f.record('B');
  await f.record('A', false);
  f.ok('reset', 'run.json', 'A', 'Fix A only');
  const resumed = f.ok('status', 'run.json');
  assert.deepEqual(resumed.completed, ['B']);
  assert.deepEqual(resumed.ready.map(node => node.id), ['A']);
});

test('record rejects missing evidence, premature nodes and stale task tokens without changing state', async () => {
  const f = await fixture();
  const initial = f.ok('init', '-', 'run.json', 'story.md');
  const started = f.ok('start', 'run.json', 'implement', initial.ready[0].token).started;
  const before = await fs.readFile(path.join(f.root, 'run.json'), 'utf8');
  await f.put('empty.txt', '');
  for (const evidence of [[], ['missing.txt'], ['empty.txt'], ['../outside.txt']]) {
    await f.put('result.json', { token: started.token, output: { summary: 'Done', evidence }, evaluation: { passed: true } });
    assert.equal(f.cli('record', 'run.json', 'implement', 'result.json').status, 1);
    assert.equal(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'), before);
  }
  assert.equal(f.cli('record', 'run.json', 'workflow-review', 'result.json').status, 1);
  f.ok('reset', 'run.json', 'implement', 'Discard invalid attempt');
  await f.record('implement', false);
  f.ok('reset', 'run.json', 'implement', 'Correction');
  await f.put('proof.txt', 'Valid proof');
  await f.put('result.json', { token: initial.ready[0].token, output: { summary: 'Old work', evidence: ['proof.txt'] }, evaluation: { passed: true } });
  const stale = f.cli('record', 'run.json', 'implement', 'result.json');
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /token|stale/i);
});

test('a late result from another run cannot complete the same task in a new run', async () => {
  const f = await fixture();
  const first = f.ok('init', '-', 'first.json', 'story.md');
  const oldTask = f.ok('start', 'first.json', 'implement', first.ready[0].token).started;
  const second = f.ok('init', '-', 'second.json', 'story.md');
  const newTask = f.ok('start', 'second.json', 'implement', second.ready[0].token).started;
  await f.put('proof.txt', 'Result from the old run.');
  await f.put('result.json', { token: oldTask.token, output: { summary: 'Old result', evidence: ['proof.txt'] }, evaluation: { passed: true } });
  const before = await fs.readFile(path.join(f.root, 'second.json'), 'utf8');
  assert.equal(f.cli('record', 'second.json', 'implement', 'result.json').status, 1);
  assert.notEqual(oldTask.token, newTask.token);
  assert.equal(await fs.readFile(path.join(f.root, 'second.json'), 'utf8'), before);
});

test('three failed attempts route to stop and cannot reset into an unbounded loop', async () => {
  const f = await fixture();
  f.ok('init', '-', 'run.json', 'story.md');
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await f.record('implement', false);
    assert.equal(result.action, attempt === 3 ? 'stop' : 'fix');
    if (attempt < 3) f.ok('reset', 'run.json', 'implement', 'Correction');
  }
  assert.equal(f.cli('reset', 'run.json', 'implement', 'Again').status, 1);
});

for (const action of ['replan', 'human']) test(`${action} failures pause execution instead of blindly retrying`, async () => {
  const f = await fixture();
  f.ok('init', '-', 'run.json', 'story.md');
  const result = await f.record('implement', false, action);
  assert.equal(result.action, action);
  assert.deepEqual(result.ready, []);
  assert.equal(f.cli('reset', 'run.json', 'implement', 'Retry').status, 1);
});

test('draft Story, changed requirements, modified graphs and modified evidence fail closed', async () => {
  const f = await fixture();
  await f.put('story.md', story.replace('Status: Approved', 'Status: Draft'));
  assert.equal(f.cli('init', '-', 'run.json', 'story.md').status, 1);
  await f.put('story.md', story);
  f.ok('init', '-', 'run.json', 'story.md');
  await f.put('story.md', story.replace('requested behavior works', 'different behavior works'));
  assert.match(f.cli('status', 'run.json').stderr, /Story.*changed/i);
  await f.put('story.md', story);
  await f.record('implement');
  const run = JSON.parse(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'));
  await f.put(run.state.nodes.implement.output.evidence[0], 'Altered proof');
  assert.match(f.cli('status', 'run.json').stderr, /evidence.*changed/i);
  run.graph.nodes[0].description = 'A different task';
  await f.put('run.json', run);
  assert.match(f.cli('status', 'run.json').stderr, /fingerprint|changed/i);
});

test('run locks, symlinks and existing files are preserved on rejected writes', async () => {
  const f = await fixture();
  f.ok('init', '-', 'run.json', 'story.md');
  const original = await fs.readFile(path.join(f.root, 'run.json'), 'utf8');
  assert.equal(f.cli('init', '-', 'run.json', 'story.md').status, 1);
  await f.put('run.json.lock', 'Another writer');
  assert.match(f.cli('reset', 'run.json', 'implement', 'Reset').stderr, /lock/i);
  assert.equal(await fs.readFile(path.join(f.root, 'run.json.lock'), 'utf8'), 'Another writer');
  assert.equal(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'), original);
  await fs.symlink(path.join(f.root, 'run.json'), path.join(f.root, 'link.json'));
  assert.match(f.cli('status', 'link.json').stderr, /symlink/i);
});

test('doctor detects an incomplete graph runtime and package CLI exposes the same commands', async () => {
  const f = await fixture();
  const packageCli = (...args) => spawnSync(process.execPath, [path.join(packageRoot, 'bin/ai-workflow-kit.mjs'), ...args, '--root', f.root], { encoding: 'utf8' });
  assert.equal(packageCli('graph', 'init', '-', 'run.json', 'story.md').status, 0);
  assert.equal(packageCli('doctor').status, 0);
  await fs.unlink(path.join(f.root, '.ai-workflow/graph/scheduler.mjs'));
  const doctor = packageCli('doctor');
  assert.equal(doctor.status, 1);
  assert.match(doctor.stdout, /Graph|graph/);
});

test('custom plans reject invalid dependencies, missing coverage and empty node contracts', async () => {
  const f = await fixture();
  const good = { id: 'task', description: 'Implement behavior', access: 'write', covers: ['M1', 'V1'], verify: 'Exercise both outcomes' };
  for (const plan of [
    { nodes: [{ ...good, description: '' }] },
    { nodes: [{ ...good, covers: ['M1'] }] },
    { nodes: [{ ...good, covers: ['M1', 'V1', 'M2'] }] },
    { nodes: [good], edges: [{ from: 'task', to: 'missing' }] },
    { nodes: [good, { ...good, id: 'other' }], edges: [{ from: 'task', to: 'other' }, { from: 'other', to: 'task' }] },
  ]) {
    await f.put('plan.json', plan);
    assert.equal(f.cli('init', 'plan.json', 'run.json', 'story.md').status, 1);
    await assert.rejects(fs.access(path.join(f.root, 'run.json')));
  }
});

test('resetting even an unrecorded attempt invalidates issued task tokens', async () => {
  const f = await fixture();
  const first = f.ok('init', '-', 'run.json', 'story.md');
  const reset = f.ok('reset', 'run.json', 'implement', 'Inputs changed before recording');
  assert.notEqual(reset.ready[0].token, first.ready[0].token);
});

test('evidence and run paths reject symlink escapes', async () => {
  const f = await fixture();
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-outside-'));
  await fs.writeFile(path.join(outside, 'proof.txt'), 'Outside project');
  await fs.symlink(outside, path.join(f.root, 'escape'));
  assert.match(f.cli('init', '-', 'escape/run.json', 'story.md').stderr, /symlink/);
  const initialized = f.ok('init', '-', 'run.json', 'story.md');
  const started = f.ok('start', 'run.json', 'implement', initialized.ready[0].token).started;
  await f.put('result.json', { token: started.token, output: { summary: 'Wrong path', evidence: ['escape/proof.txt'] }, evaluation: true });
  assert.match(f.cli('record', 'run.json', 'implement', 'result.json').stderr, /symlink/);
  await assert.rejects(fs.access(path.join(outside, 'run.json')));
});

test('concurrent records retain both independent results or refuse a locked writer without lost updates', async () => {
  const f = await fixture();
  await f.put('plan.json', { nodes: ['A', 'B'].map(id => ({ id, description: id, access: 'read', covers: ['M1', 'V1'], verify: 'Inspect code' })) });
  const initial = f.ok('init', 'plan.json', 'run.json', 'story.md');
  for (const ready of initial.ready) {
    const node = f.ok('start', 'run.json', ready.id, ready.token).started;
    await f.put(`${node.id}.txt`, 'Actual observation');
    await f.put(`${node.id}.json`, { token: node.token, output: { summary: node.id, evidence: [`${node.id}.txt`] }, evaluation: true });
  }
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const exec = promisify(execFile);
  const results = await Promise.allSettled(['A', 'B'].map(id => exec(process.execPath,
    [path.join(f.root, '.ai-workflow/bin/graph.mjs'), 'record', 'run.json', id, `${id}.json`], { cwd: f.root })));
  const status = f.ok('status', 'run.json');
  assert.equal(status.completed.length, results.filter(result => result.status === 'fulfilled').length);
  assert.ok(status.completed.length >= 1);
  for (const result of results) if (result.status === 'rejected') assert.match(result.reason.stderr, /lock/i);
});

test('updates add the graph to a pre-graph install and preserve user edits and run artifacts', async () => {
  const f = await fixture();
  const configPath = path.join(f.root, '.ai-workflow/config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  delete config.managedTrees['.ai-workflow/graph'];
  delete config.managedFiles['.ai-workflow/bin/graph.mjs'];
  await fs.rm(path.join(f.root, '.ai-workflow/graph'), { recursive: true });
  await fs.unlink(path.join(f.root, '.ai-workflow/bin/graph.mjs'));
  await fs.writeFile(configPath, JSON.stringify(config));
  await installWorkflow({ root: f.root, hosts: ['codex'] });
  f.ok('init', '-', '.ai-workflow/runs/story.json', 'story.md');
  const runtime = path.join(f.root, '.ai-workflow/graph/scheduler.mjs');
  await fs.appendFile(runtime, '\n// Team customization\n');
  const update = await installWorkflow({ root: f.root, hosts: ['codex'] });
  assert.ok(update.preserved.includes('.ai-workflow/graph'));
  assert.equal((await installWorkflow({ root: f.root, hosts: ['codex'] })).changed, false);
  await removeWorkflow({ root: f.root });
  assert.match(await fs.readFile(runtime, 'utf8'), /Team customization/);
  await fs.access(path.join(f.root, '.ai-workflow/runs/story.json'));
});

test('doctor reports ignored graph files even when the checker itself is tracked', async () => {
  const f = await fixture();
  const git = (...args) => spawnSync('git', args, { cwd: f.root, encoding: 'utf8' });
  git('init', '-q');
  git('add', '.ai-workflow/bin/check.mjs');
  await f.put('.gitignore', '.ai-workflow/graph/\n.ai-workflow/bin/graph.mjs\n');
  const doctor = spawnSync(process.execPath, [path.join(packageRoot, 'bin/ai-workflow-kit.mjs'), 'doctor', '--root', f.root], { encoding: 'utf8' });
  assert.equal(doctor.status, 1);
  assert.match(doctor.stdout, /graph.*git|Graph.*git/);
});

test('failure during state replacement leaves the original run and removes only its own lock', async t => {
  const f = await fixture();
  f.ok('init', '-', 'run.json', 'story.md');
  const before = await fs.readFile(path.join(f.root, 'run.json'), 'utf8');
  const { updateRun } = await import('../src/graph/storage.mjs');
  t.mock.method(fs, 'rename', async () => { throw new Error('injected disk error'); });
  await assert.rejects(updateRun(f.root, 'run.json', async run => ({ ...run, history: ['new event'] })), /disk error/);
  assert.equal(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'), before);
  await assert.rejects(fs.access(path.join(f.root, 'run.json.lock')));
});

test('started reads are reserved durably and block a newly ready writer until all readers finish', async () => {
  const f = await fixture();
  await f.put('plan.json', { nodes: [
    { id: 'A', description: 'Read A', access: 'read', covers: ['M1'], verify: 'Inspect A' },
    { id: 'C', description: 'Write C', access: 'write', covers: ['M1'], verify: 'Check C' },
    { id: 'B', description: 'Read B', access: 'read', covers: ['V1'], verify: 'Inspect B' },
  ], edges: [{ from: 'A', to: 'C' }] });
  const first = f.ok('init', 'plan.json', 'run.json', 'story.md');
  const a = f.ok('start', 'run.json', 'A', first.ready.find(node => node.id === 'A').token).started;
  const b = f.ok('start', 'run.json', 'B', first.ready.find(node => node.id === 'B').token).started;
  const startedState = JSON.parse(await fs.readFile(path.join(f.root, 'run.json'), 'utf8'));
  assert.equal(startedState.state.nodes.B.status, 'running');
  assert.equal(startedState.state.nodes.B.attempts, 1);
  assert.equal(f.cli('start', 'run.json', 'B', b.token).status, 1);
  await f.put('a.txt', 'Observed A');
  await f.put('a.json', { token: a.token, output: { summary: 'A done', evidence: ['a.txt'] }, evaluation: true });
  const waiting = f.ok('record', 'run.json', 'A', 'a.json');
  assert.equal(waiting.action, 'wait');
  assert.deepEqual(waiting.ready, []);
  assert.deepEqual(waiting.running, ['B']);
  f.ok('reset', 'run.json', 'B', 'Worker stopped; inspected side effects before retry');
  const stale = f.cli('record', 'run.json', 'B', 'a.json');
  assert.equal(stale.status, 1);
});
