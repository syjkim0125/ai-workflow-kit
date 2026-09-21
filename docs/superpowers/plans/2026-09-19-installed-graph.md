# Installed Graph Implementation Plan

**Goal:** Make the reviewed graph improvements usable through the normal kit installation and workflow.
**Spec:** `docs/superpowers/specs/2026-09-19-installed-graph-design.md`
**Architecture:** A reusable DAG runtime plus a persistent host-facing CLI. Installed skills automatically use the CLI between existing human gates.
**Constraints:** Node >=20, no dependencies, no publication, preserve user files and gates.

## Tasks

- [x] Runtime: add regression tests for ready-slot scheduling, strict evaluation, empty errors, interrupted/stale states, limited context and write exclusion. Run RED, implement in `src/graph/`, run GREEN. Reduce planning roles and execute deterministic plan validation.
- [x] Host protocol: test persistent init/status/record/reset with approved Story, nonempty evidence, bounded retry, changed-plan rejection, path safety and exclusive updates. Implement `src/graph/cli.mjs` and workflow contracts; report next actions without approving gates.
- [x] Installation: test both hosts with no node_modules; update installer ownership/transaction paths, doctor, package CLI and standalone wrapper. Verify idempotence, updates, modified-file preservation and removal retaining run artifacts.
- [x] Integration: update skill routing, execution/G4 references, example, README and changelog. Run a complete installed failure/fix/retry scenario and offline tarball smoke test.
- [x] Review and verification: sequential correctness/security/API/simplicity review per user's agent mapping, resolve findings, run full checks and capture reusable lessons with ce-compound.

## Review focus

1. Malformed persisted state must not become success.
2. Changing requirements or a graph must not reuse stale evidence.
3. Concurrent record operations must not lose state; locks must not disappear after a failed acquisition.
4. Installation updates/removal must not delete run artifacts or user edits.
5. A passed graph must never imply G3/G4 approval.

## Execution notes

The existing session contains the user's requested scope and explicit implementation authorization. Proceed locally without additional approval rounds; no commit, publish or remote action is part of this task. Run agent review lenses sequentially as requested in the supplied AGENTS mapping.

Review ruling: add an explicit start/reservation transition. Without it, a persisted pending reader can still be executing when status admits a writer; start also makes interruption recovery and attempt accounting truthful. Tokens change on start/reset and stale workers cannot record over a new attempt.

User clarification (2026-09-21): Office does not replace or disable kit graph execution. Office supplies role assignment, agent processes and collaboration; the kit supplies graph procedures and execution. Assigned agents use the existing kit node/run, not a duplicate full delivery workflow. Generic bounded role graphs remain available through the installed runtime; no Office service or adapter is implemented here.

Final review found identical task tokens across separate runs with identical plans. A regression test accepted an old result incorrectly (RED); a unique persisted run ID bound into task tokens fixed it (GREEN). No new dependencies or compatibility layer were added.

Simplification review: all three installed ce-simplify-code rubrics were applied sequentially in the main session per the user's tool mapping. Additional changes: reuse 0, quality 0, efficiency 0. Skipped 2 low-value changes: merging installer and runtime digest helpers would couple the installed runtime to package internals; caching graph/evidence validation would risk stale mutation checks. Existing shared evaluation normalization and scheduler remain the single implementations. No lint or typecheck scripts are configured.

Final verification (2026-09-21): `npm test` and prepack each passed 120/120 tests. Offline packed-tarball checks passed for Codex and Claude, including graph execution to G4 readiness and artifact preservation. `git diff --check` passed. Evidence: `docs/understanding/installed-graph-evidence.md`. Compound learning: `docs/solutions/integration-issues/installed-graph-execution-contract.md` (frontmatter validator exit 0). No project AGENTS.md/CLAUDE.md exists to update for discoverability. GitHub issue lookup failed due to unavailable network. No publication or Office integration E2E is claimed.
