import assert from 'node:assert/strict';
import test from 'node:test';
import { graphProject } from './fixtures/graph-project.mjs';

// A run ready for its first begin.
const prepared = async (t, options) => {
  const f = await graphProject(t, options);
  f.ok('init', '-', 'run.json', 'story.md');
  if (!options?.broken) f.ok('baseline', 'run.json');
  else await forceBaseline(f);
  return f;
};
// A broken fixture fails its baseline by design; mark it passed to test later failures.
const forceBaseline = async f => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const file = path.join(f.root, 'run.json');
  const run = JSON.parse(await readFile(file, 'utf8'));
  await f.put('run.json', { ...run, baseline: { profile: run.verification.fingerprint, snapshot: 'fixture', receipts: {} } });
};
const complete = (f, node, ...flags) => {
  const result = f.cli('complete', 'run.json', node, ...flags);
  return { ...result, out: result.status === 0 ? JSON.parse(result.stdout) : null };
};
const through = async (f, last) => {
  for (const [node, flags] of [['implement', []], ['workflow-review', ['--verdict', 'pass']], ['workflow-verify', []]]) {
    f.ok('begin', 'run.json', node);
    const done = complete(f, node, ...flags);
    assert.equal(done.status, 0, done.stderr);
    if (node === last) return done.out;
  }
  return null;
};

test('begin returns a compact brief and marks the node running', async t => {
  const f = await prepared(t);
  const brief = f.ok('begin', 'run.json', 'implement');
  assert.ok(JSON.stringify(brief).length < 1000, JSON.stringify(brief));
  assert.equal(brief.node, 'implement');
  assert.deepEqual(brief.covers, ['M1', 'V1']);
  assert.match(brief.area, /Other operations/);
  assert.deepEqual(brief.checks, ['addition']);
  assert.deepEqual(f.ok('status', 'run.json').running, ['implement']);
});

test('complete runs the node checks and records a pass', async t => {
  const f = await prepared(t);
  f.ok('begin', 'run.json', 'implement');
  await f.put('app.mjs', 'export const add = (a, b) => a + b; // implemented\n');
  const done = complete(f, 'implement');
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.out.status, 'completed');
  assert.equal(done.out.next, 'workflow-review');
  assert.ok(JSON.stringify(done.out).length < 1000);
});

test('a failing check forces fix with a short tail', async t => {
  const f = await prepared(t, { broken: true });
  f.ok('begin', 'run.json', 'implement');
  const done = complete(f, 'implement');
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.out.status, 'failed');
  assert.equal(done.out.failing.check, 'addition');
  assert.ok(done.out.failing.tail.split('\n').length <= 20);
  assert.equal(done.out.next, 'implement');
});

test('review needs a verdict', async t => {
  const f = await prepared(t);
  await through(f, 'implement');
  f.ok('begin', 'run.json', 'workflow-review');
  assert.match(complete(f, 'workflow-review').stderr, /verdict/);
});

test('review fix needs notes', async t => {
  const f = await prepared(t);
  await through(f, 'implement');
  f.ok('begin', 'run.json', 'workflow-review');
  assert.match(complete(f, 'workflow-review', '--verdict', 'fix').stderr, /feedback/);
});

test('review fix resets implement', async t => {
  const f = await prepared(t);
  await through(f, 'implement');
  f.ok('begin', 'run.json', 'workflow-review');
  await f.put('findings.md', 'M1: the sum ignores negative inputs.\n');
  const done = complete(f, 'workflow-review', '--verdict', 'fix', '--notes', 'findings.md');
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.out.next, 'implement');
  assert.ok(f.ok('status', 'run.json').ready.some(node => node.id === 'implement'));
  const brief = f.ok('begin', 'run.json', 'implement');
  assert.match(brief.feedback, /negative inputs/);
});

test('complete refuses a pass on a changed snapshot', async t => {
  const f = await prepared(t);
  await through(f, 'workflow-review');
  f.ok('begin', 'run.json', 'workflow-verify');
  await f.put('app.mjs', 'export const add = (a, b) => b + a;\n');
  const done = complete(f, 'workflow-verify');
  assert.notEqual(done.status, 0);
  assert.match(done.stderr, /stale/);
});

test('the minimal plan finishes with three begin/complete pairs', async t => {
  const f = await prepared(t);
  const last = await through(f);
  assert.equal(last, null);
  assert.equal(f.ok('status', 'run.json').action, 'g4');
});

test('evidence and approval files do not make results stale', async t => {
  const f = await prepared(t);
  await through(f, 'workflow-review');
  f.ok('begin', 'run.json', 'workflow-verify');
  await f.put('.ai-workflow/evidence/note.txt', 'scratch');
  await f.put('.ai-workflow/approvals/g4.json', { gate: 'G4' });
  const done = complete(f, 'workflow-verify');
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.out.status, 'completed');
  assert.equal(done.out.next, 'g4');
});

test('verify reuses the implement check when the code did not change', async t => {
  const { readdir } = await import('node:fs/promises');
  const path = await import('node:path');
  const f = await prepared(t);
  const { runId } = f.ok('status', 'run.json');
  await through(f);
  const runs = (await readdir(path.join(f.root, '.ai-workflow/evidence', runId), { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name !== 'complete');
  assert.equal(runs.length, 1);
  assert.equal(f.ok('status', 'run.json').action, 'g4');
});
