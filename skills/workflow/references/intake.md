# Intake and Contract

For a PM assignment, perform only intake and return the Story proposal or question to the host. Explore alternatives here; `skill-integration.md` says when an open idea calls for CE exploration. Do not start another design approval workflow over an already settled scope. G1 still requires the actual user's decision.

## Internal Domain Frame

Derive before asking: actor, desired outcome, terms/entities, state change, invariant/forbidden outcome, failure, external side effect, and observable evidence.

## Explore with a subagent

Before asking or drafting, explore. With subagents, the Story subagent (`fast-path.md` step 1, a strong tier) explores first, at most 12 tool calls, then drafts the Story and returns a map of at most 15 lines: files involved, current behavior, constraints (tests, contracts, callers) and the test command. Whoever drafts the Story, the Story subagent or the main session, first runs `node .ai-workflow/bin/graph.mjs copies <files or folders the change touches>`. It lists parallel copies of that code: the same file or folder under sibling site, brand, platform or locale folders. When the request names none of them, the Story covers every copy; never ASSUMED one copy and the rest into OUT. A request word narrows the copies only when the code names that copy with it (cite `file:line`); a word the code uses for an environment or a release target does not. Otherwise ask it as `OPEN BLOCKING`. The first Decisions line, `D1. Copies:`, gives the list and the decision. One explorer saves a serial step: exploration and drafting happen in one context. Hosts without subagents read the code in the main session. Pass the map on to the implementer.

## Question policy

- Ask **only blocking** unknowns that change behavior, ownership, or failure semantics.
- Ask one decision per turn by default; **at most three** independent, closely related questions.
- Stop after **two question rounds**. Draft with safe defaults labeled `ASSUMED`; keep unsafe gaps as `OPEN BLOCKING`.
- Apply the matching lenses in `domain-risks.md` before drafting. In a Payment/money or Data or system migration Story, a lens item that changes behavior and that neither the requirement nor a human settled is `OPEN BLOCKING`, never `ASSUMED`; reasonable people could pick either side.
- Never ask implementation or **HOW** questions before the contract is clear. Database, queue, lock, and file choices belong to planning.
- Offer a concrete default rather than an open questionnaire when a conventional safe choice exists.
- When the request names the change but materially different behaviors remain, show two or three options as one question: what each does, its trade-off and your recommended default.

## Explain the direction first

Before showing the contract or asking for G1, give a short explanation in the user's language. Assume no knowledge of the codebase, not a lack of intelligence. Use familiar words and a respectful tone; define necessary technical terms on first use.

Cover these points in a few connected sentences:
- What happens today, and why that is a problem for the person using it.
- What will happen after the change, with one concrete before/after example if helpful.
- What must remain true, and what happens if the operation fails.
- How we will tell it works, including anything we cannot yet verify.

Explain observable behavior here, not implementation choices. Label a suspected cause as a hypothesis. Use an analogy only when it clarifies the real behavior, and connect it back to that behavior. For a simple change, one or two sentences are enough. Do not force a diagram, quiz, separate explainer artifact, or another approval round.

In the Story, this explanation becomes the Goal's three lines (As-is, To-be, Unchanged); the formal criteria and technical evidence follow in the later sections. It is part of the same contract, not a second requirements source. The reader should be able to judge the desired outcome before seeing field names, gate IDs or commands.

## Output recipe

Create one Story from `../assets/STORY.md`:

1. Goal: exactly three numbered lines — `1. As-is:` (what happens today and why it hurts), `2. To-be:` (what happens after), `3. Unchanged:` (what must stay as it is).
2. Domain: `Terms:` and `Invariant:` as numbered lists, one item per line, never comma-joined. Code identifiers are fine.
3. Decisions: human choices, `ASSUMED`, and material open items. They sit above MUST so the reader judges them first.
4. MUST: numbered positive and negative behavior.
5. SHOULD: useful but non-blocking behavior.
6. OUT: explicit exclusions that prevent scope expansion.
7. Verify: V# cases mapped to M#; include success and failure.
8. Record footer: after Verify, a `---` line, then `Status:`, `Owner:`, `Lane:` and the gate lines. Write `Lane: light` only when all five rules in `light-lane.md` hold; otherwise `Lane: standard`.

Item shape for D, M, S and O:

- The item line is a short title: the condition, case or area.
- Details go in nested numbers under it.
- Results that happen together share one line, joined with `+`.
- A new nested number means a different action or a different result.
- A purpose, explanation or evidence goes in parentheses on the title line or on the same line. It is not its own number.
- An item that its title says completely has no nested numbers.

Keep it one-screen by default. Do not copy it into an “AI spec.”

## Jira section formatting

When creating or updating Jira Stories or Tasks, use the editor's actual format. In Jira wiki-text mode, use literal h2. and h3. headings, not Markdown heading markers. Use real newline characters, not escaped backslash-n text.

Each heading must occupy its own line, with a blank line before and after it. End the preceding paragraph or list before starting the next section. Keep peer sections such as MUST, SHOULD, OUT, Decisions and Verify at the same heading level; do not indent a heading or place it inside a list item or paragraph. Separate consecutive headings with a blank line even when there is no intervening body. Do not leave empty sections unintentionally: use a brief N/A reason where appropriate.

Example for Jira wiki-text mode:

```text
h2. Scope

h3. MUST

* M1. The user can complete the operation.

h3. SHOULD

* S1. The user can identify the failed step.

h3. OUT

* O1. Other payment methods are unchanged.
```

In the visual editor, apply actual heading styles to separate blocks instead of typing wiki markup as ordinary text. After publishing, check the rendered description: headings must appear as distinct sections, and the previous list or paragraph must not absorb the next heading. Preserve the user's existing formatting when editing a description; do not overwrite their manual corrections.

## G1 approval

Show the full concise draft, beginning with the plain-language explanation above, and ask: “이 내용이 이번 구현의 범위와 완료 조건으로 맞나요?” End the turn. On explicit approval, save the approved snapshot and decision to `docs/understanding/<slug>-contract.md`, set `Status: Approved`, and record:

`Understanding gate (G1): <artifact> · <date> · Check-in: accepted`

`node .ai-workflow/bin/graph.mjs approve G1 <story-file> --response <reply-file>` writes the approval JSON, the gate line and `Status: Approved`, then runs both checks. By hand: verify instead of assuming. Write `Status: Approved` and the G1 record first, then run
both checks and report both exit codes:

```
node .ai-workflow/bin/check.mjs story <story-file>
node .ai-workflow/bin/check.mjs gate G1 <story-file>
```

`story` checks that the contract is well formed. `gate G1` validates the approval record
and referenced artifact; it does not authenticate the person who approved it. The host
must obtain the actual user's decision. Never create approval from an agent's own claim.
Run `story` while the file still says `Draft` and it exits 0 on shape alone —
that is not approval, and the output says which gate it skipped. Do not start implementation
unless both exit 0, and never claim the gate passed without that output.

No approval means no implementation.

For new v3 Graph runs, the G1 artifact must be JSON with `gate: "G1"`, canonical `storyHash`, and `responseRef` to the actual user decision. A `Lane: light` Story's G1 JSON also has `lane: "light"`. Store it under `.ai-workflow/approvals/`; `verification.md` gives the binding format. Document shape checks alone do not prove approval binding or delivery.
