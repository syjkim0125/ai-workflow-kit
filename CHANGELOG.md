# Changelog

## 5.3.0 — 2026-11-05

### Upgrade checks

- `init` names the running CLI version and the version recorded in `.ai-workflow/config.json`: `Installed AI Workflow Kit 5.2.0.`, `Updated AI Workflow Kit 5.0.3 → 5.2.0.`, or `AI Workflow Kit 5.2.0 is already up to date (installed 5.2.0).` It warns when the CLI is older than the install it replaced (a downgrade).
- `doctor` prints `Kit version: CLI …, installed …`. A CLI newer than the install warns and suggests `init`. A CLI older than the install fails: it cannot check a newer release's files, and its `init` would downgrade them.
- When the versions match, `doctor` warns about each managed file or directory whose content differs from that release (`Mixed version: <path> differs from <version>`), formatter passes included, and says to delete the path and re-run `init`.
- The `Preserved modified files` line from `init` now says the install mixes versions and how to take the new copy.
- README upgrade steps pin the exact version, check `--version` first, and show the `--registry=https://registry.npmjs.org/` override for projects whose `.npmrc` points at a private registry.
- Reason: on 2026-11-05 a project's `.npmrc` pointed at an unreachable private registry. `npx @pazmo/ai-workflow-kit@latest init` ran a cached 5.0.3, printed "already up to date" and changed nothing while 5.2.0 was published, and `doctor` passed. In two other projects a 3.1.1 → 5.2.0 `init` kept a prettier-formatted 3.1.1 checker next to the 5.2.0 skills, and `doctor` still passed.

### Evaluations

- `EVALS.md` adds manual scenarios for the 5.1 and 5.2 stage routing: a named change explored in intake, an open idea sent to `ce-brainstorm`, caller-owned `writing-plans`, and Superpowers review inside the review allocation.
- Removed the unused `test/fixtures/expected-managed-block.md`, which still described the old CE-default pipeline.

### Upgrade note

- No graph runtime file or role node changed since 5.2.0, so a run started under 5.2.0 continues after the upgrade.
- Upgrading from 5.0.x also brings the 5.1.0 and 5.2.0 changes below. The 5.1.0 upgrade note still applies: a role run started before the upgrade fails with `Role assignment or graph changed`; start a new role run.

## 5.2.0 — 2026-11-04

### Intake

- Intake explores alternatives itself. When the request names the change but behaviors still diverge, it shows two or three options with trade-offs and a recommended default as one question.
- CE `ce-brainstorm` runs only for an open idea (a goal or problem with no concrete change yet), when the user says they do not know what to build, or when the user selects it. The agent announces the choice, and the call returns its results to the kit without writing a separate spec or showing a handoff menu.
- The payment risk lens now asks for the rollback trigger of a changed price or charge rule, and what happens to charges already issued.
- Reason: in a local 9-run comparison on three named-feature requests, intake alone matched CE `ce-brainstorm` quality (mean 7.2 vs 7.0 of 10) at 41% of its token cost, and kept an unsettled payment item blocking where CE downgraded it. Superpowers `brainstorming` scored lowest in all three. Open-idea requests were not measured.

### Upgrade note

- 5.1.0 was not published to npm. Upgrading from 5.0.x to 5.2.0 also brings the 5.1.0 changes below, including its upgrade note: a role run started before the upgrade fails with `Role assignment or graph changed`; start a new role run.

## 5.1.0 — 2026-11-04

### Stage skills

- Plan with Superpowers `writing-plans` under a caller-owned contract: the plan returns to the kit, which skips the skill's Execution Handoff and names the kit graph as the executor.
- Review with Superpowers `requesting-code-review` (one reviewer per assignment in the shared allocation) or direct bounded review.
- CE `ce-plan` and `ce-code-review mode:agent` stay available when the user or host selects them. CE `ce-compound` still captures verified learning.
- Reason: in a local 20-run comparison on a small fixture, the Superpowers routes matched CE plan and review quality at 3.6–15× lower token cost.

### Fixed

- Pstack provenance names the official `cursor/plugins` repository (`pstack/` at `180939f`) instead of the `backnotprop/pstack` mirror. The bundled files are unchanged. `create-verification-skill.md` records its upstream hash and its harness-neutral skill-folder change.

### Upgrade note

- The team-lead and reviewer role nodes no longer name a tool, which changes their graph fingerprint. A role run started before the upgrade fails with `Role assignment or graph changed`; start a new role run.

## 5.0.3 — 2026-11-02

### Fixed

- The verification example prints plain output when a terminal forces color (`FORCE_COLOR`). Before this, `npm test` and the publish-time test run failed in color terminals.

## 5.0.2 — 2026-11-02

### Intake

- Read the domain risk lenses during intake, before G1, instead of only after approval.
- In Payment/money and data or system migration Stories, an unsettled lens item that changes behavior is `OPEN BLOCKING`, never `ASSUMED`.
- Extend the migration lens to system, vendor and provider switches: coexistence of old and new paths, cutover and rollback trigger, fail open or closed, which side wins when data disagree, and deploy order across teams.

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
