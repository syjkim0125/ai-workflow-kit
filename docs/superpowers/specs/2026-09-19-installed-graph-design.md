# Installed graph execution

The user requested implementation of the structural review and the supplied video's useful ideas, with graph engineering available automatically after kit installation. This is the implementation brief; no additional approval is inferred for publishing or human gates.

## Design

- Keep the dependency DAG small. Replace the fixed eight-role planning ceremony with planning, review and deterministic validation. Host skills perform research as needed.
- Install the zero-dependency graph runtime and a local `node .ai-workflow/bin/graph.mjs` entry point for Codex and Claude. The host executes agent/tool work; Node manages plans, readiness, evidence and routing. No API key, daemon, arbitrary shell runner or new agent SDK.
- Use a persistent JSON run file. `init <plan.json> <run.json> <story.md>`, `status <run.json>`, `start <run.json> <node> <ready-token>`, `record <run.json> <node> <result.json>` and `reset <run.json> <node> <reason>` are the host protocol. A plan has observable node descriptions, Story M/V references and read/write access declarations. Start reserves a task durably and counts its attempt; records require the returned start token and an explicit boolean evaluation, a summary and existing nonempty project-relative evidence files.
- Validate G1 and Story shape at initialization and mutations. Bind the run to the Story's requirements content and graph fingerprint; changed requirements or graph require a new run. Gate/status metadata may change without invalidating requirements. Graph completion means ready for G4, never human approval or delivery.
- Route failed evidence to fix, replan or human decision. Exhausted attempts stop retry. Reset invalidates descendants while preserving unrelated completed work. Keep retry control outside the DAG; do not add cycles or auto-repeat side effects.
- Execute ready nodes as slots become available. Default to serial execution; explicit concurrency permits concurrent read-only nodes, with write/undeclared-access nodes exclusive. Pass direct dependency outputs and explicit context, not the entire run state.
- Bind task tokens to a unique run ID, graph/Story fingerprints, attempt, revision and dependency outputs. Reject late results from another run even when its plan is identical.
- Keep graph execution in the kit when Agent Office is present. Office assigns roles, launches agents and links communication; delegated agents execute only their assigned kit nodes. A separate role objective may use a bounded graph through the generic API, without repeating the full delivery envelope.
- Capture reusable lessons after resolved review and fresh verification, then retrieve them for related work. This is project knowledge, not model retraining.
- Strictly validate run statuses and graph identity. Interrupted running nodes must be explicitly reset. Never treat missing evaluation or an empty exception as success.
- Persist updates with exclusive locks and atomic replacement; reject path escape and symlinks. Preserve user-edited installed files and run/evidence files during update/remove.

## Verification

Regression tests cover unrelated slow work, joins, empty exceptions, stale/running states, failed evaluation and deterministic graph validation. Installed CLI tests cover both hosts without node_modules, evidence rejection, routing, bounded reset, independent preservation, G1, modified Story, concurrent writers and path safety. Verify install/update/remove/doctor, the full suite and an offline packed-tarball smoke test.

## Boundaries

Evidence files are recorded observations, not proof of human identity or automatic verification of their truth. Host instructions enforce G3/G4 and code ownership. The runtime conservatively serializes writers; isolated worktree coordination, automatic model invocation and distributed execution are outside scope.
