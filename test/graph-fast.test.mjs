import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { graphProject, story } from './fixtures/graph-project.mjs';
import { storyContract } from '../src/graph/workflow.mjs';

const draft = story.replace('Status: Approved', 'Status: Draft').replace(/^Understanding gate \(G1\).*\n/m, '');
const read = (f, file) => fs.readFile(path.join(f.root, file), 'utf8');
const reply = '.ai-workflow/approvals/reply.md';
const notes = '.ai-workflow/evidence/review.md';

const approved = async t => {
  const f = await graphProject(t);
  await f.put('story.md', draft);
  await f.put(reply, '승인\n');
  f.ok('approve', 'G1', 'story.md', '--response', reply);
  return f;
};
// A detected profile has no explicit inputs, so its project must be a git repository, as real ones are.
const gitInit = f => {
  for (const args of [['init', '-q'], ['add', '-A'], ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'start']]) spawnSync('git', args, { cwd: f.root });
};
const complete = (f, node, ...flags) => {
  const result = f.cli('complete', 'run.json', node, ...flags);
  return { ...result, out: result.status === 0 ? JSON.parse(result.stdout) : null };
};

test('approve G1 writes the bound record and approves the Story', async t => {
  const f = await approved(t);
  const text = await read(f, 'story.md');
  assert.match(text, /^Status: Approved$/m);
  assert.match(text, /^Understanding gate \(G1\): \.ai-workflow\/approvals\/story-G1\.json · \d{4}-\d{2}-\d{2} · Check-in: accepted$/m);
  const record = JSON.parse(await read(f, '.ai-workflow/approvals/story-G1.json'));
  assert.equal(record.gate, 'G1');
  assert.equal(record.storyHash, storyContract(story).fingerprint);
  assert.equal(record.responseRef, reply);
  f.ok('init', '-', 'run.json', 'story.md');
});

test('approve G1 needs the human reply', async t => {
  const f = await graphProject(t);
  await f.put('story.md', draft);
  await f.put(reply, '\n');
  assert.match(f.cli('approve', 'G1', 'story.md', '--response', reply).stderr, /reply|response/i);
  assert.match(await read(f, 'story.md'), /^Status: Draft$/m);
});

test('approve G1 records an approved light lane', async t => {
  const f = await graphProject(t);
  await f.put('story.md', draft.replace('Owner: fixture owner\n', 'Owner: fixture owner\nLane: light\n'));
  await f.put(reply, '승인\n');
  f.ok('approve', 'G1', 'story.md', '--response', reply);
  assert.equal(JSON.parse(await read(f, '.ai-workflow/approvals/story-G1.json')).lane, 'light');
  assert.equal(f.ok('light', 'story.md', 'light.json').lane, 'light');
});

test('go starts the run and begins the first node, and resumes it', async t => {
  const f = await approved(t);
  const brief = f.ok('go', 'story.md', 'run.json');
  assert.equal(brief.node, 'implement');
  assert.deepEqual(f.ok('status', 'run.json').running, ['implement']);
  assert.equal(f.ok('go', 'story.md', 'run.json').token, brief.token);
});

test('complete begins the next node and returns its brief; begin is idempotent', async t => {
  const f = await approved(t);
  const first = f.ok('go', 'story.md', 'run.json');
  assert.equal(f.ok('begin', 'run.json', 'implement').token, first.token);
  const done = complete(f, 'implement');
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.out.next, 'workflow-review');
  assert.equal(done.out.brief.node, 'workflow-review');
  assert.deepEqual(f.ok('status', 'run.json').running, ['workflow-review']);
});

test('begin does not wait for a baseline', async t => {
  const f = await approved(t);
  f.ok('init', '-', 'run.json', 'story.md');
  assert.equal(f.ok('begin', 'run.json', 'implement').node, 'implement');
});

test('one review round per run', async t => {
  const f = await approved(t);
  f.ok('go', 'story.md', 'run.json');
  complete(f, 'implement');
  await f.put(notes, 'M1: add the failure case.\n');
  assert.equal(complete(f, 'workflow-review', '--verdict', 'fix', '--notes', notes).status, 0);
  complete(f, 'implement');
  const again = complete(f, 'workflow-review', '--verdict', 'fix', '--notes', notes);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /one review round/i);
});

