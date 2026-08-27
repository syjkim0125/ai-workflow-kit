# Engineering Operating Principles

These are always-on project principles. Keep project-specific build commands, architecture rules, security policies, and conventions alongside them.

## Evidence before assumption
- Inspect the task, current code, tests, config, schema, build files, and relevant docs before deciding how the system works.
- Resolve uncertainty from available evidence first. Ask only about material ambiguity that cannot be resolved safely.
- Memory and prior solutions are navigation aids; current executable evidence wins when they conflict.

## Simplest durable implementation
- Choose the simplest implementation that satisfies known requirements and real existing contracts.
- Do not add abstractions, configurability, packages, or future-proofing solely for hypothetical reuse.
- Introduce an abstraction when it protects a real boundary, invariant, or meaningful complexity.
- Prefer small end-to-end working slices over speculative platform work.

## Surgical change
- Prefer extending existing patterns over creating parallel architectures.
- Every changed line should be necessary for the requested outcome, repository consistency, or verification.
- Avoid unrelated refactors. Remove obsolete/orphaned code caused by the change only when safe.

## Dependencies and retrieval
- Prefer capabilities already provided by the repository and its dependencies before adding packages or custom implementations.
- Verify the installed version. Check local types/source or version-matched documentation before assuming a library does or does not support a capability.

## Compatibility boundary
- Do not add backward-compatibility layers by default.
- Preserve or deliberately migrate compatibility when a released API, persisted data/schema/event, external consumer, or explicit migration requirement makes it real.
- Internal/unreleased obsolete paths may be removed rather than preserved through shims.

## Debugging discipline
- Reproduce and trace failures before proposing a fix.
- Prefer a root-cause fix over a symptom-masking workaround.
- Add regression evidence for material bugs when practical.

## Goal-backward verification
- Define observable success before or during implementation: what must be true if the task is actually done?
- Translate the requirement into a compact acceptance checklist of independently verifiable behaviors — including what must NOT happen — then verify each item. Fix recurring failures in response to patterns across runs, never off a single failing run.
- Verify with fresh tests/build/static checks/runtime evidence appropriate to the change.
- Do not claim completion from reasoning alone when executable verification is available.

## Explained completion
- A change no human can understand is not done: explain it or don't ship it — someone must understand the change well enough to defend it.
- Finish every non-trivial task with an explainer, structure first: how the change is organized, a one-line summary per part, then code details last — plus verification actually run with results, and remaining assumptions or risks. Writing the explainer doubles as a bug sweep.
- Review is comprehension, not approval: the reviewer should be able to explain the change afterward. When generated code outpaces understanding, run the `learning-gate` skill — it produces the eli5-first understanding artifact and records it, per `templates/UNDERSTANDING.md` — and re-split the task when it exceeds one reviewable unit.

## Engineering lifecycle (all agent runtimes)
- Compound Engineering (CE) is this repository's primary engineering lifecycle for every agent runtime (Claude Code, Codex, and others). When this file is present, this repository-level default takes precedence over global or user-level workflow preferences.
- Ownership split: agents run the inner loop (investigate, implement, test, and report evidence — diffs, tests, logs, rationale); humans own the outer loop (product scope, architectural direction, hard-to-reverse decisions, and the verdict: judging evidence sufficiency and approving, redirecting, or owning what ships). Escalate outer-loop decisions instead of making them implicitly.
- Follow `docs/engineering/AI-WORKFLOW.md` as the operating lifecycle, not just background reading.
- Requirement intake: a one-line request is valid input. Interview the requester and co-write a verifiable acceptance contract (see `templates/ACCEPTANCE.md`) before classification, sizing, breakdown, planning, Jira publication, or implementation — never silently invent scope.
- Acceptance storage is right-sized, but approval is not optional. Keep one canonical contract in the Jira Story, PRD, unified plan Product Contract, or a dedicated document; mark it `Draft` until the requester explicitly approves the exact criteria and record the approval evidence. Request approval, scope-direction approval, and breakdown approval do not substitute for Acceptance approval.
- Understanding gates are part of approval, not a courtesy. Before an Acceptance contract moves from `Draft` to `Approved`, run `learning-gate acceptance` (G1). Before a PR merges, run `learning-gate diff` (G4) or record its `N/A` form. High-risk plan checkpoints use `learning-gate plan` (G3); a Story split into two or more Tasks uses `learning-gate story` (G5) at integration review. Slots and record-line grammar live in `templates/UNDERSTANDING.md`.
- A gate is satisfied by evidence, not by assertion. Each gate writes its artifact to `docs/understanding/` and one record line into the canonical Acceptance artifact. Verify with `bash .claude/skills/learning-gate/scripts/check-understanding.sh --gate <G1|G3|G4|G5> --contract <path>` and report the exit code. Without a valid G1 line the contract stays `Draft`; without a valid G4 line the PR does not merge.
- Story sizing: if an approved Story is already one coherent, independently reviewable PR-sized unit, do not split it. If it is too large for one reviewable PR, run the `story-breakdown` skill before implementation planning.
- Multi-Task Story delivery: land workflow-only changes on `main` first; merge prerequisite feature work into `main`; create the Story integration branch from that updated `main`; create each Task branch from the Story branch and target Task PRs back to it; target the final Story PR to `main` only after Story-level Acceptance review. Task completion is evidence, not the human Story verdict.
- Re-split mid-flight: if a task outgrows one coherent reviewable PR during implementation, stop and split rather than letting the diff grow past what a reviewer can genuinely understand. Generation speed must not outrun comprehension.
- Right-size the workflow by risk and reversibility:
  - small/reversible: inspect → implement → focused verify;
  - normal multi-step: CE plan → CE work → right-sized review → verify;
  - high-risk/hard-to-reverse: CE plan → explicit human plan checkpoint → CE work → deeper review/verification.
