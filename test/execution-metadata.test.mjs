import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeExecutionMetadata } from '../src/graph/execution-metadata.mjs';
import { graphProject } from './fixtures/graph-project.mjs';

test('unknown host model and usage stay unknown, not confirmed or free', () => {
  const value = normalizeExecutionMetadata();
  assert.equal(value.selection, 'unknown');
  assert.equal(value.actualModel, null);
  assert.equal(value.confirmation, 'unknown');
  assert.equal(value.usage, null);
  assert.throws(() => normalizeExecutionMetadata({ selection: 'delegated', requestedModel: 'small', actualModel: 'small', confirmation: 'confirmed', effort: null, usage: null, reason: 'bounded extraction' }), /metadataRef/);
});

test('host model/usage evidence is preserved in the existing task output', async t => {
  const f = await graphProject(t);
  f.ok('init', '-', 'run.json', 'story.md');
  const task = f.start('implement');
  const execution = { selection: 'delegated', requestedModel: 'host-small', actualModel: 'host-small', confirmation: 'confirmed',
    effort: 'low', reason: 'bounded task with deterministic checks', metadataRef: 'fixture:host-dispatch-1',
    usage: { inputTokens: 100, outputTokens: 50, cost: null, source: 'fixture:host-dispatch-1' } };
  const recorded = await f.result(task, { passed: true }, { execution });
  assert.equal(recorded.status, 0, recorded.stderr);
  const run = JSON.parse(await (await import('node:fs/promises')).readFile(`${f.root}/run.json`));
  assert.deepEqual(run.state.nodes.implement.output.execution, execution);
});