test('approve G4 writes the bound record and delivers', async t => {
  const f = await approved(t);
  f.ok('go', 'story.md', 'run.json');
  complete(f, 'implement');
  await f.put(notes, 'No findings.\n');
  complete(f, 'workflow-review', '--verdict', 'pass', '--notes', notes);
  assert.equal(complete(f, 'workflow-verify').out.next, 'g4');
  await f.put('.ai-workflow/approvals/g4-summary.md', '1. change\n2. rule and failure\n3. tests\n4. unproven\n');
  await f.put('.ai-workflow/approvals/g4-reply.md', '승인\n');
  assert.match(f.cli('approve', 'G4', 'run.json', '--summary', reply, '--response', '.ai-workflow/approvals/g4-reply.md').stderr, /four/);
  const out = f.ok('approve', 'G4', 'run.json', '--summary', '.ai-workflow/approvals/g4-summary.md', '--response', '.ai-workflow/approvals/g4-reply.md');
  assert.equal(out.action, 'delivered');
  const text = await read(f, 'story.md');
  assert.match(text, /^Status: Delivered$/m);
  assert.match(text, /^Understanding gate \(G4\): \.ai-workflow\/approvals\/story-G4\.json · .+ · Check-in: accepted · Mode: ai-summary$/m);
  assert.match(text, /^G4: APPROVED — fixture owner approved the AI summary$/m);
});

test('the shared profile keeps scope placeholders and go resolves them per run', async t => {
  const f = await approved(t);
  await fs.rm(path.join(f.root, '.ai-workflow/verification.json'));
  await f.put('package.json', { scripts: { test: 'react-scripts test' }, dependencies: { 'react-scripts': '5.0.1' } });
  await f.put('gradlew', '#!/bin/sh\n');
  await f.put('lib-core/build.gradle', '\n');
  await f.put('lib-core/src/main/A.java', 'class A {}\n');
  gitInit(f);
  const result = f.cli('go', 'story.md', 'run.json', '--scope', './lib-core/src/main');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout.trim(), /\n/);
  const profile = JSON.parse(await read(f, '.ai-workflow/verification.json'));
  assert.deepEqual(profile.checks.map(check => check.argv), [['npm', 'test', '--', '--watchAll=false', '{scope}'], ['./gradlew', '{gradle-test}', '{gradle-tests}']]);
  const run = JSON.parse(await read(f, 'run.json'));
  assert.deepEqual(run.checkArgv, { test: ['npm', 'test', '--', '--watchAll=false', 'lib-core/src/main'], 'gradle-test': ['./gradlew', ':lib-core:test'] });
});

test('a runner without a path filter and a module-less gradle repo ignore the scope', async t => {
  const f = await approved(t);
  await fs.rm(path.join(f.root, '.ai-workflow/verification.json'));
  await f.put('package.json', { scripts: { test: 'node --test' } });
  await f.put('gradlew', '#!/bin/sh\n');
  gitInit(f);
  f.ok('go', 'story.md', 'run.json', '--scope', 'src/main/java');
  const run = JSON.parse(await read(f, 'run.json'));
  assert.deepEqual(run.checkArgv, { test: ['npm', 'test'], 'gradle-test': ['./gradlew', 'test'] });
});

test('go writes the profile for a light Story too', async t => {
  const f = await graphProject(t);
  await f.put('story.md', draft.replace('Owner: fixture owner\n', 'Owner: fixture owner\nLane: light\n'));
  await f.put(reply, '승인\n');
  f.ok('approve', 'G1', 'story.md', '--response', reply);
  await fs.rm(path.join(f.root, '.ai-workflow/verification.json'));
  await f.put('package.json', { scripts: { test: 'node --test' } });
  assert.equal(f.ok('go', 'story.md', 'light.json').lane, 'light');
  assert.ok(JSON.parse(await read(f, '.ai-workflow/verification.json')).checks.length);
});

test('approval records are named from the full Story path', async t => {
  const f = await graphProject(t);
  for (const dir of ['docs/a', 'docs/b']) await f.put(`${dir}/STORY.md`, draft);
  await f.put(reply, '승인\n');
  assert.equal(f.ok('approve', 'G1', 'docs/a/STORY.md', '--response', reply).record, '.ai-workflow/approvals/docs-a-STORY-G1.json');
  assert.equal(f.ok('approve', 'G1', 'docs/b/STORY.md', '--response', reply).record, '.ai-workflow/approvals/docs-b-STORY-G1.json');
});

