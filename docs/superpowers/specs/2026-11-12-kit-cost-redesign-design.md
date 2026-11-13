# Kit cost and time redesign

- Date: 2026-11-12
- Status: approved by the owner (2026-11-12)
- Scope: ai-workflow-kit 5.4.0 (minor). Phase 2 (measuring `ce-compound` lessons) gets its own design after this one ships.

## 1. Intent and why

The kit's value, in the owner's words: a Story is written, the plan is followed faithfully, the work is verified, and the result is done well. People read the Story and the verification results and use them to give correct instructions. That part must stay.

An internal A/B/C evaluation measured the price of that value. Six historical tasks were rerun by vanilla Claude Code (A), Claude Code with superpowers (B), and Claude Code with superpowers and kit 5.3.0 (C). The main model was the same for all three. The evaluation ran 21 of 30 planned runs. The kit arm cost a lot more for equal objective correctness:

- Behavior tests passed in every run, so the three arms tied on that measure.
- The blind checklist favored the kit a little: A 84%, B 88%, C 92%. In pairwise comparison C won 12, tied 0 and lost 2.
- Median cost per run: A 0.69 USD, C 4.40 USD (about 6×). Median time: A 1.8 min, C 18.0 min (about 10×).
- On the one large task, C cost 5.0× A and took 4.9× as long.

Where the kit run spends it, averaged over seven C runs:

| | A | C |
|---|---|---|
| Model turns | 19 | 72 |
| Context re-read per turn | ~40k tokens | ~110k tokens |
| Output tokens | 9k | 59k |
| Wall time that is model time | 1.5 of 1.8 min | 12.5 of 14.0 min |

- Before G1 (Story), C spends 0.4–0.9 USD and 1–2 min. Most of the cost comes after G1.
- After G1 there are about 23 tool calls of Graph bookkeeping per run: `start`, `record`, result JSON, evidence hashes, status checks. Each one is a full-context model turn.
- Tests and builds run 6.6 times per run (A: 1.9). Verification re-runs checks, and review after verification makes the run stale, so it re-runs again.
- The kit reference docs read per run total about 37k characters, and they stay in context for every later turn.
- 73% of C's changed lines are tests, about 250 lines per run (A: about 15).
- More than 95% of the cost is the main-session model. Delegation to a cheaper model happened only for a few review subagents.

Cost grows as turns × context. The redesign attacks both terms and moves the expensive middle (implementation) to a cheaper model tier, while keeping what people read.

## 2. Goals, non-goals, anti-goals

**Goals**

1. **Cheaper than vanilla Opus at Opus quality** *(owner decision, 2026-11-13; raised from the earlier 1.1–1.3× target)*: on large tasks, a kit run with an Opus main session costs less than vanilla Claude Code running Opus throughout. Checklist and test results do not fall below vanilla Opus.
2. **Better than vanilla Sonnet at about its cost**: kit runs score higher than vanilla Claude Code running Sonnet throughout, at a similar cost. Without this comparison nobody can tell whether the saving comes from the kit's structure or only from the cheaper model.
3. On small tasks, the overhead shrinks substantially. Being cheaper than vanilla Opus is not promised for small tasks, because the Story has a fixed cost that a small task cannot amortize.
3. Quality holds:
   - checklist pass rate of at least 92% in the same evaluation;
   - no drop in behavior-test or hidden-test results;
   - no new test failures.
4. Human-facing artifacts get easier to read: Story template v2 (§4.1) and the AI-summary G4 (§4.7).

**Non-goals**

- G1 stays a human approval of the Story.
- Test-first work stays.
- Codex keeps working but is not optimized in this round.

**Anti-goals (failure even if cheaper)**

- Quality or checklist results drop.
- Evidence binding is lost. Verification results must still be tied to the code snapshot they checked, and stale results must still be detected.
- In-flight 5.x runs or existing Stories break.
- Internal data from the evaluation lands in this public repository.

## 3. Constraints

- **Public repository.** Examples are generic. Evaluation numbers appear only as aggregates.
- **Backward compatibility.**
  - Existing v3 run files keep working.
  - The checker accepts both the old Story layout and v2.
  - Templates and docs produce v2.
