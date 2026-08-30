# Changelog

## v2.6 — 2026-08-28

### Distribution
- The kit is now a Claude Code and Codex plugin. Install once with `/plugin marketplace add syjkim0125/ai-workflow-kit` and `/plugin install ai-workflow-kit`; apply to a repository with `/workflow-setup`.
- Skills live in a single `skills/` directory. The Codex manifest points at the same directory (`"skills": "./skills/"`), so the `.claude/skills` ↔ `.agents/skills` mirror is gone — along with the rule that every skill edit had to be applied twice and the two `cmp` checks that policed it.
- New `workflow-setup` skill installs, updates, and removes the repo-local footprint. It writes exactly five things — a managed block in `AGENTS.md` and `CLAUDE.md`, `.ai-workflow/bin/`, `.ai-workflow/VERSION`, `templates/` and `docs/engineering/`, and `docs/understanding/` — and nothing else.
- The managed block is delimited by markers and content outside them is never touched. Unbalanced markers make the installer refuse and write nothing rather than guess. Re-running replaces the block instead of appending a second one, so a version bump updates in place.
- Repo-local writing is a tested script (`workflow-install.sh`), not prose. Idempotent block editing interpreted freshly each time is how someone's `AGENTS.md` gets mangled.

### Enforcement
- Hook-invoked scripts and the gate checker are installed into the repository at `.ai-workflow/bin/` rather than run from the plugin. Plugin cache paths are versioned, so a baked path breaks on every update — and `gate-guard.sh` exits 0 when it cannot find its checker, making that break silent. Keeping the checker in the repo also means CI, or a teammate without the plugin, can still verify a gate.
- `usage-handoff` had the identical defect: its hook baked `.claude/skills/usage-handoff/scripts/usage-guard.sh`, a path that only exists when the skill is copied into the repo. Its hook scripts move to `.ai-workflow/bin/` too.
- The eight always-on engineering principles stay always-on: they are carried verbatim inside the managed block, not demoted to a skill. They are dispositions rather than procedures — they have no trigger moment, so "load this when relevant" would put the decision to apply them back into discovery. `Explained completion` is also what mandates the gates in the first place, so moving it below them would invert the dependency.

### Repository
- `README.md` gains the full-flow layer: the eli5 picture shows the two gates, and a second diagram shows all fourteen steps and the four points where a human decides. The intake node no longer reads as the agent deciding alone — the kit's rule is to interview the requester, not to expand a request silently.
- `README-FIRST.md` rewritten: plugin installation replaces the manual file-copy tree, with a migration note for repositories absorbed the old way.
- The structure suite now installs into a throwaway repository and inspects the result, instead of checking the kit's own layout.
- `real-work/` is dissolved. Second Brain material moved to `docs/optional-v2/`.

## v2.5 — 2026-08-27

### Understanding gates
- Added `learning-gate` for both runtimes (`.claude/skills/learning-gate/`, `.agents/skills/learning-gate/`). It wraps Compound Engineering's `ce-explain` rather than reimplementing it, and borrows the `eli5` register as the mandatory first layer of every gate artifact.
- Every gate artifact is three layers with explicit time budgets: ELI5 (one picture, ≤5 jargon-free sentences, 30s), Decision (what the human must decide, 3min), Density (runtime/data-flow, failure paths, what is unproven).
- Gates placed on the existing risk axis rather than a new one: G1 before Acceptance approval (always), G4 before merge (skippable only as a recorded `N/A`), G3 at high-risk plan checkpoints, G5 at split-Story integration review. G2 and G6 deliberately have no gate.
- G4 uses `ce-explain`'s predict-then-reveal: the owner predicts what the diff does before any interpretation is shown, and the reveal names the gaps. Layer 1's picture is interpretation, so in diff mode it appears only after the prediction.
- New `templates/UNDERSTANDING.md` owns the layer contract, the per-gate slots, and the record-line grammar. The two skill mirrors stay thin so the sync burden does not grow.
- G1 slot 3 — "what I decided because you did not say" — forces the unspecified-policies register into the human's field of view before approval.

### Enforcement
- Gates are satisfied by evidence, not prose: an artifact under `docs/understanding/` plus one record line in the canonical Acceptance artifact. Missing G1 line blocks `Draft` → `Approved`; missing G4 line blocks merge.
- Added `check-understanding.sh`, a runtime-neutral checker that validates the record line and confirms the artifact file actually exists. Both runtimes run the single copy under `.claude/skills/learning-gate/scripts/`.
- Artifacts stay repo-local even when the canonical contract lives in Jira, so verification never depends on an external system.
- Added an opt-in, Claude-only `gate-guard` PreToolUse hook that wraps the same checker. It warns rather than blocks — a hook that misfires gets switched off, and a switched-off hook enforces nothing.
- Replaced the unactionable prose in `AGENTS.md` ("quiz yourself against the change") and `AI-WORKFLOW.md` ("have the agent explain the change…") with the command that does it.
- The structure test ships into consuming repos, where `README-FIRST.md` does not exist. Its two kit-only checks are reported as visible `SKIP` lines rather than failures, so an absorbing repo sees a clean run instead of a permanent red it cannot fix. (Summary line format is now `PASS n / FAIL n / SKIP n`.)
- `enable-gate-hook.sh` refuses to install when the repo root or contract path contains a character that cannot be safely embedded in the hook command (`"`, `$`, or a backtick), exiting 2 and writing nothing, rather than emitting a command that fails to parse.

### Repository
- Added `README.md` in the eli5 register as the landing page; `README-FIRST.md` keeps ownership of the full distribution instructions.
- Added structural consistency tests covering mirror parity and doc wiring — the kit's known failure mode is half-copied, drifted absorption.

## v2.4 — 2026-08-11

