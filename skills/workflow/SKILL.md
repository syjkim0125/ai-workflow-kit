---
name: workflow
description: Use when a user requests a product or engineering change, especially from a vague feature idea, before planning, coding, or declaring delivery complete.
argument-hint: "[request | status | finish]"
---

# Workflow

Invoke in Codex with `$workflow`; in Claude Code with `/workflow`. Start a new session after installation/updates.

Turn `$ARGUMENTS` into an approved change. For assigned roles, follow `references/role-graphs.md` and `references/skill-integration.md`: reuse the supplied run/node/token or automatically initialize `init-role`. Do not restart delivery.

Before model dispatch, apply `references/model-selection.md` using the host's available models.

## Non-negotiable gates

- Do not plan implementation or edit production code before the Story is `Approved` and G1 is recorded.
- Do not declare delivery complete or merge non-trivial changes before G4 passes.
- Requirements have one source of truth; copies must not diverge.

## Explain before asking

Before G1/G3, explain the problem, change, safety rule and verification plainly. G4: `ai-summary`; `human-restatement` for G3 Stories.

## Route by current state

1. **No approved Story:** follow `references/fast-path.md` steps 1–3. Risk lenses: `references/domain-risks.md`; open ideas and question rules: `references/intake.md`.
2. **Approved, not implemented:** `references/fast-path.md` steps 4–8, both lanes. G3, custom plans or roles: `references/execution.md`, `references/graph-minimal.md`, `references/light-lane.md`.
3. **Implemented or `finish`:** `references/fast-path.md` step 9; `human-restatement` per `references/understanding-gate.md`.
4. **`status`:** run the existing graph's `status` command; report stage, blocking decision, evidence and next action. Without a run, report the Story stage.

Use the user's language. State assumptions, evidence limits and human-owned decisions.