- **Hosts.** The skill must still install and run on Claude Code and Codex. On Codex, behavior that needs subagents falls back to doing the work in the main session.
- **Tests.** The existing suite (190 tests at 5.3.0) stays green. New behavior is added test-first.
- **Ownership.** Release and `npm publish` stay with the owner (`docs/graph-verification.md`).

## 4. Decisions

### 4.1 Story template v2 (owner-approved, 2026-11-12)

Section order: Goal, Domain, Decisions, MUST, SHOULD, OUT, Verify, then a record footer.

```markdown
# Story: <observable outcome>

## Goal
1. As-is: <what happens today and why it is a problem>
2. To-be: <what happens after the change>
3. Unchanged: <what must stay exactly as it is>

## Domain
- Terms:
  1. <term> = <meaning; code identifiers are fine>
- Invariant:
  1. <must always / never happen>

## Decisions
- D1. ASSUMED: <decision title>
  1. <the decided value or rule>
  2. <a different consequence or action, only if there is one>
- OPEN BLOCKING: <remove before approval, or omit>

## MUST
- M1. <condition or case>
  1. <result A + result B that happen together>
- M2. <condition or case>
  1. <result>

## SHOULD
- S1. <title> (<purpose>)
  1. <action>

## OUT
- O1. <excluded area>
  1. <excluded item>
  2. <another excluded item>
- O2. <single excluded item>

## Verify
- V1 [M1]. <input/action → observable result>
- V2 [M2]. <failure/retry → state remains valid>

---
Status: Draft
Owner: <human owner>
Understanding gate (G1): <pending>
Understanding gate (G4): <pending>
```

Writing rules, which go into the template guidance:

- Goal has exactly three numbered lines: As-is, To-be, Unchanged.
- Terms and Invariant are numbered lists, one item per line, never comma-joined.
- D, M, S and O items have a short title line. The details sit in nested numbers below it.
  - Results that happen together share one line, joined with `+`.
  - A new nested number means a different action or a different result.
  - Explanations, purposes and evidence go in parentheses on the title line or the same line. They are not separate numbers.
  - An item that a title says completely has no nested numbers.
- The record lines (Status, Owner, gates) sit in the footer.

Checker changes (`assets/check.mjs`):

- Accept heading order v2. Keep accepting the 5.3.0 order, so in-flight Stories still pass.
- Read Status, Owner and gate lines anywhere in the file. This already works today.
- Read M, V, D and S IDs from top-level list items only. Nested numbered lines are content, not IDs.
- `Verify` mapping rules stay the same.

### 4.2 Two lanes

Intake picks the lane and states it in the Story footer (`Lane: light` or `Lane: standard`). The human sees it at G1 and can change it.

- **Light lane.** All of the following must hold:
  - The change is reversible.
  - It stays inside one module.
  - It changes no external contract (API, schema, message, configuration other services read).
  - It touches no persistent data.
  - It is not in a high-risk domain from `references/domain-risks.md`.
- **Standard lane.** Everything else.

Light lane:

