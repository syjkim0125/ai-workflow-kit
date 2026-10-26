---
title: Installed graph execution needs durable task identity and dispatch state
date: 2026-09-21
last_updated: 2026-10-26
category: integration-issues
module: Graph runtime and installer
problem_type: integration_issue
component: development_workflow
symptoms:
  - Graph code existed in the package but was unavailable after ordinary project installation.
  - Missing evaluations could pass and interrupted runs could report completion.
  - Unrecorded running readers allowed a writer to become ready.
  - Identical plans in different runs accepted each other's late results.
root_cause: missing_validation
resolution_type: code_fix
severity: high
tags: [graph, installation, task-identity, concurrency, evidence, recovery, role-graphs]
---

# Installed graph execution needs durable task identity and dispatch state

Current contract: new delivery/role runs use v3. The dated v1/v2 descriptions below are historical; those runs are read-only with `upgrade-required`. The initial v3 implementation merged in [PR #11](https://github.com/syjkim0125/ai-workflow-kit/pull/11). The October 26 recipe/deadline/review-allocation follow-up below is locally verified and pending integration; npm publication is not established by these checks.

## Problem

The repository's graph library and the installed workflow had different capabilities. Adding persistent execution exposed another gap: a task's readiness, execution attempt and result identity must agree before parallel work or recovery is safe.

## Symptoms

- A fresh `init` copied the skill and checker without the graph runtime; a package import example did not work in a project with no npm dependency.
- The old executor accepted an omitted evaluation, waited for entire batches, and mishandled an empty exception message.
- A pending task could already be executing in the host. Recording one reader could admit a writer while another reader was still active.
- Tokens bound only to graph/Story/node/attempt were identical in two separate runs of the same plan. A regression test observed the old result being accepted in the new run.

## What Didn't Work

- Source-only tests passed without exercising what installation actually made available.
- An `init/status/record/reset` protocol was insufficient: without `start`, persisted state could not distinguish available tasks from dispatched tasks.
- Fingerprints identified plan content but not a particular execution. They did not fence results from an older identical run.
- Treating Office as a replacement graph owner was an incorrect interpretation of the requested architecture. Office organizes roles and agent processes; the kit still executes the graph.

## Solution

Install the runtime, standalone wrapper and routing instructions through the existing managed-file transaction. Exercise a fresh project without `node_modules`, then test the packed tarball offline for both supported hosts.

Require a durable transition before work:

```text
pending → start (reserve and increment attempt) → running
running → record (explicit evaluation and evidence) → completed / failed
failed → reset affected descendants → pending with a new revision
```

Bind result tokens to a unique persisted `runId`, graph and Story fingerprints, node ID, attempt, revision and direct dependency state. Reject records for non-running tasks or stale tokens. Reset preserves attempt counts, so retries cannot silently evade the limit.

Use per-run exclusive locks and atomic replacement. Allow overlapping declared readers, serialize writers, and pass only direct dependency outputs plus explicit context. Final graph success returns G4 readiness, not human approval. Agents delegated by Office perform their assigned kit nodes instead of recursively starting full delivery workflows.

## Why This Works

Installation tests verify the shipped interface. A start reservation makes scheduler decisions reflect actual dispatch. A run ID separates execution identity from plan equality; attempt and revision changes reject stale work within the same run. Evidence hashes detect changed observations, while explicit evaluation prevents missing results from becoming implicit success.

These are workflow checks, not a security boundary against a host that can rewrite its own run file. Rejecting a late result does not undo filesystem or external side effects. Stop old workers before reset; isolate or serialize writers across separate runs.

## Prevention

- Test install, upgrade, removal and packed artifacts in disposable projects, including missing runtime files and ignored Git paths.
- Test two identical runs with the same task attempt; a token from one must fail in the other without modifying state.
- Test a newly ready writer while an unrelated reader is still reserved; it must remain blocked.
- Test failed lock acquisition and interrupted replacement without deleting another writer's lock or changing the original run.
- Keep deterministic validation separate from agent opinion. Require explicit evaluation and nonempty evidence, but do not claim file checks prove the observations true.
- Keep one controller for each run. Office integration must additionally verify real model execution, cancellation, cross-run isolation and actual human approval.

## Review follow-up: distinguish API policy from host enforcement

A two-agent critical/mediating review on 2026-09-22 found that the generic API and delivery CLI were easy to conflate. With the generic `executeTaskGraph`, a node already at three attempts can start a fourth time, and a `human` failure can leave independent work executable. These are generic semantics, not delivery-policy guarantees. The CLI separately enforces its three-start cap and human/replan routing. Keep these contracts explicit rather than changing the generic API to impose delivery rules on every consumer.

The review also found that intake instructions claimed G1 checks proved actual human approval. Corrected them to approval-record and artifact validation; the host must obtain the actual user's decision. Clarified the API guarantees in the shipped graph reference and Office handoff. Related graph and structure tests passed: 44/44. This verifies documentation compatibility and existing behavior, not live host enforcement.

Before committing, clarified role-local graph execution versus Office dispatch/result acceptance in both READMEs and the handoff. A separate role graph must stay linked to its assignment and target revision; its completion does not complete the delivery. Final verification passed all 120 tests, and a package dry run included both READMEs and the corrected shipped references.

Do not implement a worktree manager, tool-permission broker or parallel developer engine inside the kit merely to support Office workers. Office owns workspace isolation, cancellation, authoritative state and integration of changes. Before extracting a new public transition API from the CLI, require an actual consumer's dispatch, persistence and result-application contract; there is no current internal duplication that makes this extraction necessary by itself. The earlier broad enforcement proposal was narrowed accordingly. No runtime behavior changed in this follow-up.

## Role completion and conversation recovery

On 2026-09-23, the durable CLI gained bounded role runs without a second executor. The local run file owns kit transitions; Office owns the shared goal, assignments, collaboration, integration and real approvals. The earlier reference to Office owning authoritative state means these Office-level facts, not an independently advancing copy of each kit node.

Role completion must be distinct from delivery acceptance. A Reviewer can complete its work and return `needs_changes`; requiring every role to reach delivery G4 would recursively repeat planning, review and approval. Built-in role v2 runs return `role-complete` with the native submission instead. Assignment and source fingerprints bind that result to the agreed scope.

Questions preserve the current attempt but rotate the token when asked and again when answered. Otherwise, a pre-question worker result could finish work without considering the answer. Match question identity and token, record actual answer evidence, and reject duplicate replies. Bound question exchanges separately from failed implementation attempts.

Two regressions were reproduced during implementation and fixed before delivery:

- Resetting implementation after a failed downstream self-check initially omitted that check's feedback from the next input. Collect relevant failed descendant results, so the corrective attempt knows what failed.
- Status initially accepted a persisted Reviewer submission after its verdict was removed. Validate terminal role output during reads as well as writes; do not announce completion from a malformed saved result.

External feedback uses a current run token and evidence, resets only the affected subgraph and preserves attempt counts. Keep conversation evidence immutable across resets. Test a waiting reader alongside an independently finishing reader so conversation support does not break dependency joins.

The complete suite passed **139/139** after these fixes. This proves local installed CLI behavior for both hosts, not live Office collaboration or actual user acceptance. See [role contract](../../../skills/workflow/references/role-graphs.md) and [verification](../../understanding/role-graph-verification.md).

## Related Issues and Evidence

- [Implementation and verification evidence](../../understanding/installed-graph-evidence.md)
- [Graph execution protocol](../../../skills/workflow/references/graph-engineering.md)
- No prior `docs/solutions/` entry existed. GitHub issue lookup was attempted but unavailable because `api.github.com` could not be reached; no issue association is claimed.

## Execution proof must survive the workflow protocol

The October audit reproduced a misleading success: a real failing test log plus agent-supplied `passed: true` reached G4 readiness, and changing product code afterward did not invalidate it. Adding more prose asking the same agent to inspect its work would preserve that trust gap. Evidence-file integrity establishes which observation was submitted, not whether a product behaved correctly.

The locally verified v3 fix collects process results itself and binds receipts to the run, current task token, Story and actual code snapshot. Required V coverage and successful receipts are checked during both record and later reads (`src/graph/verification.mjs:62`, `src/graph/cli.mjs:68`). Snapshot changes produce a read-only `stale` result (`src/graph/cli.mjs:99`). G1 is bound to canonical Story content; conditional G3 binds the design; delivery additionally binds actual G4 response records to the final snapshot and run. These records prevent accidental reuse, not forgery by a host controlling the repository.

Two integration attempts exposed why proof must follow the existing recovery protocol:

- Keeping a receipt after a question rotated its token made the subsequent answer fail validation. Questioning now invalidates the current execution bindings while retaining files, so the answer resumes the same counted attempt but requires fresh checks (`src/graph/cli.mjs:202`). Token changes fence executable evidence as well as agent results.
- The first offline smoke fixture tried to reset implementation while final verification was still running. The scheduler correctly refused. A failed checker does not automatically finish the workflow node: record the failed evaluation first, then reset affected work. Weakening the running-descendant guard would have hidden a fixture error and allowed overlap.

An initial cleanup test also timed out before its child process wrote a PID under full-suite load. Increasing that test's startup allowance preserved the assertion that the owned child actually terminates; it did not relax product verification. A separate reproduced failure showed that collecting an invalid post-run snapshot could lose buffered logs. Logs are now saved before snapshot collection and a failed receipt retains the snapshot error. These failure observations matter more than another happy-path fixture.

The final cross-check also reproduced a coverage shortcut: two configured journeys shared V1, and running only the convenient passing one initially allowed completion. V coverage alone was insufficient. Every configured check intersecting the assigned V scope is now required, even when another successful check names the same V (`src/graph/verification.mjs:82`).

Prevention: when attaching a runner to an existing state machine, exercise failure → explicit failure record → reset → rerun, and question/answer token rotation, through the installed interface. Do not add a parallel completion/retry controller. Assertions still require review: a no-op checker can exit zero, non-Git input omissions evade freshness detection, and external environment changes are outside a file snapshot. Model metadata fixtures likewise prove preservation, not live dispatch or lower cost.

Fresh local verification passed 166 tests and the package dry run. The [project recipe](../../../skills/workflow/references/verification.md), [runner regressions](../../../test/verification.test.mjs) and [offline fixture](../../../test/fixtures/verify-tarball.mjs) define the reproducible boundary. Actual Office/provider dispatch and human identity authentication remain host responsibilities.

## Project procedures need binding, not another workflow

The October 26 review found that importing Pstack's prose did not connect a project's verification skill to Graph work. Pstack's useful contract is the project-specific procedure: Launch, Doctor, Drive, Evidence and Cleanup, with relevant feature entries. Reuse an adequate existing skill or guide rather than create another orchestrator. Profile `recipe` now supplies its path and byte hash to task inputs and receipts. Snapshot additional inputs include the profile, recipe and required design even when Git-ignored; helpers/features still require declared inputs. Internal required inputs must not satisfy the explicit product-input requirement for non-Git projects.

This boundary avoids two misleading fixes: injecting the complete recipe/map/log history into every prompt, or claiming a file hash proves the host invoked a skill. SP checks the fresh evidence from the same Graph execution. The real assertions and user-path coverage still require review. The [example skill](../../../examples/verification/verify-cli/SKILL.md) was read and its Doctor/Drive executed; offline fixtures exercised both installed hosts, including failure, recovery, receipt binding and product/recipe/feature-map freshness. This does not establish automatic skill selection by a live host.

The review also exposed a deadline assumption hidden by passing process-group tests: `close` can wait for pipes held by a descendant that escaped the group. A configured 1000ms check took about 3680ms in the new RED regression. Termination grace now ends collection with failed `outputIncomplete` evidence rather than waiting indefinitely or killing unrelated processes. Detached services remain the checker's cleanup responsibility. A separate regression showed that duplicate-check lookup must use own properties: inherited names such as `toString` are valid IDs, not existing receipts.

Review allocation belongs at the same host boundary. Default three workers is an adaptive operating policy, not a measured optimum. Main simplifies/aggregates, nested workers count in the same round, and incompatible skill fan-out uses bounded direct review. Graph task metadata communicates the policy; it cannot enforce unknown host dispatch calls. An obsolete test required a particular simplify instruction sentence; it was removed rather than rewritten to assert new wording. Installation/update preservation tests remain, and consumer-behavior scenarios live in EVALS. Neither document regexes nor JSON payload checks prove prompt compliance.

Fresh verification passed **175 tests**, the package dry run, and offline tarball execution for Codex and Claude. Review/simplification ran sequentially in the main context under the active no-delegation instruction, so independent review and real model-cost savings are not claimed. No lint/typecheck command is configured. Prevention: test owned process termination and output-stream completion separately, bind project procedure changes to freshness, and distinguish host policy from runtime enforcement before adding another agent layer.
