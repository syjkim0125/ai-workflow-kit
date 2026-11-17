import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { graphProject } from './fixtures/graph-project.mjs';

const PROFILE = '.ai-workflow/verification.json';

// A fixture project without the hand-written profile the shared fixture provides.
const bare = async t => {
  const f = await graphProject(t);
  await fs.rm(path.join(f.root, PROFILE));
  return f;
};
const exists = file => fs.access(file).then(() => true, () => false);

test('profile detects npm test and tsc', async t => {
  const f = await bare(t);
  await f.put('package.json', { scripts: { test: 'node --test' }, devDependencies: {} });
  await f.put('tsconfig.json', {});
  const out = f.ok('profile', 'story.md');
  assert.equal(out.written, true);
  assert.deepEqual(out.checks.map(check => [check.id, check.argv]), [['test', ['npm', 'test']], ['typecheck', ['npx', 'tsc', '--noEmit']]]);
  const written = JSON.parse(await fs.readFile(path.join(f.root, PROFILE), 'utf8'));
  assert.equal(written.version, 1);
  assert.ok(written.checks.every(check => check.covers.join() === 'V1' && check.timeoutMs === 300000));

  const cra = await bare(t);
  await cra.put('package.json', { scripts: { test: 'react-scripts test' }, dependencies: { 'react-scripts': '5.0.1' } });
  assert.deepEqual(cra.ok('profile', 'story.md').checks[0].argv, ['npm', 'test', '--', '--watchAll=false', '{scope}']);
});

test('profile detects gradle', async t => {
  const f = await bare(t);
  await f.put('gradlew', '#!/bin/sh\n');
  assert.deepEqual(f.ok('profile', 'story.md').checks.map(check => check.argv), [['./gradlew', '{gradle-test}', '{gradle-tests}']]);
});

test('profile refuses an unknown project type', async t => {
  const f = await bare(t);
  await f.put('package.json', { scripts: { test: 'echo "Error: no test specified" && exit 1' } });
  const result = f.cli('profile', 'story.md');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /write \.ai-workflow\/verification\.json by hand/);
  assert.equal(await exists(path.join(f.root, PROFILE)), false);
});

test('profile never overwrites an existing profile', async t => {
  const f = await graphProject(t);
  await f.put('package.json', { scripts: { test: 'node --test' } });
  const before = await fs.readFile(path.join(f.root, PROFILE), 'utf8');
  const out = f.ok('profile', 'story.md');
  assert.equal(out.written, false);
  assert.deepEqual(out.checks.map(check => check.id), ['addition']);
  assert.equal(await fs.readFile(path.join(f.root, PROFILE), 'utf8'), before);
});

test('a failing baseline names the check and how to narrow it', async t => {
  const f = await graphProject(t, { broken: true });
  f.ok('init', '-', 'run.json', 'story.md');
  const result = f.cli('baseline', 'run.json');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /addition/);
  assert.match(result.stderr, /narrow/i);
});

test('a passing baseline is reused by the first implement check', async t => {
  const f = await graphProject(t);
  const { runId } = f.ok('init', '-', 'run.json', 'story.md');
  assert.equal(f.ok('baseline', 'run.json').baseline, 'passed');
  f.ok('begin', 'run.json', 'implement');
  const done = f.cli('complete', 'run.json', 'implement');
  assert.equal(done.status, 0, done.stderr);
  const dirs = (await fs.readdir(path.join(f.root, '.ai-workflow/evidence', runId), { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name !== 'complete');
  assert.equal(dirs.length, 1);
});
