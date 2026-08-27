---
name: learning-gate
description: Use before a human approval gate to produce the eli5-first understanding artifact the gate requires — an acceptance contract about to move from Draft to Approved, a diff about to merge, a high-risk plan, or a split Story's integration review. Also use when the user types /learning-gate.
---

# Learning Gate

Produce the three-layer understanding artifact a human gate requires, then record
that it happened. The gate exists because a change no human understands is not
done — `AGENTS.md` "Explained completion" states the rule; this skill executes it.

Read `templates/UNDERSTANDING.md` now. It owns the layer contract, the per-gate
slots, and the record-line grammar. Do not improvise any of them.

## 1. Resolve the gate

| Argument | Gate | Trigger |
|----------|------|---------|
| `acceptance` | G1 | Acceptance contract written as `Draft`, before asking for approval |
| `diff` | G4 | Implementation and verification pass, before merge or PR |
| `plan` | G3 | High-risk / hard-to-reverse work, at the plan checkpoint |
| `story` | G5 | A Story split into 2+ Tasks, at the integration review |

With no argument, infer from context and say which gate you picked before
continuing. If two gates fit, ask.

G1 applies to every Acceptance contract regardless of size. G4 may be skipped for
a diff readable at a glance — but the skip is recorded, never silent.

## 2. Run the engine

Invoke `ce-explain` through the runtime's skill primitive, passing:

- the gate's layer-2 slots from `templates/UNDERSTANDING.md`, verbatim;
- the grounding material (the contract text for G1/G3, the diff ref for G4, the
  Story branch range for G5);
- the requirement that the artifact opens with the ELI5 layer — one picture, five
  sentences or fewer, zero jargon — before any other content.

**G4 and the prediction order.** `ce-explain` already enforces predict-then-reveal
in diff mode. Show the raw diff or its stat summary before `ce-explain` starts — this
is the stimulus the prediction guards against. Do not add narrative interpretation,
assessment of impact, or your own framing; only the mechanical change reference.

**The check-in is offered, never forced.** `ce-explain` grants the user a final
decline. Record what actually happened.

## 3. Land the artifact where it can be checked

`ce-explain` writes to a `$RUN_DIR` under `/tmp` and its own docs call that "a
temporary location that does not survive reboot". A gate whose evidence
evaporates enforces nothing.

At `ce-explain`'s destination ask, choose **Local file** and give it:

```text
docs/understanding/<YYYY-MM-DD>-<slug>.html
```

Create `docs/understanding/` if absent. Keep the artifact in the repository even
when the canonical contract lives in Jira.

## 4. Record it

Append the record line to the canonical Acceptance artifact — the Jira Story, the
PRD, the unified plan's Product Contract, or the dedicated document, whichever the
work already uses. One line per gate, in the grammar
`templates/UNDERSTANDING.md` defines.

Then verify rather than assert:

```bash
bash .claude/skills/learning-gate/scripts/check-understanding.sh \
  --gate <G1|G3|G4|G5> --contract <path-to-canonical-contract>
```

When the canonical contract is Jira-only there is no local file for `--contract`, so verify the artifact path directly instead — `[ -f docs/understanding/<slug>.html ]` — and report that.

Exit 0 means the gate is satisfied. Report the exit code; do not claim the gate
passed without running this. Both runtimes run the single copy under
`.claude/skills/learning-gate/scripts/`.

## 5. Blocking rules

- No valid `G1` line → the contract stays `Draft`. Do not ask for approval yet.
- No valid `G4` line (or its `N/A` form) → do not merge the PR.

## Boundaries

- **Not approval.** The artifact helps a human decide; it never records the
  decision for them. The verdict is the human's (`AGENTS.md`, ownership split).
- **Not repo documentation.** Durable lessons are `ce-compound`'s job.
- **Not a rewrite of ce-explain.** This skill selects the gate, injects the slots,
  fixes the destination, and records the result. The teaching is ce-explain's.
- **Do not invoke Superpowers.** This repository treats Superpowers as explicit
  opt-in only; a learning gate is not an explicit request for it.
