# Understanding Gate — required content

This template defines what a learning gate must produce. Like `ACCEPTANCE.md`, it
specifies **required content, not a mandatory destination file**: the artifact is
written by the `learning-gate` skill, and the record line goes into whichever
artifact is canonical for the work.

## Three-layer artifact

Every gate artifact has exactly these three layers, in this order:

| Layer | Content | Budget |
|-------|---------|--------|
| 1. ELI5 | One picture. Five sentences or fewer. Zero jargon. | 30 seconds |
| 2. Decision | Only what the human must actually decide at this gate. | 3 minutes |
| 3. Density | Runtime/data-flow order, invariants, failure paths, what is still unproven. | as needed |

Layer 1 is not optional and is not decoration. A reader who stops after layer 1
must still know what the work does to a user. If layer 1 cannot be written
without jargon, the work is not understood well enough to gate.

Format: a single self-contained HTML file at
`docs/understanding/<YYYY-MM-DD>-<slug>.html`. Keep the artifact in the
repository even when the canonical contract lives in Jira — the record line
points at a local path, and that path is what verification checks.

## G1 — acceptance contract gate

**When:** immediately after the Acceptance contract is written as `Draft`,
**before** asking the human to approve it.

**Mode:** `ce-explain` concept/idea.

**Layer 2 slots — all four, in this order:**

1. **What will definitely work after this** — MUST items, restated as observable behavior.
2. **What we are deliberately not doing** — negative behaviors and out-of-scope items.
3. **What I decided because you did not say** — the unspecified-policies register.
4. **How we will know it is done** — the deterministic verification approach.

Slot 3 carries the most weight. It forces decisions the agent made quietly into
the human's field of view. An empty slot 3 is a claim that nothing was
underspecified — make sure that is true before writing it.

**Check-in:** offer one Boundary exercise — *"name one case where this contract
does not apply."* A human who cannot answer is looking at an ambiguous contract:
the outcome is a contract revision, not an approval.

Offering the check-in is required. Accepting it is not — `ce-explain` states the
user may always decline and that a decline is final. Record `Check-in: declined`
honestly rather than re-asking.

**Applies to:** every Acceptance contract, regardless of size. A small contract
produces a short gate; the layer budgets scale on their own.

## G4 — implementation gate

**When:** after implementation and verification pass, before merge or PR.

**Mode:** `ce-explain` diff.

**Order is part of the contract:**

```text
1. Show the raw diff or its stat summary — zero commentary
2. Ask: "what does this change do, and why was it made?" — then END THE TURN
3. Reveal all three layers only after the prediction lands
```

Layer 1's picture is interpretation. Showing it before the prediction destroys
the mechanic — `ce-explain`'s check-in reference calls this "dead on arrival".

**Layer 2 slots — all three, in this order:**

1. **Gap against the prediction** — what it got right, what it missed, what it got wrong.
2. **PASS/FAIL per MUST from the G1 contract**, each with evidence.
3. **What each test proves, and what remains unproven.**

**Passing:** the human can restate the change, and the record line is written.

**Skipping:** when the diff is small enough to read at a glance, record
`Understanding gate (G4): N/A — <reason>` instead. This mirrors the existing
`Plan source: N/A — small reversible task` convention. A skip is still a record,
so it stays visible.

## G3 and G5 — conditional gates, no new slots

Neither gate defines new slots. They reuse the ones above and narrow the scope.
More templates means more to maintain, and an unmaintained template is noise
rather than enforcement.

- **G3 (high-risk plan checkpoint)** — apply the G1 slots to the plan document.
  Slot 3 earns its place here: it surfaces the implementation direction `ce-plan`
  chose quietly. Reference anything already settled at G1 with a single line
  instead of restating it. Only for high-risk / hard-to-reverse work.

- **G5 (Story Acceptance verdict)** — only when a Story was split into two or more
  Tasks. Per-Task G4 runs already covered the individual diffs, so do not explain
  them again. Narrow to one question: **does the integrated whole satisfy the
  contract?** Layer 2 carries PASS/FAIL per MUST plus the integration points no
  single Task owned — behavior that only appears at Task boundaries.

## Record line

Write one line per gate into the canonical Acceptance artifact. Exactly one of
these two forms:

```text
Understanding gate (G1): docs/understanding/2026-08-27-checkout-contract.html · 2026-08-27 · Check-in: accepted
Understanding gate (G4): N/A — one-constant change, 4-line diff
```

Grammar:

- Gate id is one of `G1`, `G3`, `G4`, `G5`.
- Separator is a middle dot `·` surrounded by single spaces.
- The path ends in `.html` and must exist in the repository.
- Date is `YYYY-MM-DD`.
- Check-in is `accepted` or `declined`.
- The N/A form uses an em dash `—` and requires a non-empty reason.

Verify with:

```bash
bash .ai-workflow/bin/check-understanding.sh --gate G1 --contract <path>
```

## Blocking rules

- No `G1` record line → the contract must not move from `Draft` to `Approved`.
- No `G4` record line (or its `N/A` form) → the PR must not merge.

These are checkable facts, not prose commitments. That is the point: an agent can
claim it explained something, but it cannot claim a file exists when it does not.