test('a failed approve restores the earlier record and the Story', async t => {
  const f = await graphProject(t);
  const blocked = draft.replace('- D1. Fixture-only approval.', '- D1. Fixture-only approval.\n- OPEN BLOCKING: choose a rounding rule.');
  await f.put('story.md', blocked);
  await f.put('.ai-workflow/approvals/story-G1.json', 'previous\n');
  await f.put(reply, '승인\n');
  assert.equal(f.cli('approve', 'G1', 'story.md', '--response', reply).status, 1);
  assert.equal(await read(f, '.ai-workflow/approvals/story-G1.json'), 'previous\n');
  assert.equal(await read(f, 'story.md'), blocked);
});

test('approve keeps CRLF line endings', async t => {
  const f = await graphProject(t);
  await f.put('story.md', draft.replace(/\n/g, '\r\n'));
  await f.put(reply, '승인\n');
  f.ok('approve', 'G1', 'story.md', '--response', reply);
  assert.match(await read(f, 'story.md'), /Status: Approved\r\n/);
});

test('go refuses a run file that belongs to another Story', async t => {
  const f = await approved(t);
  f.ok('go', 'story.md', 'run.json');
  await f.put('other.md', story.replace('addition behavior', 'other behavior'));
  assert.match(f.cli('go', 'other.md', 'run.json').stderr, /another Story/);
});

test('approve G4 keeps summary and reply apart and under approvals', async t => {
  const f = await approved(t);
  f.ok('go', 'story.md', 'run.json');
  complete(f, 'implement');
  await f.put(notes, 'No findings.\n');
  complete(f, 'workflow-review', '--verdict', 'pass', '--notes', notes);
  complete(f, 'workflow-verify');
  await f.put('summary.md', '1. a\n2. b\n3. c\n4. d\n');
  assert.match(f.cli('approve', 'G4', 'run.json', '--summary', 'summary.md', '--response', reply).stderr, /approvals/);
  await f.put('.ai-workflow/approvals/both.md', '1. a\n2. b\n3. c\n4. d\n');
  assert.match(f.cli('approve', 'G4', 'run.json', '--summary', '.ai-workflow/approvals/both.md', '--response', '.ai-workflow/approvals/both.md').stderr, /separate/);
  await f.put('.ai-workflow/evidence/reply.md', '승인\n');
  assert.match(f.cli('approve', 'G4', 'run.json', '--summary', '.ai-workflow/approvals/both.md', '--response', '.ai-workflow/evidence/reply.md').stderr, /approvals/);
});

test('a light run allows one review round', async t => {
  const f = await graphProject(t);
  await f.put('story.md', draft.replace('Owner: fixture owner\n', 'Owner: fixture owner\nLane: light\n'));
  await f.put(reply, '승인\n');
  f.ok('approve', 'G1', 'story.md', '--response', reply);
  f.ok('go', 'story.md', 'light.json');
  await f.put(notes, 'M1: add the failure case.\n');
  f.ok('review', 'light.json', '--verdict', 'fix', '--notes', notes);
  assert.match(f.cli('review', 'light.json', '--verdict', 'fix', '--notes', notes).stderr, /one review round/i);
});

test('approve G1 accepts a Story whose Status was already set to Approved', async t => {
  const f = await graphProject(t);
  await f.put('story.md', draft.replace('Status: Draft', 'Status: Approved'));
  await f.put(reply, '승인\n');
  assert.equal(f.ok('approve', 'G1', 'story.md', '--response', reply).status, 'Approved');
});

test('the brief shows each check command, and --scope repeats', async t => {
  const f = await approved(t);
  await fs.rm(path.join(f.root, '.ai-workflow/verification.json'));
  await f.put('package.json', { scripts: { test: 'jest' } });
  await f.put('gradlew', '#!/bin/sh\n');
  for (const dir of ['lib-a', 'lib-b']) await f.put(`${dir}/build.gradle`, '\n');
  gitInit(f);
  const brief = f.ok('go', 'story.md', 'run.json', '--scope', 'lib-a/src', '--scope', 'lib-b');
  assert.deepEqual(brief.checks, ['test: npm test -- lib-a/src lib-b', 'gradle-test: ./gradlew :lib-a:test :lib-b:test']);
});

