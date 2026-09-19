import { createTaskGraph } from './task-graph.mjs';

export function createPlanningGraph() {
  return createTaskGraph({
    id: 'planning-graph',
    nodes: [
      { id: 'analyze-codebase', type: 'analysis', role: 'codebase-analyzer', description: 'Map relevant code and boundaries.' },
      { id: 'analyze-tests', type: 'analysis', role: 'test-analyzer', description: 'Map existing verification and missing evidence.' },
      { id: 'analyze-risks', type: 'analysis', role: 'risk-analyzer', description: 'Identify domain invariants, failure paths, and risky changes.' },
      { id: 'planner', type: 'planning', role: 'planner', description: 'Generate a dependency graph, not a prose-only checklist.' },
      { id: 'critic', type: 'review', role: 'critic', description: 'Find missing dependencies, unsafe assumptions, and unnecessary work.' },
      { id: 'advocate', type: 'review', role: 'advocate', description: 'Make the strongest case for the draft plan and challenge over-correction.' },
      { id: 'mediator', type: 'decision', role: 'mediator', description: 'Reconcile critic and advocate into one execution graph.' },
      { id: 'validate-graph', type: 'validation', role: 'graph-validator', description: 'Validate node references and reject dependency cycles before execution.' },
    ],
    edges: [
      { from: 'analyze-codebase', to: 'planner' },
      { from: 'analyze-tests', to: 'planner' },
      { from: 'analyze-risks', to: 'planner' },
      { from: 'planner', to: 'critic' },
      { from: 'planner', to: 'advocate' },
      { from: 'critic', to: 'mediator' },
      { from: 'advocate', to: 'mediator' },
      { from: 'mediator', to: 'validate-graph' },
    ],
  });
}
