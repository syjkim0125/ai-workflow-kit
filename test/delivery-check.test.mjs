import assert from 'node:assert/strict';
import test from 'node:test';
import { graphProject, story } from './fixtures/graph-project.mjs';
import { digest } from '../src/graph/storage.mjs';
import { storyContract } from '../src/graph/workflow.mjs';

test('a new run cannot reuse G1 approval after changing Story requirements', async t => {
  const f = await graphProject(t);
  await f.put('story.md', story.replace('returns four', 'returns five'));
  assert.match(f.cli('init', '-', 'run.json', 'story.md').stderr, /G1.*binding/);
});

test('G3 is required only by declared design risk and bound to that decision', async t => {
  const f = await graphProject(t, { profile: { requiresG3: true, design: 'design.md' } });
  await f.put('design.md', 'Preserve rollback safety.');
  assert.match(f.cli('init', '-', 'run.json', 'story.md').stderr, /G3/);
  await f.put('story.md', story + '\nUnderstanding gate (G3): design-approval.json · 2026-10-21 · Check-in: accepted\n');
  await f.put('design-approval.json', { gate: 'G3', storyHash: storyContract(story).fingerprint,
    decisionHash: digest('Preserve rollback safety.'), responseRef: 'fixture:design-accepted' });
  f.ok('init', '-', 'run.json', 'story.md');
  await f.put('design.md', 'Different decision.');
  assert.match(f.cli('status', 'run.json').stderr, /G3.*binding/);
});

test('delivery requires Graph proof plus G4 bound to the final snapshot; gate metadata does not invalidate code', async t => {
  const f = await graphProject(t);
  const first = f.ok('init', '-', 'run.json', 'story.md');
  await f.put('story.md', story.replace('Approved', 'Delivered') + '\nUnderstanding gate (G4): final.json · 2026-10-21 · Check-in: accepted\nG4: PASS — Fixture human restatement.\n');
  await f.put('final.json', { gate: 'G4', storyHash: storyContract(story).fingerprint, snapshot: 'invented', runId: first.runId, responseRef: 'fixture:restatement' });
  assert.match(f.cli('delivery', 'run.json').stderr, /fresh.*verification/);
  await f.record('implement'); await f.record('workflow-review');
  const done = await f.record('workflow-verify');
  assert.match(f.cli('delivery', 'run.json').stderr, /G4.*binding/);
  await f.put('final.json', { gate: 'G4', storyHash: storyContract(story).fingerprint, snapshot: done.snapshot, runId: done.runId, responseRef: 'fixture:restatement' });
  assert.equal(f.ok('delivery', 'run.json').action, 'delivered');
  await f.put('app.mjs', 'export const add = () => 0;');
  assert.match(f.cli('delivery', 'run.json').stderr, /fresh/);
});

test('delivery rejects an ai-summary G4 when the run requires G3', async t => {
  const f = await graphProject(t, { profile: { requiresG3: true, design: 'design.md' } });
  await f.put('design.md', 'Preserve rollback safety.');
  const withG3 = story + '\nUnderstanding gate (G3): design-approval.json · 2026-10-21 · Check-in: accepted\n';
  await f.put('story.md', withG3);
  await f.put('design-approval.json', { gate: 'G3', storyHash: storyContract(story).fingerprint,
    decisionHash: digest('Preserve rollback safety.'), responseRef: 'fixture:design-accepted' });
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement'); await f.record('workflow-review');
  const done = await f.record('workflow-verify');
  await f.put('story.md', withG3.replace('Approved', 'Delivered')
    + 'Understanding gate (G4): final.json · 2026-11-12 · Check-in: accepted · Mode: ai-summary\nG4: APPROVED — owner approved the AI summary\n');
  await f.put('final.json', { gate: 'G4', mode: 'ai-summary', storyHash: storyContract(story).fingerprint,
    snapshot: done.snapshot, runId: done.runId, responseRef: 'fixture:approval' });
  assert.match(f.cli('delivery', 'run.json').stderr, /G3.*human restatement/);
});

const aiSummaryFooter = 'Understanding gate (G4): final.json · 2026-11-13 · Check-in: accepted · Mode: ai-summary\nG4: APPROVED — owner approved the AI summary\n';
const fourLines = ['1. change', '2. rule and failure', '3. tests', '4. unproven'];

test('delivery checks the ai-summary approval record itself', async t => {
  const f = await graphProject(t);
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement'); await f.record('workflow-review');
  const done = await f.record('workflow-verify');
  await f.put('story.md', story.replace('Approved', 'Delivered') + '\n' + aiSummaryFooter);
  const bound = { gate: 'G4', storyHash: storyContract(story).fingerprint, snapshot: done.snapshot, runId: done.runId, responseRef: 'fixture:approval' };
  await f.put('final.json', bound);
  assert.match(f.cli('delivery', 'run.json').stderr, /ai-summary/);
  await f.put('final.json', { ...bound, mode: 'ai-summary', summary: fourLines.slice(0, 3), approvalText: '승인' });
  assert.match(f.cli('delivery', 'run.json').stderr, /summary/);
  await f.put('final.json', { ...bound, mode: 'ai-summary', summary: fourLines, approvalText: ' ' });
  assert.match(f.cli('delivery', 'run.json').stderr, /approvalText/);
  await f.put('final.json', { ...bound, mode: 'ai-summary', summary: fourLines, approvalText: '승인' });
  assert.equal(f.ok('delivery', 'run.json').action, 'delivered');
});

test('delivery rejects a G4 record whose mode differs from the Story', async t => {
  const f = await graphProject(t);
  f.ok('init', '-', 'run.json', 'story.md');
  await f.record('implement'); await f.record('workflow-review');
  const done = await f.record('workflow-verify');
  await f.put('story.md', story.replace('Approved', 'Delivered')
    + '\nUnderstanding gate (G4): final.json · 2026-11-13 · Check-in: accepted\nG4: PASS — owner restated behavior and evidence\n');
  await f.put('final.json', { gate: 'G4', mode: 'ai-summary', summary: fourLines, approvalText: '승인',
    storyHash: storyContract(story).fingerprint, snapshot: done.snapshot, runId: done.runId, responseRef: 'fixture:approval' });
  assert.match(f.cli('delivery', 'run.json').stderr, /mode/);
});
