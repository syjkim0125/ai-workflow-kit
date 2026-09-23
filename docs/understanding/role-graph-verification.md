# Role graph verification

2026-09-23. Applies to the implementation in this branch. [Story](../role-graph-story.md) and [plan](../plans/2026-09-23-0000-role-local-graphs-plan.md) define the scope. Final user acceptance remains pending.

## Results

- `npm test`: **139 passed, 0 failed**. Log: `/tmp/role-graph-final-tests.log`.
- `npm pack --dry-run --ignore-scripts --json --cache /tmp/ai-workflow-kit-npm-cache`: passed. The package includes `src/graph/roles.mjs`, the shared CLI, the installed role guide and both READMEs. Manifest: `/tmp/role-graph-package.json`.
- `node bin/ai-workflow-kit.mjs check story docs/role-graph-story.md`: passed. G4 was explicitly not checked because the Story is not Delivered.
- `git diff --check`: passed.

## Acceptance coverage

| Story | Evidence |
|---|---|
| M1 / V1 | Installed Codex and Claude role runs for PM, lead, Developer and Reviewer finish with role-complete, preserve source and survive update. Existing delivery CLI tests still reach G4 readiness. |
| M2 / V2 | Tests reject draft implementation, invalid assignment/scope, changed source and assignment. PM accepts an unapproved request. Reviewer must name the assigned revision; Developer must identify its produced revision. |
| M3 / V3 | Each CLI call runs in a new process. Questions survive restart; wrong/duplicate replies and old results fail; answers preserve attempt count. Fourth question is rejected. |
| M4 / V4 | External feedback requires current token/evidence, resets affected work, retains attempts, supplies correction context and rejects active descendants. Independent completed evidence survives. |
| M5 / V5 | Installed role routing and command contracts are documented, README translations and Office prompt updated, all existing structure checks pass, package includes new references. |

## Test-first and review findings

The initial 11 role tests failed against the old CLI because init-role did not exist, then passed after implementation. Five conversation/feedback tests exposed missing transitions and context before their implementation. Focused regression tests separately failed for missing downstream failure context and malformed saved review outcomes, then passed with their fixes.

The first full run had one failure: the entry skill exceeded its existing 250-word limit. The entry text was shortened instead of raising the limit. The final full run above includes that correction and the saved-output validation fix.

Review was performed inline using correctness, simplicity, architecture, input safety and persistence checks. It was not an independent subagent review. Existing lock/atomic writes, evidence paths, stale tokens and per-run read/write scheduling are reused. No model provider, dependency, Office controller or generic scheduler change was needed. There is no second dispatch engine to keep synchronized.

Compound updated the existing integration lesson rather than creating a duplicate. Its reusable findings cover role completion versus acceptance, token rotation around questions, and correction feedback propagation.

## Limits

- Tests use disposable fixture observations/approvals. They do not prove an AI follows instructions, that evidence is true, or that a real user approved delivery.
- No Office repository was changed. Actual model collaboration, Office restart/cancel integration, global budgets and combined-result approval require Office validation.
- Revision strings are caller assertions; the host must bind them to actual files, including uncommitted changes.
- One pending question per run; questions are bounded separately from starts. Explicit human/replan/stop decisions still require resolved decisions and a new run.
- Old delivery v1 remains readable. New role v2 and question/feedback commands require this runtime; no downgrade or automatic in-flight migration is promised.
- Package version remains 4.0.0. Identify this artifact by its new commit or package hash, not an older tarball with the same version. npm publish and main merge remain user-owned.