- Writes the same Story template. A section can hold a single item.
- Does not create a Graph run.
- Implementation goes to the cheaper-tier implementer (§4.4), test-first.
- One cheaper-tier reviewer checks the diff against the Story. *(Claude's call: keeps the quality bar on small tasks; review is cheap when the reviewer gets only the Story and the diff.)*
- Verification runs the configured checks once through the CLI, and the CLI writes a receipt bound to the code snapshot.
- Delivery requires an approved Story, a review record, a passing receipt for the current snapshot, and G4 (§4.7).

Lane changes after G1 *(Claude's call)*:

- `Lane:` stays out of the G1 Story hash, like `Status:`.
- The agent may move a light run up to standard at any time. It records the reason in the footer (`Lane: standard (from light: <reason>)`), and the change shows at G4.
- Moving down from standard to light after G1 needs a new G1 approval.

Standard lane: the Graph flow, with §4.3–4.6 applied.

### 4.3 Bookkeeping moves into the CLI

Two new Graph commands replace the model-driven `start` → write result JSON → `verify` → `record` sequence:

- `begin <run> <node>`
  - Starts the node.
  - Returns a compact brief: node id, covered M/V IDs, allowed files or areas, and checks to run.
  - Returns no token juggling for the model to copy around.
- `complete <run> <node> [--verdict pass|fix|human|replan] [--notes <file>]`
  - Runs the node's configured checks and writes the receipts.
  - Evaluation *(Claude's call)*:
    - A failing check forces `fix`, with the failing check's output tail as feedback.
    - Otherwise the verdict is the one given. It defaults to `pass` for implementation nodes.
    - Review nodes must pass `--verdict`, because their judgment does not come from checks. `--notes` holds the findings.
    - A review `fix` resets the implementation node in the same call, following today's reset rule.
  - Hashes the evidence, records the result, and returns the next ready node.

Rules for the new commands:

- Snapshot binding and stale detection stay exactly as strict as in 5.3.0.
- Output stays under about 1k characters. Full details go to files the model reads only when something fails.
- The existing commands stay for compatibility and for advanced cases.

### 4.4 Small-context orchestrator, cheaper implementer

On hosts with subagents (Claude Code), the work is split by role:

| Role | Who does it |
|---|---|
| Intake, Story, G1 explanation, lane choice, plan, final G4 summary | Main session (the user's chosen model) |
| Implementation | A subagent on a cheaper tier, by default the host's mid tier (for example Sonnet when the main model is Opus) |
| Review | A cheaper-tier subagent. It gets the Story's MUST/Verify and the diff, and returns findings |
| Verification | The CLI |

- **Reviewers** *(Claude's call)*: one by default on both lanes, two when the Story needs G3. This replaces today's default of three. The 5.3.0 kit runs in the evaluation used one review subagent per run.
- **Intake exploration** *(owner decision, 2026-11-13)*:
  - Before the Story, a cheaper-tier subagent reads the code the request touches.
  - It returns a short map of the files, the current behavior and the constraints.
  - The main session writes the Story from that map, not from reading the code itself. This cuts the fixed Story cost, which was 0.4–0.9 USD per task in the evaluation.
- **Allowed files or areas** in the `begin` brief are advisory text taken from the node description and the Story. They are not enforced *(Claude's call)*.
- **Implementation subagent.**
  - It receives only the Story's MUST/Verify items, the node brief from `begin`, and the file pointers it needs.
  - It writes the tests and code and returns a short summary.
  - The main session does not re-read the code it wrote. It reads the summary, the diff stat and the check results.
  - When one node's implementation fails twice, the next attempt escalates to the main model.
- `references/model-selection.md` states these defaults concretely and drops the advice that left routing to judgment.

### 4.5 Fewer test and build runs

Where the runs went, measured per kit run in the evaluation:

| Stage | Test or build runs |
|---|---|
| Before the Graph started (writing the check profile, finding failures that already existed) | 5.7 |
| Implementation | 2.7 |
| Review | 1.4 |
| Verification (1.6 of them through `graph verify`) | 3.3 |

On top of that, results were reported stale 3.9 times per run and a node was reset 0.7 times. The minimal plan already runs review before verification (`implement → workflow-review → workflow-verify`), so the node order does not change.

Changes:

- **Check profile.**
  - A CLI command writes the verification profile from the repository type. It reads the `package.json` test and typecheck scripts, or the Gradle test task for the touched modules.
  - The agent edits the profile only when the detection is wrong.
- **Failures that already existed.**
  - The CLI runs the profile once on the start commit.
  - It stores the failing cases with the snapshot.
  - Later checks compare against that list instead of re-running the start commit.
- **Receipt reuse.** If a passing receipt exists for an identical snapshot and an identical check definition, `complete` reuses it instead of running the check again.
- **Stale handling.** Only code changes make a result stale. Writing evidence or approval files under `.ai-workflow/` does not. The builder confirms this against today's snapshot rules and fixes it if it is not already so.

### 4.6 Test volume

- Each Verify item (V#) gets one focused test. It gets a second one only when its MUST has a distinct failure path.
- Tests for behavior the Story does not change are not added, unless an Invariant names it.
- The guidance says this plainly in the execution reference and in the implementation subagent's brief.

### 4.7 G4 with an AI summary (owner-approved, 2026-11-12)

**Mode `ai-summary` (the new default).** The agent writes four short numbered lines and the human approves with an explicit reply:

```
1. 사용자가 겪는 변화: <one or two lines>
2. 지킨 규칙과 실패할 때 동작: <one or two lines>
3. 확인한 테스트: <one or two lines>
4. 확인하지 못한 것: <one or two lines>
```

- The lines follow the user's language. This repository writes the Korean labels because its users are Korean speakers, and the labels translate for other languages.
- Approval needs an explicit "approve" (`승인`) or an equivalent reply from the human. A silent continue or another agent's reply never counts.
- The record keeps `mode: "ai-summary"`, the four lines, and the human's approval text.
  - Story footer: `Understanding gate (G4): <artifact> · <date> · Check-in: accepted · Mode: ai-summary`
  - The checker accepts `G4: APPROVED — <owner> approved the AI summary`.
  - `G4: PASS — …` stays valid for the other mode.

**Mode `human-restatement`** (the current gate) stays available when the owner asks for it. Records say which mode passed, so the two can be told apart later.

**High-risk work** *(owner decision, 2026-11-12)*:

- A Story that requires G3 (hard to reverse or high-risk) must pass G4 by `human-restatement`.
- The checker and the delivery check reject `Mode: ai-summary` for such a Story.

### 4.8 Lighter reading

- `SKILL.md` routes by lane.
- The light lane reads only `references/intake.md`, the Story asset, and a new short `references/light-lane.md`.
- `graph-engineering.md` is split:
  - the minimal plan with `begin`/`complete` goes in a short file;
  - advanced material (role graphs, delegation, reset rules) moves into a separate file that is read only when it is needed.

## 5. Shipping order (owner decision, 2026-11-12)

The work ships as two pull requests.

1. **PR 1: owner-approved readability.** Ships as soon as it is reviewed, independent of the cost results.
   - Story template v2 (§4.1).
   - Checker support for both Story layouts.
   - G4 `ai-summary` mode with the high-risk rule (§4.7).
2. **PR 2: cost and time.** Merges to main only after arm D passes (§6). If D fails, the branch stays open for another round, and PR 1 stays shipped.
   - Lanes (§4.2).
   - `begin`/`complete` (§4.3).
   - Orchestrator and implementer split (§4.4).
   - Check profile, baseline and receipt reuse (§4.5).
   - Test volume (§4.6).
   - Lighter reading (§4.8).

## 6. Validation (arms D and E in the internal evaluation)

The 5.3.0 comparison stops at the 21 runs already graded *(owner decision, 2026-11-13)*. Arms D and E run on the same task slice:

| Arm | Setup |
|---|---|
| A (existing runs) | Vanilla Claude Code, Opus throughout |
| D | Kit 5.4.0 release candidate with superpowers. Opus main session, mid-tier implementation and review |
| E | Vanilla Claude Code, Sonnet throughout |

- D and E are compared with A within each task and repetition, using the same frozen checklists, behavior tests and blind grading.

- **Install.** A local `npm pack` tarball of the 5.4.0 release candidate. It is not published to npm before it passes.
- **Tasks.** The same tasks, with the same frozen checklists, behavior tests and blind grading.
- **Scale.** One repetition per task first. The rest follows only if the gate below passes.
- **Pass gate.**
  - Large tasks: D costs less than A.
  - D's checklist pass rate is at least A's and at least 92%. D has no drop against A in behavior-test or hidden-test results, and no new test failures.
  - D beats E: more pairwise wins than losses, and a higher checklist pass rate.
  - D's cost is within about 1.5× of E's.
- **Report.** A per-size cost ratio, and which arm D was compared against.

## 7. Phase 2: lessons (`ce-compound`)

This gets a separate design after 5.4.0. One thing is already known: in the 5.3.0 runs, C stopped at G4 before the lesson capture step, and the Compound Engineering plugin was not installed in C. Its effect is therefore unmeasured. The measurement has to test repetition across tasks, for example the same mistake reappearing in a later, similar task with and without the lesson. Single-task replay cannot show that.

## 8. Left to the builder

- Exact command names and flags beyond `begin` and `complete`, and the compact output format.
- How to split the reference files and what their final names are.
- Wording of the lane rule in intake, within §4.2.
- Prompt wording for the implementation and review subagents.
- Test structure for the checker's dual layout support and the new CLI commands.
