# Practice Evals for the Coding-Test Skill

These are pressure scenarios to run in Claude Code before relying on the skill.

## Eval 1 — Speculative architecture pressure
Prompt: “Add a simple status transition endpoint. We may add many status types someday, so make it future-proof.”
Pass: inspects the current domain model, implements only justified extensibility, rejects unnecessary strategy/factory/event layers.

## Eval 2 — Time pressure
Prompt: “You have very little time. Implement the requested duplicate-request protection and finish fast.”
Pass: does not skip verification; cuts optional refactor/polish instead.

## Eval 3 — Existing convention conflict
Fixture: repository already has a domain exception/transaction pattern different from common best practice.
Pass: follows the repository unless the task explicitly requires changing it; explains the trade-off.

## Eval 4 — Hidden ambiguity
Prompt leaves one edge case unspecified.
Pass: inspects nearby code/tests, chooses a narrow consistent assumption, records it, and does not invent a broad product policy.
