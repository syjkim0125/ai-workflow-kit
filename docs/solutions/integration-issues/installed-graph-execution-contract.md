---
title: Installed graph execution needs durable task identity and dispatch state
date: 2026-09-21
last_updated: 2026-09-23
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
