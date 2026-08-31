---
name: workflow
description: Use when a user requests a product or engineering change, especially from a vague feature idea, before planning, coding, or declaring delivery complete.
argument-hint: "[request | status | finish]"
---

# Workflow

Turn `$ARGUMENTS` into an approved, reviewable change without creating documentation debt.

## Non-negotiable gates

- Do not plan implementation or edit production code before the Story is `Approved` and G1 is recorded.
- Do not declare delivery complete or merge a non-trivial change before G4 passes.
- Requirements have one source of truth. AI context may be richer; copied requirements may not diverge.

## Route by current state

1. **No approved Story:** read `references/intake.md`. Use `assets/STORY.md`; ask only missing behavior questions and obtain G1.
2. **Approved, not implemented:** read `references/execution.md`. Read `references/domain-risks.md` only for relevant risk domains. Create a Task from `assets/TASK.md` only when one PR is not reviewable.
3. **Implemented or `finish`:** read `references/understanding-gate.md`; run G4 before completion.
4. **`status`:** report stage, blocking decision, evidence present, and the single next action.

Use the user's language. Keep each response focused on one decision. Surface assumptions and evidence boundaries. Never say “AI decided”; name the human-owned decision or mark it open.