### Requirement intake and templates
- A one-line request is now a first-class entry point: the agent interviews the requester and co-writes verifiable acceptance criteria before classification/sizing (`AGENTS.md` lifecycle bullet + `AI-WORKFLOW.md` intake paragraph).
- New `templates/ACCEPTANCE.md`, generalized from a strong assessment-spec structure: MUST/SHOULD (SHOULD never compensates for missing MUST), negative behaviors, unspecified-policies register, verification enablement (deterministic failure forcing, reset mechanism, mock seams), documentation contract, environment assumptions.
- `templates/PRD.md` upgraded: TL;DR, [MUST]/[SHOULD] priorities with verifiable phrasing, measurable-only success signals, tracking plan. Deliberately did NOT add milestones/estimates or narrative sections.
- `templates/JIRA-STORY.md`: AC section now requires behavioral, independently verifiable items including negative cases.

## v2.3 — 2026-08-11

Merged two diverged lineages: the v2.2 "Superpowers routing hardening" release and a parallel Codex-parity/principles branch built on v2.1.

### Claude/Codex parity
- Moved the tool-agnostic lifecycle policy (CE primary, story sizing, risk gates, debug/learning conditions) from `CLAUDE.md` into a new "Engineering lifecycle (all agent runtimes)" section in `AGENTS.md`, so Claude Code and Codex receive the same routing. `CLAUDE.md` is now a thin adapter: import, slash-command mapping, global-override declaration, Superpowers coexistence.
- Mirrored `story-breakdown` into `.agents/skills/` for native Codex discovery; documented the sync rule.
- Repo-level routing now explicitly overrides user-global workflow-stack instructions.
- Marked `docs/product/PRD.md` references "when present"; added official Compound Engineering repo link plus `CODEX_HOME`/Codex App notes to `AI-SETUP.md`.

### Principles hardened against source talks (transcripts verified)
- Added "Explained completion" to `AGENTS.md`: explain it or don't ship it; structure-first explainer; comprehension tooling (explainer/quiz/disposable model) before shrinking diffs. (Geoffrey Litt, Notion)
- Added ownership split: agents run the inner loop and report evidence; humans own the outer loop including the verdict. (Addy Osmani)
- Added mid-flight re-split rule and acceptance-checklist bullet (including negative checks; fix failure patterns, never single runs). (Osmani; Google eval talk)
- Reframed Spike/Discovery as destination/fog exploration with typed unknowns and write-back. (Wayfinder)
- Recorded all five source videos in `AI-WORKFLOW-SOURCES.md`.

## v2.2 — 2026-08-10

### Superpowers routing hardening
- Made Superpowers **explicit opt-in only** for real-work repositories while preserving the global installation.
- Added the rule to both `AGENTS.md` and `CLAUDE.md` so project instructions override global skill discovery.
- Explicitly blocks automatic `using-superpowers`, brainstorming, planning, TDD, debugging, review, verification, and other Superpowers lifecycle invocation unless the user asks for Superpowers or names a specific Superpowers skill.
- Removed the ambiguous "unique capability" escape hatch that could let the agent self-select Superpowers.
- Kept Compound Engineering as the project default lifecycle and forbids stacking equivalent Compound/Superpowers phases.
- Updated `story-breakdown`, workflow, setup, and source documentation to use the same routing policy.
- Added requirement classification (Destination / Fog / Frontier) and an understanding gate for high-risk or large AI-generated diffs to `AI-WORKFLOW.md`; learning loop extended to skill `EVALS.md` pressure tests; parallel sessions isolated in git worktrees.
- Coding-test skill: propose a time budget across slices; report and pause for direction after each slice.

## v2.1 — 2026-08-10

### Repository knowledge routing
- Added the project retrieval index to `real-work/AGENTS.md`:
  - `docs/product/PRD.md`
  - `docs/engineering/AI-WORKFLOW.md`
  - `docs/engineering/AI-SETUP.md`
  - `templates/`
  - `docs/solutions/` when present
- Restructured workflow/onboarding docs under `real-work/docs/engineering/` so they can be absorbed directly into a project repository.

### Consistency fixes
- Replaced stale Superpowers-primary routing in `CLAUDE.md` with Compound Engineering as the project primary lifecycle.
- Kept globally installed Superpowers explicitly supported without requiring uninstall; overlapping lifecycle stages are not stacked automatically.
- Removed stale V1 Second Brain requirements; Second Brain remains optional V2 only.
- Fixed duplicate `description` frontmatter in `story-breakdown/SKILL.md`.
- Updated `story-breakdown` to first decide whether a Story is already PR-sized, use vertical outcomes, preserve atomic cross-service work in monorepos, and avoid duplicating `/ce-plan`.
- Updated setup guidance using current upstream Compound Engineering install commands for Claude Code and Codex.

## v2 — 2026-08-10

### Simplified real-work workflow
- Compound Engineering is the single primary engineering lifecycle.
- Superpowers is supported as an already-installed global plugin: keep it installed, but do not stack overlapping lifecycle stages by default.
- Second Brain moved from V1 prerequisite to optional V2.
- PRD changed from mandatory flow artifact to optional/right-sized requirement artifact.
- Human checkpoints are risk/reversibility-based rather than mandatory at every document transition.

### Added always-on engineering principles
- Added `real-work/AGENTS.md` with evidence-first reasoning, simplest durable design, surgical changes, dependency/docs retrieval, real compatibility boundaries, root-cause debugging, and goal-backward verification.
- `CLAUDE.md` is a thin Claude/Compound routing adapter importing `@AGENTS.md`.

### Story breakdown
- Skill first decides whether breakdown is needed.
- Already PR-sized Stories remain one task.
- Output is adaptive rather than always ceremony-heavy.
- Explicitly avoids duplicating Compound planning.
