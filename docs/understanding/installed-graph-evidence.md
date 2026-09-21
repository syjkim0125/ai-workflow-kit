# Installed graph implementation evidence

Date: 2026-09-21

Scope: install and automatically route the workflow through graph execution; apply the structural review and supplied graph-engineering concepts. Preserve human gates and user-owned files. Agent Office continues to use kit graph execution while coordinating roles, processes and communication.

## Verified behavior

- Both host installations include the local Graph CLI and zero-dependency runtime. Repeated installation is stable; updates preserve edited files; removal retains run/evidence artifacts.
- Plans require valid dependencies, node contracts and Story M/V coverage. Planning uses planner/review/deterministic validation rather than a fixed eight-agent ceremony.
- Ready work starts without a global batch barrier. Readers can overlap; writers are exclusive within a run. Nodes receive direct dependency outputs instead of the entire state.
- `start` durably reserves a task and counts its attempt. Records require a matching unique-run/attempt token, explicit evaluation and nonempty evidence. Duplicate, stale, cross-run and premature records are rejected.
- Failures route to fix, replan, human decision or stop after three attempts. Reset invalidates affected descendants and preserves independent evidence. Interrupted workers require inspection and explicit reset.
- Completion means G4 readiness. The CLI does not change the Story to Delivered or generate human approval.

## Review and corrections

Sequential review covered correctness, API changes, concurrency/storage, installation ownership and simplicity. Material findings resolved during implementation:

1. Undefined evaluation and empty exceptions could produce invalid success/error behavior: explicit evaluation and nonempty failure handling added.
2. A validator agent label did not enforce a graph contract: deterministic validation added.
3. Pending host work was invisible to scheduling: explicit start/reservation added and tested.
4. Reset without a completed attempt could reuse a token: revision included in token identity.
5. Identical runs shared tokens: a new cross-run test failed first, then passed after unique `runId` binding.
6. Installed graphs ignored by Git were missed by doctor: runtime visibility checks added, using batched Git queries.

The three ce-simplify-code rubrics were performed in the main session under the user's sequential tool mapping. No additional simplification was justified. Digest helper consolidation across installer/runtime and caching evidence validation were rejected because they add coupling or weaken freshness. No independent-agent review is claimed.

## Fresh checks

| Check | Result |
|---|---|
| `npm test` | Exit 0; 120 tests passed, 0 failed |
| `npm pack --pack-destination /tmp --cache /tmp/ai-workflow-npm-cache --json` | Exit 0; prepack reran all 120 tests successfully |
| `node test/fixtures/verify-tarball.mjs /tmp/pazmo-ai-workflow-kit-3.1.1.tgz` | Exit 0; offline Codex and Claude installations passed init/update/doctor, graph execution to G4 readiness, preserved artifacts and removal |
| `git diff --check` | Exit 0 |

No lint or typecheck script is configured. The tarball fixture uses synthetic approval and node observations in disposable directories only; it tests packaging and state transitions, not a real model or human approval. Automated installed CLI cases separately exercise failure/fix/retry paths.

## Limits and delivery state

- Host instructions trigger automatic graph use in a new session; installation does not start a background model. Live Codex/Claude skill adherence was not evaluated here.
- Agent Office source, adapter, conversation UI and real-model end-to-end behavior were not inspected or implemented in this repository.
- Per-run locks do not isolate multiple runs editing one repository. Overall time/cost budgets and worker cancellation belong to the host/Office integration. The generic in-process API does not persist checkpoints.
- Evidence hashes detect modified files but do not establish the truth of an observation or the identity of an approver. G3/G4 remain human-owned.
- Graph API changes require callers to provide explicit evaluation and use current state fingerprints; callback input no longer includes the whole run state. See the 4.0.0 changelog.
- This evidence was first recorded before committing. Consult Git for the subsequent commit/push state; npm publication and main merge remain the user's responsibility. These checks do not establish live human G4 approval.

Reusable learning: [installed graph execution contract](../solutions/integration-issues/installed-graph-execution-contract.md).

## 4.0.0 release preparation

User selected 4.0.0. Package, both plugin manifests and marketplace versions agree. The tarball smoke fixture compares against the source package version instead of hardcoding 3.1.1.

Fresh `npm pack` prepack: 120 passed, 0 failed. Fresh offline `verify-tarball.mjs /tmp/pazmo-ai-workflow-kit-4.0.0.tgz`: both Codex and Claude passed installation, update/doctor, graph G4 readiness, artifact preservation and removal. Logs: `/tmp/graph-v4-pack.log`, `/tmp/graph-v4-smoke.log`. Source/packaging checks still do not establish live model or human-approval behavior.

See [repeatable graph verification](../graph-verification.md) and [Office handoff](../agent-office-handoff.md). The release preparation added no new durable reasoning beyond those documents and the existing learning; no duplicate Compound entry was created. Commit/push is authorized on the feature branch; npm publish/main merge remain with the user.
