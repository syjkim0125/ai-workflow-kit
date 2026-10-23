# Prove the current Story against the running product

Read this at project setup and final verification, not at every node. The pinned Pstack [principle](pstack/principle-prove-it-works.md) and [recipe guide](pstack/create-verification-skill.md) supply evidence standards. The kit adapts the guide into a project recipe and profile, without installing another workflow/skill. Its full setup, teams and shipping are outside this integration.

For each Story V ID, describe the real user entry point, preconditions, action, expected state/side effect and failure path. Reuse a suitable existing test. Otherwise write a small executable checker that starts/drives the actual CLI/server/browser and asserts those observations. A server's successful startup alone does not prove its feature. No mocks beyond existing external boundaries. Missing prerequisites, unavailable environments and manual-only checks remain unverified and block executable delivery; never replace them with a convenient no-op.

## Project profile

Create `.ai-workflow/verification.json` (review it like executable code):

```json
{
  "version": 1,
  "inputs": ["src", "scripts/prove-feature.mjs", "package.json"],
  "checks": [
    {"id":"feature", "covers":["V1"], "argv":["node","scripts/prove-feature.mjs"], "timeoutMs":30000}
  ],
  "requiresG3": false
}
```

Use actual project paths and Story IDs. Commands run from the project root with `shell: false`, inherited host environment/permissions, closed stdin and a 30-second default timeout (maximum 300 seconds). Combined output over 10 MiB fails the check and retains truncated logs. Cleanup targets the command's process group on POSIX and its direct child on Windows; checkers must stop services they detach from that group. A check must assert its behavior and exit nonzero on failure. Shell operators are literal argv; put pipelines/server lifecycle in a reviewed checker script. This runner is not a security sandbox. Isolate risky prototypes in an existing worktree/container according to host policy before touching product code. Never give a checker production side effects merely to obtain proof.

Git snapshots include HEAD, index state, tracked bytes/deletions, executable modes and nonignored untracked files, plus explicit inputs. Non-Git projects must list all behavioral inputs explicitly, including dependencies/configuration/checkers; omitted inputs cannot be protected. The profile is independently fingerprint-bound and added to explicit inputs. Git-ignored files are included only when explicitly listed. Commit/stage before final verification, or rerun affected checks after those Git changes. External services, environment variables, installed dependencies and data are not fully captured; record versions/seed conditions and remaining boundaries in the recipe.

Keep generated run/result/log/approval files under `.ai-workflow/runs/`, `.ai-workflow/evidence/`, `.ai-workflow/approvals/`. These outputs are excluded; never put product source there. Keep checker-generated caches/builds Git-ignored, or make them declared stable inputs. Logs may contain secrets: keep them local, inspect/redact before intentionally sharing, never automatically upload/commit them.

## Bind human decisions

Compute the canonical Story hash with installed `storyContract` from `.ai-workflow/graph/workflow.mjs`; it excludes Status and G1/G3/G4 metadata lines. Add the existing gate line pointing to an approval JSON. Populate only after the real human decision:

```json
{"gate":"G1", "storyHash":"<canonical hash>", "responseRef":"<actual response reference>"}
```

For a design requiring G3, set `requiresG3: true` and `design: "docs/design.md"` in the profile; the G3 JSON additionally has `decisionHash` (SHA-256 of design bytes). Obtain the decision before initialization/implementation. Small changes need no G3. Risk declaration belongs to the approved scope and reviewed profile, not a keyword classifier.

G4 JSON additionally has the current Graph `snapshot` and `runId`; preserve prediction-before-reveal in `understanding-gate.md`. These bindings prevent accidental reuse; a host controlling repository files can forge records. They are not human identity authentication.

## Run and inspect

Start the final verification node, then execute every configured check intersecting its V scope. If several checks cover the same V, all are required; one convenient passing journey cannot replace another:

```bash
node .ai-workflow/bin/graph.mjs verify <run.json> workflow-verify <started-token> feature
```

Read `verification.passed`, exit code/signal/timeout, the actual stdout/stderr files, snapshot before/after and the asserted boundaries. CLI exit 0 reports successful collection, including a failing check. Empty logs are valid; the nonempty structured receipt captures the execution. Raw log hashes and receipts are rechecked. A failed execution cannot be overridden by result `passed: true`; reset the earliest affected node and re-execute after correction. Repeating a check in one attempt is rejected. Reset preserves attempt counts and fences late results; it does not immediately cancel an already running process, which remains timeout-bound. Stop/inspect host-owned workers before recovery.

Record the existing result JSON afterward. Review and final checks must reference the current code snapshot. `status` returns `stale` without rewriting saved state when code changed. Reset the earliest stale node, rerun descendants, and obtain G4 for the fresh snapshot. After real G4 run `graph.mjs delivery <run.json>`; document shape checks alone cannot establish delivery.

Legacy v1/v2 runs remain readable with `upgrade-required`. Stop old workers, retain artifacts/attempt history, and rerun checks/review in a new v3 run. Never import old `passed` flags as proof or reset budgets by renaming runs. Package 5.0 introduces this breaking persisted-format change; run format v3 is independent of the package version.
