# Graph Engineering

Use a graph when the approved Story contains work that can be decomposed into meaningful dependent or independent outcomes. A graph is an execution model, not a second requirements source: Story M/V IDs remain canonical.

## Planning subgraph

```text
analyze-codebase ─┐
analyze-tests ────┼→ planner ─┬→ critic ───┐
analyze-risks ───┘           └→ advocate ─┼→ mediator → validate-graph
                                            └───────────┘
```

The three analyzers may run in parallel because they do not depend on each other. Critic and advocate independently inspect the same draft graph from opposing lenses; mediator reconciles both. `validate-graph` is deterministic and rejects missing node references, duplicate edges, self-edges, and dependency cycles.

## Execution graph

The planner emits nodes plus dependency edges. It does **not** prescribe a manual sequence when dependencies already express the order.

```text
A ─────→ C ──┐
             ├→ E
B ─────→ D ──┘
```

`A` and `B` are ready together, so the scheduler may run them in parallel. `C` waits for `A`; `D` waits for `B`; `E` waits for both `C` and `D`.

Each node should describe one observable outcome and, when relevant, reference the Story M/V IDs it satisfies. Agent count is not part of the contract. A node may be executed by an LLM agent, deterministic code, a test command, a reviewer, or a human-owned gate adapter.

## Runtime API

The package ships a zero-dependency Node runtime in `src/graph/`:

```js
import {
  createTaskGraph,
  executeTaskGraph,
  resetAffectedSubgraph,
} from '@pazmo/ai-workflow-kit/src/graph/index.mjs';

const graph = createTaskGraph({
  id: 'coupon-change',
  nodes: [{ id: 'model' }, { id: 'api' }, { id: 'tests' }],
  edges: [
    { from: 'model', to: 'api' },
    { from: 'api', to: 'tests' },
  ],
});

const result = await executeTaskGraph({
  graph,
  runNode: async (node, input) => runHostNode(node, input),
  evaluateNode: async (node, output) => evaluateEvidence(node, output),
});
```

The runtime infers ready nodes from dependencies and executes each ready wave concurrently by default. `maxConcurrency` can cap a wave.

## Failure and replan

If a node execution or evaluation fails, that node becomes failed and its descendants remain blocked. Independent completed work stays completed.

Use `resetAffectedSubgraph(graph, runState, [failedNodeId])` after the plan or implementation is corrected. It resets the selected node plus every descendant to pending while preserving unrelated completed nodes. Then run `executeTaskGraph` again with the returned run state.

Do not preserve old evidence when a changed ancestor invalidates it. Reset a broader subgraph whenever the new plan changes the assumptions of previously completed nodes.

## Human gates remain outside the generated graph

- **G1** approves the Story before implementation planning begins.
- **G3** remains mandatory for high-risk/hard-to-reverse decisions.
- **G4** remains the final human understanding gate after fresh verification.

Generated graphs may organize agent/tool work between those gates, but may not bypass or self-approve them.
