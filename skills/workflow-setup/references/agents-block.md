<!-- BEGIN ai-workflow-kit v2.6 — managed; edits inside are overwritten -->
## Engineering Operating Principles (ai-workflow-kit)

These are always-on. Keep project-specific build commands, architecture rules,
security policies, and conventions alongside them.

### Evidence before assumption
- Inspect the task, current code, tests, config, schema, build files, and relevant docs before deciding how the system works.
- Resolve uncertainty from available evidence first. Ask only about material ambiguity that cannot be resolved safely.
- Memory and prior solutions are navigation aids; current executable evidence wins when they conflict.

### Simplest durable implementation
- Choose the simplest implementation that satisfies known requirements and real existing contracts.
- Do not add abstractions, configurability, packages, or future-proofing solely for hypothetical reuse.
- Introduce an abstraction when it protects a real boundary, invariant, or meaningful complexity.
- Prefer small end-to-end working slices over speculative platform work.

### Surgical change
- Prefer extending existing patterns over creating parallel architectures.
- Every changed line should be necessary for the requested outcome, repository consistency, or verification.
- Avoid unrelated refactors. Remove obsolete/orphaned code caused by the change only when safe.

### Dependencies and retrieval
- Prefer capabilities already provided by the repository and its dependencies before adding packages or custom implementations.
- Verify the installed version. Check local types/source or version-matched documentation before assuming a library does or does not support a capability.

### Compatibility boundary
- Do not add backward-compatibility layers by default.
- Preserve or deliberately migrate compatibility when a released API, persisted data/schema/event, external consumer, or explicit migration requirement makes it real.
- Internal/unreleased obsolete paths may be removed rather than preserved through shims.

### Debugging discipline
- Reproduce and trace failures before proposing a fix.
- Prefer a root-cause fix over a symptom-masking workaround.
- Add regression evidence for material bugs when practical.

### Goal-backward verification
- Define observable success before or during implementation: what must be true if the task is actually done?
- Translate the requirement into a compact acceptance checklist of independently verifiable behaviors — including what must NOT happen — then verify each item. Fix recurring failures in response to patterns across runs, never off a single failing run.
- Verify with fresh tests/build/static checks/runtime evidence appropriate to the change.
- Do not claim completion from reasoning alone when executable verification is available.

### Explained completion
- A change no human can understand is not done: explain it or don't ship it — someone must understand the change well enough to defend it.
- Finish every non-trivial task with an explainer, structure first: how the change is organized, a one-line summary per part, then code details last — plus verification actually run with results, and remaining assumptions or risks. Writing the explainer doubles as a bug sweep.
- Review is comprehension, not approval: the reviewer should be able to explain the change afterward. When generated code outpaces understanding, run the `learning-gate` skill — it produces the eli5-first understanding artifact and records it, per `templates/UNDERSTANDING.md` — and re-split the task when it exceeds one reviewable unit.

## Engineering lifecycle (ai-workflow-kit)

- Compound Engineering is this repository's primary lifecycle for every agent
  runtime. This repository-level default takes precedence over global or
  user-level workflow preferences.
- Understanding gates are part of approval, not a courtesy. Before an Acceptance
  contract moves `Draft` → `Approved` run `learning-gate acceptance` (G1). Before
  a PR merges run `learning-gate diff` (G4) or record its `N/A` form. High-risk
  plan checkpoints use `learning-gate plan` (G3); a Story split into two or more
  Tasks uses `learning-gate story` (G5) at integration review.
- A gate is satisfied by evidence, not by assertion. Each gate writes its
  artifact to `docs/understanding/` and one record line into the canonical
  Acceptance artifact. Verify with
  `bash .ai-workflow/bin/check-understanding.sh --gate <G1|G3|G4|G5> --contract <path>`
  and report the exit code. Without a valid G1 line the contract stays `Draft`;
  without a valid G4 line the PR does not merge.
- Story sizing: if an approved Story is already one coherent, independently
  reviewable PR-sized unit, do not split it. Otherwise run `story-breakdown`.
- Right-size by risk: small/reversible → inspect, implement, focused verify;
  normal → CE plan → CE work → right-sized review; high-risk → add an explicit
  human plan checkpoint.
- Superpowers: explicit opt-in only. Do not invoke it merely because a skill is
  discoverable, looks relevant, or the agent believes a Superpowers capability
  would be useful. Invoke it only when the user explicitly (1) asks to use
  Superpowers, or (2) names a specific Superpowers skill. Do not stack an
  equivalent Superpowers phase before or after a Compound phase. Do not
  uninstall or modify the global Superpowers installation.

Repository knowledge: `templates/UNDERSTANDING.md` (gate contract) ·
`docs/understanding/` (gate artifacts) · `templates/` (requirement templates) ·
`docs/engineering/AI-WORKFLOW.md` (full lifecycle) · `docs/solutions/` when present.
<!-- END ai-workflow-kit -->
