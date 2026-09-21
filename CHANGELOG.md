# Changelog

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
