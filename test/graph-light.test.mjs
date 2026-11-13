import assert from 'node:assert/strict';
import test from 'node:test';
import { graphProject, story } from './fixtures/graph-project.mjs';
import { storyContract } from '../src/graph/workflow.mjs';

const light = story.replace('Owner: fixture owner\n', 'Owner: fixture owner\nLane: light\n');
const summary = ['1. change', '2. rule and failure', '3. tests', '4. unproven'];

const notes = '.ai-workflow/evidence/review.md';
const lightProject = async t => {
  const f = await graphProject(t);
  await f.put('story.md', light);
  await f.put('approval.json', { gate: 'G1', storyHash: storyContract(story).fingerprint, responseRef: 'fixture:user-approved', lane: 'light' });
  await f.put(notes, 'Diff matches M1; no findings.\n');
  return f;
};

test('light runs check, review and delivery in three commands', async t => {
  const f = await lightProject(t);
  const created = f.ok('light', 'story.md', 'light.json');
  assert.equal(created.lane, 'light');
  const checked = f.ok('check', 'light.json');
  assert.equal(checked.passed, true);
  const reviewed = f.ok('review', 'light.json', '--verdict', 'pass', '--notes', notes);
  assert.equal(reviewed.next, 'g4');
  await f.put('story.md', light.replace('Status: Approved', 'Status: Delivered')
    + '\nUnderstanding gate (G4): final.json · 2026-11-13 · Check-in: accepted · Mode: ai-summary\nG4: APPROVED — owner approved the AI summary\n');
  await f.put('final.json', { gate: 'G4', mode: 'ai-summary', summary, approvalText: '승인', storyHash: storyContract(story).fingerprint,
    snapshot: checked.snapshot, runId: created.runId, responseRef: 'fixture:approval' });
  assert.equal(f.ok('delivery', 'light.json').action, 'delivered');
});

test('light refuses a Story with a standard run', async t => {
  const f = await graphProject(t);
  f.ok('init', '-', 'run.json', 'story.md');
  await f.put('story.md', light);
  const result = f.cli('light', 'story.md', 'light.json');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /standard run/);
});

test('light refuses a Story without Lane: light', async t => {
  const f = await graphProject(t);
  assert.match(f.cli('light', 'story.md', 'light.json').stderr, /Lane: light/);
});

test('light delivery refuses a review older than the last code change', async t => {
  const f = await lightProject(t);
  const created = f.ok('light', 'story.md', 'light.json');
  f.ok('check', 'light.json');
  f.ok('review', 'light.json', '--verdict', 'pass', '--notes', notes);
  await f.put('app.mjs', 'export const add = (a, b) => b + a;\n');
  const checked = f.ok('check', 'light.json');
  await f.put('story.md', light.replace('Status: Approved', 'Status: Delivered')
    + '\nUnderstanding gate (G4): final.json · 2026-11-13 · Check-in: accepted · Mode: ai-summary\nG4: APPROVED — owner approved the AI summary\n');
  await f.put('final.json', { gate: 'G4', mode: 'ai-summary', summary, approvalText: '승인', storyHash: storyContract(story).fingerprint,
    snapshot: checked.snapshot, runId: created.runId, responseRef: 'fixture:approval' });
  const result = f.cli('delivery', 'light.json');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /review/);
});

test('a light review fix needs notes and invalidates the checks', async t => {
  const f = await lightProject(t);
  f.ok('light', 'story.md', 'light.json');
  f.ok('check', 'light.json');
  assert.match(f.cli('review', 'light.json', '--verdict', 'fix').stderr, /notes|feedback/);
  const fixed = f.ok('review', 'light.json', '--verdict', 'fix', '--notes', notes);
  assert.equal(fixed.next, 'check');
  assert.equal(f.ok('status', 'light.json').action, 'check');
});

test('Lane lines do not change the G1 Story hash', () => {
  const base = storyContract(story).fingerprint;
  assert.equal(storyContract(light).fingerprint, base);
  assert.equal(storyContract(light.replace('Lane: light', 'Lane: standard (from light: touches the schema)')).fingerprint, base);
});

test('light needs a G1 that approved the light lane', async t => {
  const f = await lightProject(t);
  await f.put('approval.json', { gate: 'G1', storyHash: storyContract(story).fingerprint, responseRef: 'fixture:user-approved' });
  assert.match(f.cli('light', 'story.md', 'light.json').stderr, /lane/i);
});

test('light finds a standard run anywhere under .ai-workflow/runs, however the Story path is spelled', async t => {
  const f = await lightProject(t);
  f.ok('init', '-', '.ai-workflow/runs/std.json', 'story.md');
  assert.match(f.cli('light', './story.md', 'light.json').stderr, /standard run/);
});

test('only the footer Lane counts', async t => {
  const f = await lightProject(t);
  await f.put('story.md', story.replace('Owner: fixture owner\n', 'Owner: fixture owner\nLane: standard\n')
    .replace('- O1. Other operations.', '- O1. Other operations.\nLane: light'));
  assert.match(f.cli('light', 'story.md', 'light.json').stderr, /Lane: light/);
});

test('light review notes must live under .ai-workflow/evidence', async t => {
  const f = await lightProject(t);
  f.ok('light', 'story.md', 'light.json');
  await f.put('review.md', 'No findings.\n');
  assert.match(f.cli('review', 'light.json', '--verdict', 'pass', '--notes', 'review.md').stderr, /\.ai-workflow\/evidence/);
});

test('a Story moved up from light skips the baseline', async t => {
  const f = await graphProject(t);
  await f.put('story.md', story.replace('Owner: fixture owner\n', 'Owner: fixture owner\nLane: standard (from light: touches two modules)\n'));
  f.ok('init', '-', 'run.json', 'story.md');
  assert.match(f.cli('baseline', 'run.json').stderr, /moved up/);
  assert.equal(f.ok('begin', 'run.json', 'implement').node, 'implement');
});
