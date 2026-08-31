# Intake and Contract

## Internal Domain Frame

Derive before asking: actor, desired outcome, terms/entities, state change, invariant/forbidden outcome, failure, external side effect, and observable evidence.

## Question policy

- Ask **only blocking** unknowns that change behavior, ownership, or failure semantics.
- Ask one decision per turn by default; **at most three** independent, closely related questions.
- Stop after **two question rounds**. Draft with safe defaults labeled `ASSUMED`; keep unsafe gaps as `OPEN BLOCKING`.
- Never ask implementation or **HOW** questions before the contract is clear. Database, queue, lock, and file choices belong to planning.
- Offer a concrete default rather than an open questionnaire when a conventional safe choice exists.

## Output recipe

Create one Story from `../assets/STORY.md`:

1. Goal: actor + observable outcome.
2. Domain: terms and business invariants only.
3. MUST: numbered positive and negative behavior.
4. SHOULD: useful but non-blocking behavior.
5. OUT: explicit exclusions that prevent scope expansion.
6. Decisions: human choices, `ASSUMED`, and material open items.
7. Verify: V# cases mapped to M#; include success and failure.

Keep it one-screen by default. Do not copy it into an “AI spec.”

## G1 approval

Show the full concise draft and ask: “이 내용이 이번 구현의 범위와 완료 조건으로 맞나요?” End the turn. On explicit approval, save the approved snapshot and decision to `docs/understanding/<slug>-contract.md`, set `Status: Approved`, and record:

`Understanding gate (G1): <artifact> · <date> · Check-in: accepted`

Then verify instead of assuming: run `node .ai-workflow/bin/check.mjs story <story-file>`
and report the exit code. Exit 0 means the contract is well formed and G1 is valid; any
other exit names what is wrong. Do not start implementation on a non-zero exit, and never
claim the gate passed without that output.

No approval means no implementation.
