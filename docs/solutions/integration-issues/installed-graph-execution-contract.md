---
title: Installed graph execution needs durable task identity and dispatch state
date: 2026-09-21
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
tags: [graph, installation, task-identity, concurrency, evidence, recovery]
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

## Related Issues

- [Implementation and verification evidence](../../understanding/installed-graph-evidence.md)
- [Graph execution protocol](../../../skills/workflow/references/graph-engineering.md)
- No prior `docs/solutions/` entry existed. GitHub issue lookup was attempted but unavailable because `api.github.com` could not be reached; no issue association is claimed.
