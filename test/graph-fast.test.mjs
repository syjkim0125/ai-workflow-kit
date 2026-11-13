import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
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

test('profile --scope narrows detected checks to a module or path', async t => {
  const f = await graphProject(t);
  await fs.rm(path.join(f.root, '.ai-workflow/verification.json'));
  await f.put('package.json', { scripts: { test: 'react-scripts test' }, dependencies: { 'react-scripts': '5.0.1' } });
  await f.put('gradlew', '#!/bin/sh\n');
  const checks = f.ok('profile', 'story.md', '--scope', 'lib-core').checks.map(check => check.argv);
  assert.deepEqual(checks, [['npm', 'test', '--', '--watchAll=false', 'lib-core'], ['./gradlew', ':lib-core:test']]);
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
