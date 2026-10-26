# Changelog

## 5.0.1 — 2026-10-26

### Verification

- Reuse project verification skills/guides across Stories through optional profile `recipe`. Bind its path and byte hash to task inputs and execution receipts; recipe edits invalidate prior review/verification.
- Include the profile, recipe and required design in snapshots even when Git-ignored. Non-Git projects still require explicit product inputs; declare helper and feature-map inputs separately.
- Add a runnable project verification skill and feature map following Pstack's Launch/Doctor/Drive/Evidence/Cleanup procedure. SP inspects the same Graph execution's fresh evidence, without another workflow or duplicate verification pass.

### Review

- Default normal review to three workers, adapt to 0–2 for small changes or 4–5 for named risks, and count internal workers in the same round. Main simplifies/aggregates; host dispatch enforces the budget.

### Fixed

- Bound output collection after termination grace when an escaped descendant keeps output pipes open. Incomplete collection fails verification.
- Accept valid check IDs such as `toString` and `hasOwnProperty` without mistaking inherited object properties for previous executions.

## 5.0.0 — 2026-10-23

### Breaking changes

- New delivery and role runs use persisted format v3. Existing v1/v2 runs remain read-only with `upgrade-required`; stop old workers, preserve evidence and attempt history, and run fresh review/verification in v3.
- New execution runs require a repository-owned `.ai-workflow/verification.json` profile and G1 JSON bound to the canonical Story. Declared G3 additionally binds the design decision; G4 delivery approval binds the final code snapshot and run.

### Verification

- Collect real argv execution results, stdout/stderr hashes, exits, signals and timeouts. Every configured check intersecting the assigned V scope must pass; submitted `passed: true` cannot override missing or failed executions.
- Bind review and verification to actual code snapshots; changed inputs produce read-only `stale` status. Reset and question/answer recovery invalidate old receipts and fence late results while retaining attempt counts.
- Add `graph verify` and `graph delivery`; document checks explicitly cover shape/gate presence rather than executable delivery.
- Bundle pinned Pstack verification principles, recipe guidance, feature-map references, provenance hashes and MIT notices. Superpowers remains the default verification procedure; the kit owns execution/evidence enforcement.
- Preserve host model-selection metadata with unknown actual models and usage kept unknown. Host dispatch, permissions, isolation and global budgets remain external responsibilities.


## 4.0.0 — 2026-09-21

- Compose focused Superpowers implementation/verification skills with CE planning, simplification, report-only review and verified learning capture. Install role-scoped instructions for both hosts, with capability fallback and host-budget boundaries; do not nest full workflows.

- Install a standalone Graph CLI/runtime for both hosts; automatically route approved workflow work through persistent dependency/evidence tracking.
- Add explicit node output/evaluation contracts, failure routing, bounded reset and stale-plan/evidence detection. Preserve human G3/G4 ownership.
- Replace the eight-role planning template with plan/review/deterministic validation. Start ready work when slots free; serialize writers and pass only direct dependency outputs.
- Reject missing evaluations, stale/interrupted states and malformed concurrency; handle empty execution errors as failures.
- Bind task tokens to unique runs and attempts, rejecting late results from other runs. Document Office role dispatch within kit-owned graph execution and verified learning capture.
- Graph API migration: explicit `evaluateNode` is required for agent work, default concurrency is 1, `runState` is no longer passed to callbacks, and legacy states without a fingerprint require a new run.

## 3.1.0 — release candidate

- Use `$workflow` in Codex and `/workflow` in Claude Code, including status/finish and new-session instructions.
- Keep package/plugin/marketplace versions aligned and add npm repository, homepage and issue metadata.
- Stage install and removal, preserve original files on failure, lock concurrent operations and recover interrupted transactions with validated backups.
- Add optional canonical Story → Jira publication API with preview-only CLI, G1 plus explicit publication authorization, stable identity, fail-closed retries and read-back verification. No bundled transport or credentials.
- Preserve both M1/V1 and M-1/V-1 without rewriting Story content; keep private gate metadata out of publication.

Version rationale: latest npm was 3.0.4 on 2026-09-08. Documentation/metadata/installer fixes alone would justify a patch, but the additive Jira API makes this a minor candidate. It has not been published. See [verification](docs/VERIFICATION.md) and [review](docs/understanding/workflow-kit-3-1-review.md).
