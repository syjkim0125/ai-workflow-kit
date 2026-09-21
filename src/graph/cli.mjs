import fs from 'node:fs/promises';
import { normalizeEvaluation } from './executor.mjs';
import { descendantIds, nodeById } from './task-graph.mjs';
import { resetAffectedSubgraph } from './scheduler.mjs';
import { readJson, readProjectFile, updateRun } from './storage.mjs';
import {
  MAX_ATTEMPTS, assertWorkflowRun, checkRunEvidence, createWorkflowGraph, evidenceHashes,
  newWorkflowRun, requireReady, storyContract, taskInput, taskToken, workflowStatus,
} from './workflow.mjs';

export const GRAPH_HELP = `Graph commands (run from project root):
  graph.mjs init <plan.json|-> <run.json> <story.md>
  graph.mjs status <run.json>
  graph.mjs start <run.json> <node-id> <ready-token>
  graph.mjs record <run.json> <node-id> <result.json>
  graph.mjs reset <run.json> <node-id> <reason>
Use - for a minimal plan. The host executes work; this tool validates state/evidence and routes the next action.`;

export async function runGraphCommand(args, { root = process.cwd(), checkArtifact, checkGate } = {}) {
  root = await fs.realpath(root);
  const [command, ...values] = args;
  if (!command || command === '--help') return { help: GRAPH_HELP };
  const counts = { init: 3, status: 1, start: 3, record: 3, reset: 3 };
  if (!Object.hasOwn(counts, command) || values.length !== counts[command]) throw new Error(GRAPH_HELP);

  const loadStory = async file => {
    const text = await readProjectFile(root, file);
    if (!/^Status:\s*(Approved|Delivered)\s*$/im.test(text)) throw new Error('Story must be Approved with accepted G1.');
    if (typeof checkArtifact !== 'function' || typeof checkGate !== 'function') throw new Error('Story checker is required.');
    for (const result of [await checkArtifact({ root, file, kind: 'story' }), await checkGate({ root, file, gate: 'G1' })]) {
      if (!result.ok) throw new Error(result.errors.join('\n'));
    }
    return storyContract(text);
  };

  const validate = async (run, { evidence = true } = {}) => {
    assertWorkflowRun(run);
    const contract = await loadStory(run.story.path);
    if (contract.fingerprint !== run.story.fingerprint) throw new Error('Story requirements changed; replan in a new run.');
    if (evidence) await checkRunEvidence(root, run);
    return run;
  };

  if (command === 'init') {
    const [planFile, runFile, story] = values;
    const contract = await loadStory(story);
    const plan = planFile === '-' ? undefined : await readJson(root, planFile);
    const graph = createWorkflowGraph(plan, contract.ids);
    const run = await updateRun(root, runFile, async () => newWorkflowRun(graph, story, contract), { create: true });
    return workflowStatus(run);
  }
  if (command === 'status') return workflowStatus(await validate(await readJson(root, values[0])));

  const [runFile, nodeId, argument] = values;
  const run = await updateRun(root, runFile, async previous => {
    // Work on a copy so the optimistic edit check still compares original bytes/data.
    const next = structuredClone(previous);
    await validate(next, { evidence: command !== 'reset' });
    nodeById(next.graph, nodeId);
    if (command === 'start') {
      requireReady(next, nodeId, argument);
      next.state.nodes[nodeId].status = 'running';
      next.state.nodes[nodeId].attempts += 1;
      next.history.push({ event: 'start', nodeId, at: new Date().toISOString() });
    } else if (command === 'record') {
      const result = await readJson(root, argument);
      if (result.token !== taskToken(next, nodeId)) throw new Error('Stale or missing task token; read fresh status.');
      if (next.state.nodes[nodeId].status !== 'running') throw new Error(`Node must be started before recording: ${nodeId}`);
      if (typeof result.output?.summary !== 'string' || !result.output.summary.trim()) throw new Error('Node output needs a summary.');
      const evaluation = normalizeEvaluation(result.evaluation);
      if (!evaluation.passed && (typeof evaluation.feedback !== 'string' || !evaluation.feedback.trim())) throw new Error('Failed evaluation needs feedback.');
      const hashes = await evidenceHashes(root, result.output.evidence);
      const current = next.state.nodes[nodeId];
      next.state.nodes[nodeId] = {
        status: evaluation.passed ? 'completed' : 'failed', attempts: current.attempts, revision: current.revision,
        output: result.output, evaluation, evidenceHashes: hashes,
        ...(!evaluation.passed ? { error: evaluation.feedback } : {}),
      };
      next.history.push({ event: 'record', nodeId, at: new Date().toISOString(), result: next.state.nodes[nodeId] });
    } else {
      if (!argument.trim()) throw new Error('Reset requires a reason.');
      const status = workflowStatus(next);
      if (['human', 'replan', 'stop'].includes(status.action)) throw new Error(`Cannot blindly retry ${status.action}; resolve the decision and create a new run.`);
      const affected = [...descendantIds(next.graph, [nodeId])];
      if (affected.some(id => id !== nodeId && next.state.nodes[id].status === 'running')) throw new Error('Stop running descendants before resetting their inputs.');
      if (affected.some(id => next.state.nodes[id].attempts >= MAX_ATTEMPTS)) throw new Error('Attempt limit reached; stop and inspect the evidence.');
      next.state = resetAffectedSubgraph(next.graph, next.state, [nodeId]);
      next.history.push({ event: 'reset', nodeId, affected, reason: argument, at: new Date().toISOString() });
      await checkRunEvidence(root, next);
    }
    return next;
  });
  return { ...workflowStatus(run), ...(command === 'start' ? { started: taskInput(run, nodeId) } : {}) };
}