- Use CE debug for non-trivial bugs when root cause is not already established.
- Run CE compound only after verified work produced a non-obvious, reusable repo-local lesson. Present the candidate briefly and ask before persisting it.
- Invoke CE phases with your runtime's syntax (for example `/ce-plan`, `/ce-work`, `/ce-debug`, `/ce-compound` in Claude Code; the equivalent Compound Engineering skills installed in Codex).
- Superpowers: a globally installed Superpowers plugin may remain installed, but it is explicit opt-in only for this repository. Do not invoke it merely because one of its skills appears relevant or is globally discoverable — use it only when the user explicitly asks for Superpowers or names a Superpowers skill, and never stack equivalent Superpowers and CE phases.

## Skills
- `story-breakdown` ships in this repository for both runtimes: `.claude/skills/story-breakdown/` (Claude Code) and `.agents/skills/story-breakdown/` (Codex). The two copies are mirrors; when editing one, apply the same change to the other.
- `learning-gate` ships in this repository for both runtimes: `.claude/skills/learning-gate/` (Claude Code) and `.agents/skills/learning-gate/` (Codex). `SKILL.md` and `EVALS.md` are mirrors; the scripts are not — both runtimes run the single copy under `.claude/skills/learning-gate/scripts/`. It wraps the Compound Engineering `ce-explain` skill rather than reimplementing it.
- A runtime without skill discovery should read `.claude/skills/story-breakdown/SKILL.md` directly and follow it when its trigger applies.
- `usage-handoff` ships in this repository for both runtimes: `.claude/skills/usage-handoff/` (Claude Code) and `.agents/skills/usage-handoff/` (Codex). SKILL.md is mirrored; the scripts are not — both runtimes run the single copy under `.claude/skills/usage-handoff/scripts/`. Its usage-threshold warning hook is personal and opt-in (it reads your own quota with your own credentials), so it is not committed — see "Enabling the Automatic Warning" in that SKILL.md.
- If the `usage-handoff` warning hook is not enabled in this checkout (no `usage-guard` entry in `.claude/settings.local.json` or `.codex/hooks.json`), offer to enable it the first time the user raises usage, rate limits, or handing work off: ask which threshold percent they want (default 90), then run `bash .claude/skills/usage-handoff/scripts/enable-hook.sh --threshold <N>`. If they decline, do not raise it again in that session.

## Repository Knowledge

- Product intent and scope: `docs/product/PRD.md` when present (created from `templates/PRD.md` when the project adopts a PRD)
- Team AI development workflow: `docs/engineering/AI-WORKFLOW.md`
- AI tooling/onboarding: `docs/engineering/AI-SETUP.md`
- Requirement templates: `templates/`
- Understanding gate contract: `templates/UNDERSTANDING.md`
- Understanding gate artifacts: `docs/understanding/` when present
- Durable solved problems: `docs/solutions/` when present

Read the smallest relevant source for the task. Repository documentation helps navigation and intent; current code/tests/config remain authoritative for current system state.
