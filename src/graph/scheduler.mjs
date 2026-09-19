import { dependencyIds, descendantIds, nodeById } from './task-graph.mjs';

const TERMINAL = new Set(['completed', 'failed']);

export function createRunState(graph) {
  return {
    graphId: graph.id,
    nodes: Object.fromEntries(graph.nodes.map((node) => [node.id, {
      status: 'pending',
      attempts: 0,
    }])),
  };
}

export function assertRunState(graph, runState) {
  if (!runState || runState.graphId !== graph.id || !runState.nodes) {
    throw new Error(`runState does not belong to graph: ${graph.id}`);
  }
  for (const node of graph.nodes) {
    if (!runState.nodes[node.id]) throw new Error(`runState is missing node: ${node.id}`);
  }
  return runState;
}

export function getReadyNodes(graph, runState) {
  assertRunState(graph, runState);
  return graph.nodes.filter((node) => {
    const current = runState.nodes[node.id];
    if (current.status !== 'pending') return false;
    const dependencies = dependencyIds(graph, node.id);
    return dependencies.every((dependencyId) => runState.nodes[dependencyId].status === 'completed');
  });
}

export function blockedNodeIds(graph, runState) {
  assertRunState(graph, runState);

  const memo = new Map();
  const hasFailedAncestor = (nodeId) => {
    if (memo.has(nodeId)) return memo.get(nodeId);
    const blocked = dependencyIds(graph, nodeId).some((dependencyId) => (
      runState.nodes[dependencyId].status === 'failed' || hasFailedAncestor(dependencyId)
    ));
    memo.set(nodeId, blocked);
    return blocked;
  };

  return graph.nodes.filter((node) => {
    const current = runState.nodes[node.id];
    return !TERMINAL.has(current.status) && hasFailedAncestor(node.id);
  }).map((node) => node.id);
}

export function resetAffectedSubgraph(graph, runState, nodeIds) {
  assertRunState(graph, runState);
  const affected = descendantIds(graph, nodeIds);
  const next = structuredClone(runState);
  for (const nodeId of affected) {
    nodeById(graph, nodeId);
    next.nodes[nodeId] = { status: 'pending', attempts: runState.nodes[nodeId].attempts ?? 0 };
  }
  return next;
}
