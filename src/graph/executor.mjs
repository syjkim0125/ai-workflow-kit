import { dependencyIds } from './task-graph.mjs';
import { assertRunState, blockedNodeIds, createRunState, getReadyNodes } from './scheduler.mjs';

function toErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeEvaluation(result) {
  if (result === undefined || result === true) return { passed: true };
  if (result === false) return { passed: false };
  if (!result || typeof result !== 'object' || typeof result.passed !== 'boolean') {
    throw new Error('evaluateNode must return boolean, { passed, ... }, or undefined.');
  }
  return result;
}

export async function executeTaskGraph({
  graph,
  runNode,
  evaluateNode,
  context = {},
  runState = createRunState(graph),
  maxConcurrency = Number.POSITIVE_INFINITY,
} = {}) {
  if (typeof runNode !== 'function') throw new Error('runNode must be a function.');
  if (evaluateNode !== undefined && typeof evaluateNode !== 'function') {
    throw new Error('evaluateNode must be a function when provided.');
  }
  if (!(maxConcurrency >= 1)) throw new Error('maxConcurrency must be at least 1.');

  assertRunState(graph, runState);
  const state = structuredClone(runState);
  const waves = [];

  while (true) {
    const ready = getReadyNodes(graph, state);
    if (ready.length === 0) break;

    const wave = ready.slice(0, Number.isFinite(maxConcurrency) ? maxConcurrency : ready.length);
    waves.push(wave.map((node) => node.id));
    for (const node of wave) {
      const current = state.nodes[node.id];
      current.status = 'running';
      current.attempts = (current.attempts ?? 0) + 1;
    }

    const results = await Promise.all(wave.map(async (node) => {
      const dependencies = Object.fromEntries(
        dependencyIds(graph, node.id).map((dependencyId) => [dependencyId, state.nodes[dependencyId].output]),
      );
      try {
        const output = await runNode(node, { context, dependencies, runState: structuredClone(state) });
        const evaluation = normalizeEvaluation(
          evaluateNode ? await evaluateNode(node, output, { context, dependencies }) : true,
        );
        return { nodeId: node.id, output, evaluation };
      } catch (error) {
        return { nodeId: node.id, error: toErrorMessage(error) };
      }
    }));

    for (const result of results) {
      const current = state.nodes[result.nodeId];
      if (result.error) {
        current.status = 'failed';
        current.error = result.error;
        continue;
      }
      current.output = result.output;
      current.evaluation = result.evaluation;
      if (!result.evaluation.passed) {
        current.status = 'failed';
        current.error = result.evaluation.feedback ?? 'Node evaluation failed.';
      } else {
        current.status = 'completed';
        delete current.error;
      }
    }
  }

  const failed = graph.nodes.filter((node) => state.nodes[node.id].status === 'failed').map((node) => node.id);
  const blocked = blockedNodeIds(graph, state);
  const pending = graph.nodes.filter((node) => state.nodes[node.id].status === 'pending').map((node) => node.id);
  const completed = graph.nodes.filter((node) => state.nodes[node.id].status === 'completed').map((node) => node.id);

  return {
    status: failed.length || pending.length ? 'failed' : 'completed',
    runState: state,
    waves,
    completed,
    failed,
    blocked,
  };
}
