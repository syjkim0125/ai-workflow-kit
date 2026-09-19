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
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    edges: [{ from: 'A', to: 'C' }, { from: 'B', to: 'C' }],
  });
  const state = createRunState(graph);
  assert.deepEqual(getReadyNodes(graph, state).map((node) => node.id), ['A', 'B']);

  state.nodes.A.status = 'completed';
  assert.deepEqual(getReadyNodes(graph, state).map((node) => node.id), ['B']);

  state.nodes.B.status = 'completed';
  assert.deepEqual(getReadyNodes(graph, state).map((node) => node.id), ['C']);
});

test('executor runs ready nodes as a wave and joins on dependencies', async () => {
  const graph = createTaskGraph({
    id: 'join-example',
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    edges: [{ from: 'A', to: 'C' }, { from: 'B', to: 'C' }],
  });

  const result = await executeTaskGraph({
    graph,
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

  const second = await executeTaskGraph({ graph, runState: reset, runNode: async (node) => `${node.id}-fixed` });
  assert.equal(second.status, 'completed');
  assert.deepEqual(second.waves, [['B'], ['D']]);
});

test('planning graph fans out analysis and plan review before mediation', async () => {
  const graph = createPlanningGraph();
  const result = await executeTaskGraph({ graph, runNode: async (node) => node.id });

  assert.deepEqual(result.waves, [
    ['analyze-codebase', 'analyze-tests', 'analyze-risks'],
    ['planner'],
    ['critic', 'advocate'],
    ['mediator'],
    ['validate-graph'],
  ]);
});