test('the failing tail keeps stdout when stderr is only noise', async () => {
  const { receiptTail } = await import('../src/graph/verification.mjs');
  const dir = await fs.mkdtemp(path.join((await import('node:os')).tmpdir(), 'tail-'));
  await fs.writeFile(path.join(dir, 'out.log'), 'Task :lib:test FAILED\nRealtimeTest > deadline FAILED\n    AssertionError at RealtimeTest.java:42\n');
  await fs.writeFile(path.join(dir, 'err.log'), 'Picked up JAVA_TOOL_OPTIONS: -Djava.net.preferIPv4Stack=true\n');
  const tail = await receiptTail(dir, { stdout: 'out.log', stderr: 'err.log', exitCode: 1 });
  assert.match(tail, /RealtimeTest\.java:42/);
  assert.doesNotMatch(tail, /JAVA_TOOL_OPTIONS/);
});

test('complete --tests narrows the checks to the given tests and verify reuses them', async t => {
  const f = await approved(t);
  await fs.rm(path.join(f.root, '.ai-workflow/verification.json'));
  await f.put('package.json', { scripts: { test: 'jest' } });
  await f.put('gradlew', '#!/bin/sh\n');
  await f.put('lib-a/build.gradle', '\n');
  gitInit(f);
  f.ok('go', 'story.md', 'run.json', '--scope', 'lib-a');
  const profile = JSON.parse(await read(f, '.ai-workflow/verification.json'));
  assert.deepEqual(profile.checks.map(check => check.argv), [['npm', 'test', '--', '{scope}'], ['./gradlew', '{gradle-test}', '{gradle-tests}']]);
  complete(f, 'implement', '--tests', 'lib-a/src/test/FooTest', '--tests', 'BarTest');
  const run = JSON.parse(await read(f, 'run.json'));
  assert.deepEqual(run.checkArgv, { test: ['npm', 'test', '--', 'lib-a/src/test/FooTest', 'BarTest'],
    'gradle-test': ['./gradlew', ':lib-a:test', '--tests', 'lib-a/src/test/FooTest', '--tests', 'BarTest'] });
});

test('--tests and --scope take several values after one flag', async t => {
  const f = await approved(t);
  await fs.rm(path.join(f.root, '.ai-workflow/verification.json'));
  await f.put('gradlew', '#!/bin/sh\n');
  for (const dir of ['lib-a', 'lib-b']) await f.put(`${dir}/build.gradle`, '\n');
  await f.put('lib-a/src/test/java/a/FooTest.java', '\n');
  await f.put('lib-b/src/test/kotlin/b/BarTest.kt', '\n');
  gitInit(f);
  const brief = f.ok('go', 'story.md', 'run.json', '--scope', 'lib-a', 'lib-b');
  assert.deepEqual(brief.checks, ['gradle-test: ./gradlew :lib-a:test :lib-b:test']);
  complete(f, 'implement', '--tests', 'FooTest', 'BarTest');
  const run = JSON.parse(await read(f, 'run.json'));
  // Gradle applies --tests to the task just before it, so each module's tests follow its own task.
  assert.deepEqual(run.checkArgv['gradle-test'], ['./gradlew', ':lib-a:test', '--tests', 'FooTest', ':lib-b:test', '--tests', 'BarTest']);
});

test('named gradle tests run in the module that holds them, whatever the scope', async t => {
  const f = await approved(t);
  await fs.rm(path.join(f.root, '.ai-workflow/verification.json'));
  await f.put('gradlew', '#!/bin/sh\n');
  for (const dir of ['lib-a', 'app/api']) await f.put(`${dir}/build.gradle`, '\n');
  await f.put('app/api/src/test/java/com/x/ApiTimeoutTest.java', '\n');
  await f.put('lib-a/src/test/java/com/x/GuardTest.java', '\n');
  gitInit(f);
  // A root folder in the scope picks the root task, which would run every module's tests.
  f.ok('go', 'story.md', 'run.json', '--scope', 'lib-a', 'src');
  complete(f, 'implement', '--tests', '*ApiTimeoutTest', 'com.x.GuardTest.rejectsSlowVendor', 'UnknownTest');
  const run = JSON.parse(await read(f, 'run.json'));
  // A test with no file under src/test stays with the scope's task.
  assert.deepEqual(run.checkArgv['gradle-test'], ['./gradlew', ':app:api:test', '--tests', '*ApiTimeoutTest',
    ':lib-a:test', '--tests', 'com.x.GuardTest.rejectsSlowVendor', 'test', '--tests', 'UnknownTest']);
});
