# Changelog

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
