import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GraphValidationError,
  createPlanningGraph,
  createRunState,
  createTaskGraph,
  executeTaskGraph,
  getReadyNodes,
  resetAffectedSubgraph,
} from '../src/graph/index.mjs';

test('task graph rejects unknown references and cycles', () => {
  assert.throws(() => createTaskGraph({
    nodes: [{ id: 'A' }],
    edges: [{ from: 'A', to: 'missing' }],
  }), GraphValidationError);

  assert.throws(() => createTaskGraph({
    nodes: [{ id: 'A' }, { id: 'B' }],
    edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }],
  }), /DAG|cycle/i);
});

test('scheduler derives parallel work from dependencies', () => {
  const graph = createTaskGraph({
    id: 'parallel-example',
    nodes: [{ id: 'A', access: 'read' }, { id: 'B', access: 'read' }, { id: 'C', access: 'read' }],
    edges: [{ from: 'A', to: 'C' }, { from: 'B', to: 'C' }],
  });
  const state = createRunState(graph);
  assert.deepEqual(getReadyNodes(graph, state).map((node) => node.id), ['A', 'B']);

  state.nodes.A.status = 'completed';
  state.nodes.A.evaluation = { passed: true };
  assert.deepEqual(getReadyNodes(graph, state).map((node) => node.id), ['B']);

  state.nodes.B.status = 'completed';
  state.nodes.B.evaluation = { passed: true };
  assert.deepEqual(getReadyNodes(graph, state).map((node) => node.id), ['C']);
});

test('executor runs ready nodes as a wave and joins on dependencies', async () => {
  const graph = createTaskGraph({
    id: 'join-example',
    nodes: [{ id: 'A', access: 'read' }, { id: 'B', access: 'read' }, { id: 'C', access: 'read' }],
    edges: [{ from: 'A', to: 'C' }, { from: 'B', to: 'C' }],
  });

  const result = await executeTaskGraph({
    graph,
    maxConcurrency: 2,
    evaluateNode: () => true,
    runNode: async (node, { dependencies }) => ({ node: node.id, dependencies: Object.keys(dependencies) }),
  });

  assert.equal(result.status, 'completed');
  assert.deepEqual(result.waves, [['A', 'B'], ['C']]);
  assert.deepEqual(result.runState.nodes.C.output.dependencies, ['A', 'B']);
});

test('failed evaluation blocks descendants but keeps unrelated work', async () => {
  const graph = createTaskGraph({
    id: 'failure-example',
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
    edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'D' }],
  });

  const result = await executeTaskGraph({
    graph,
    runNode: async (node) => node.id,
    evaluateNode: async (node) => node.id === 'A' ? { passed: false, feedback: 'A is wrong' } : true,
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.failed, ['A']);
  assert.deepEqual(result.blocked, ['B', 'D']);
  assert.equal(result.runState.nodes.C.status, 'completed');
});

test('resetAffectedSubgraph preserves completed independent work', async () => {
  const graph = createTaskGraph({
    id: 'retry-example',
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
    edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'D' }, { from: 'C', to: 'D' }],
  });

  const first = await executeTaskGraph({
    graph,
    runNode: async (node) => node.id,
    evaluateNode: async (node) => node.id !== 'B',
  });
  assert.equal(first.runState.nodes.C.status, 'completed');
  assert.equal(first.runState.nodes.B.status, 'failed');
  assert.equal(first.runState.nodes.D.status, 'pending');

  const reset = resetAffectedSubgraph(graph, first.runState, ['B']);
  assert.equal(reset.nodes.A.status, 'completed');
  assert.equal(reset.nodes.C.status, 'completed');
  assert.equal(reset.nodes.B.status, 'pending');
  assert.equal(reset.nodes.D.status, 'pending');

  const second = await executeTaskGraph({ graph, runState: reset, evaluateNode: () => true, runNode: async (node) => `${node.id}-fixed` });
  assert.equal(second.status, 'completed');
  assert.deepEqual(second.waves, [['B'], ['D']]);
});

test('planning uses one planner and reviewer, with built-in deterministic validation', async () => {
  const graph = createPlanningGraph();
  const draft = { nodes: [{ id: 'implementation' }], edges: [] };
  const called = [];
  const result = await executeTaskGraph({ graph, evaluateNode: () => true, runNode: async (node) => {
    called.push(node.id);
    return draft;
  } });
  assert.equal(result.status, 'completed');
  assert.deepEqual(called, ['planner', 'review']);
  assert.equal(result.runState.nodes['validate-graph'].output.nodes[0].id, 'implementation');
});

test('planning rejects a non-graph output before the review can run', async () => {
  const result = await executeTaskGraph({ graph: createPlanningGraph(), evaluateNode: () => true,
    runNode: async () => 'not a graph' });
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.failed, ['planner']);
});

test('a freed slot starts its dependant without waiting for unrelated slow work', async () => {
  const graph = createTaskGraph({ nodes: ['A', 'B', 'C'].map(id => ({ id, access: 'read' })),
    edges: [{ from: 'A', to: 'C' }] });
  let releaseB;
  const heldB = new Promise(resolve => { releaseB = resolve; });
  const started = [];
  const running = executeTaskGraph({ graph, maxConcurrency: 2, evaluateNode: () => true,
    runNode: async node => { started.push(node.id); if (node.id === 'B') await heldB; return node.id; } });
  await new Promise(resolve => setImmediate(resolve));
  const beforeRelease = [...started];
  releaseB();
  await running;
  assert.deepEqual(beforeRelease, ['A', 'B', 'C']);
});

test('missing evaluation fails closed and empty exceptions remain node failures', async () => {
  const graph = createTaskGraph({ nodes: [{ id: 'A' }] });
  for (const options of [
    { runNode: async () => 'done' },
    { runNode: async () => 'done', evaluateNode: () => undefined },
    { runNode: async () => { throw new Error(''); }, evaluateNode: () => true },
  ]) {
    const result = await executeTaskGraph({ graph, ...options });
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.failed, ['A']);
    assert.ok(result.runState.nodes.A.error);
  }
});

test('persisted running or unknown statuses cannot be reported as completed', async () => {
  const graph = createTaskGraph({ nodes: [{ id: 'A' }] });
  for (const status of ['running', 'bogus']) {
    const state = createRunState(graph);
    state.nodes.A.status = status;
    await assert.rejects(executeTaskGraph({ graph, runState: state, runNode: async () => 'done', evaluateNode: () => true }), /running|status/i);
  }
});

test('changed graph with the same identifiers rejects old run evidence', async () => {
  const before = createTaskGraph({ id: 'same', nodes: [{ id: 'A', description: 'before' }] });
  const after = createTaskGraph({ id: 'same', nodes: [{ id: 'A', description: 'after' }] });
  await assert.rejects(executeTaskGraph({ graph: after, runState: createRunState(before),
    runNode: async () => 'done', evaluateNode: () => true }), /fingerprint|changed/i);
});

test('node inputs contain only explicit context and cloned direct dependencies', async () => {
  const graph = createTaskGraph({ nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ from: 'A', to: 'B' }] });
  const result = await executeTaskGraph({ graph, context: { story: 'approved' }, evaluateNode: () => true,
    runNode: async (node, input) => {
      assert.deepEqual(Object.keys(input).sort(), ['context', 'dependencies']);
      if (node.id === 'B') input.dependencies.A.value = 'mutated';
      return { value: node.id };
    } });
  assert.equal(result.status, 'completed');
  assert.equal(result.runState.nodes.A.output.value, 'A');
});

test('concurrent reads are allowed but writers run exclusively', async () => {
  const graph = createTaskGraph({ nodes: [
    { id: 'read1', access: 'read' }, { id: 'write', access: 'write' }, { id: 'read2', access: 'read' },
  ] });
  const active = new Set();
  const result = await executeTaskGraph({ graph, maxConcurrency: 3, evaluateNode: () => true,
    runNode: async node => {
      if (node.access === 'write') assert.equal(active.size, 0);
      else assert.ok(!active.has('write'));
      active.add(node.id);
      await new Promise(resolve => setImmediate(resolve));
      active.delete(node.id);
      return node.id;
    } });
  assert.equal(result.status, 'completed');
});

test('concurrency accepts only positive integers or Infinity', async () => {
  const graph = createTaskGraph({ nodes: [{ id: 'A' }] });
  for (const maxConcurrency of ['2', 1.5, 0, NaN]) {
    await assert.rejects(executeTaskGraph({ graph, maxConcurrency, runNode: async () => 'done', evaluateNode: () => true }), /maxConcurrency/);
  }
});

test('inconsistent persisted failure evaluations are rejected before execution', async () => {
  const graph = createTaskGraph({ nodes: [{ id: 'A' }] });
  for (const evaluation of [undefined, { passed: true }, { passed: false, action: 'ignore' }]) {
    const runState = createRunState(graph);
    Object.assign(runState.nodes.A, { status: 'failed', attempts: 1, evaluation });
    await assert.rejects(executeTaskGraph({ graph, runState, runNode: async () => 'done', evaluateNode: () => true }), /evaluation|action/i);
  }
});
