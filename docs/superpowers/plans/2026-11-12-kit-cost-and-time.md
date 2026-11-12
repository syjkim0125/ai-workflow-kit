# Kit cost and time Implementation Plan (PR 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the kit's model turns and context so a kit run costs and takes at most 1.1–1.3× vanilla Claude Code on large tasks, without lowering the 92% checklist bar.

**Architecture:**
- Bookkeeping moves from model turns into CLI commands:
  - `begin`, `complete` and `profile` for standard runs;
  - `light`, `check` and `review` for light runs.
- Receipts are reused when the snapshot and the check definition are unchanged.
- The skill docs route work by lane. The main session orchestrates, a cheaper-tier subagent implements, and one reviewer reviews.

**Tech Stack:** Node.js ESM, `node:test`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-kit-cost-redesign-design.md` (§4.2–4.6, §4.8, §5 PR 2, §6)

**Depends on:** PR 1 (`docs/superpowers/plans/2026-11-12-story-v2-and-ai-summary-g4.md`), for the Story footer, `isStoryRecordLine` and `Lane:`.

## Global Constraints

- The existing commands (`init`, `start`, `record`, `verify`, `reset`, `status`, `delivery`, role commands) keep their behavior. v3 run files created by 5.3.0 stay valid.
- Snapshot binding and stale detection are as strict as in 5.3.0. A passing result is never recorded against a changed snapshot.
- `begin` and `complete` print at most about 1,000 characters of JSON. Long output goes to files under `.ai-workflow/evidence/`.
- Lane rule (spec §4.2):
  - The light lane requires all of: reversible, one module, no external contract change, no persistent data, not in a `domain-risks.md` high-risk area.
  - A light run may move up to standard at any time, recorded in the footer as `Lane: standard (from light: <reason>)`. Moving down after G1 needs a new G1.
  - `Lane:` is excluded from the G1 Story hash.
- Reviewers: `reviewBudget.defaultAgents` is 1. For a Story that needs G3 it is 2.
- Implementation subagent: the host's mid tier by default (for example Sonnet under an Opus main session). Escalate to the main model after two failed attempts on the same node.
- Test volume: one focused test per Verify item; a second only for a distinct failure path in its MUST.
- PR 2 merges to main only after arm D passes (spec §6). PR 1 is independent.
- Report test results as passed/total.

## Review Focus

1. `complete` is called after code changed since `begin` on a review or verify node → the result is recorded as stale with the reset instruction, never as passed. Covered by Task 1, `complete refuses a pass on a changed snapshot`.
2. A reused receipt whose check definition changed (argv or timeout edited in the profile) → no reuse, the check runs again. Covered by Task 2, `receipt reuse requires the same check definition`.
3. `light` is started for a Story that already has a standard run file → refused, because moving down needs a new G1. Covered by Task 4, `light refuses a Story with a standard run`.
4. `profile` runs in a repository with neither `package.json` scripts nor Gradle → a clear error asking for a hand-written profile; no empty profile is written. Covered by Task 3, `profile refuses an unknown project type`.
5. A review `--verdict fix` with no `--notes` → refused, because a failed evaluation needs feedback (the existing rule). Covered by Task 1, `review fix needs notes`.

---

### Task 1: `begin` and `complete` for standard runs

**Files:**
- Modify: `src/graph/cli.mjs` (`counts`, help text, a new branch beside `start`/`record`)
- Create: `src/graph/advance.mjs` (the command logic, so `cli.mjs` stays a dispatcher)
- Test: `test/graph-advance.test.mjs` (new; reuse `test/fixtures/graph-project.mjs`)

**Interfaces:**
- Produces:
  - `export async function begin({ root, runFile, nodeId, validate, snapshot }): Promise<Brief>`. It calls the same internals as `start`, reading the ready token from `status` itself.
    - `Brief = { node, covers: string[], area: string, checks: string[], token }`.
    - `area` is the node description plus the Story OUT items, as advisory text (spec §4.4).
  - `export async function complete({ root, runFile, nodeId, verdict, notesFile, validate, snapshot }): Promise<Outcome>`.
    - `Outcome = { node, status: 'completed'|'failed', next: string|null, failing?: { check, tail } }`.
- Check selection inside `complete`:

  | Node | Checks run |
  |---|---|
  | `implement` | Profile checks covering the node's V IDs |
  | `workflow-review` | None; `verdict` is required |
  | `workflow-verify` | All profile checks |

- Evaluation inside `complete`:
  - A failing check forces `{ passed: false, action: 'fix', feedback: <check id + last 20 lines of stderr> }`.
  - Otherwise `verdict` decides, and implementation defaults to `pass`.
  - A review `fix` resets `implement` in the same update, as the existing `reset` would.
- `output.summary` is the first non-empty line of `notesFile`, or `"<node> completed by complete"`. `output.evidence` lists the receipt files.

- [ ] **Step 1: Write failing tests** in `test/graph-advance.test.mjs`.
  - `begin returns a compact brief and marks the node running`
    - `JSON.stringify(out).length < 1000`
    - status shows the node `running`
  - `complete runs the node checks and records a pass`
    - after `begin('implement')` and an edit, `complete` gives `status: 'completed'`, `next: 'workflow-review'`
  - `a failing check forces fix with a short tail`
    - the profile check exits 1
    - `status: 'failed'`
    - `failing.tail` has at most 20 lines
  - `review needs a verdict`
    - `complete('workflow-review')` with no verdict → error `/verdict/`
  - `review fix needs notes`
    - `--verdict fix` with no notes file → error `/feedback/`
  - `review fix resets implement`
    - after `--verdict fix --notes f.md`, status `ready` contains `implement`
  - `complete refuses a pass on a changed snapshot`
    - edit `app.mjs` after `begin('workflow-verify')`
    - `complete` → error `/stale/`
  - `the minimal plan finishes with three begin/complete pairs`
    - six calls in total reach `action: 'g4'`
  - `evidence and approval files do not make results stale`
    - writing under `.ai-workflow/evidence/` or `.ai-workflow/approvals/` between `begin` and `complete` still records a pass (spec §4.5)

- [ ] **Step 2: Run them.** `node --test test/graph-advance.test.mjs`. Expected: FAIL (command not found).

- [ ] **Step 3: Implement.** Implement `begin` and `complete` in `src/graph/advance.mjs`, and wire them into `cli.mjs`:
  - `counts.begin = 2`
  - `counts.complete = 2`
  - flags `--verdict` and `--notes`
  - Reuse `requireReady`, `runVerification`, `normalizeEvaluation`, `evidenceHashes` and the `record` validation path, so every 5.3.0 rule still applies.

- [ ] **Step 4: Run.** `node --test test/graph-advance.test.mjs test/graph-cli.test.mjs`. Expected: all pass.

- [ ] **Step 5: Commit.** `feat(graph): begin/complete record nodes in one call each`

### Task 2: Receipt reuse

**Files:**
- Modify: `src/graph/verification.mjs` (`runVerification`)
- Test: `test/graph-verification.test.mjs`

**Interfaces:**
- Produces: `checkKey(check): string`, the `digest` of `JSON.stringify({ argv, timeoutMs })`.
  - The run stores an index `run.receipts[checkKey + ':' + snapshotFingerprint] = { file, hash }` for passing receipts only.
  - When the key exists, `runVerification` records the existing receipt for the node instead of executing again.

- [ ] **Step 1: Write failing tests.**
  - `a passing check on an unchanged snapshot is reused`
    - run `workflow-verify` twice (with a reset in between)
    - the second attempt creates no new evidence directory
  - `receipt reuse requires the same check definition`
    - change the check's `argv`; the check runs again
  - `a failed receipt is never reused`

- [ ] **Step 2: Run them.** `node --test test/graph-verification.test.mjs`. Expected: the three new tests FAIL.

- [ ] **Step 3: Implement.** Add the reuse in `runVerification`. The index updates in the same `updateRun` that stores a passing receipt.

- [ ] **Step 4: Run.** Same command. Expected: all pass.

- [ ] **Step 5: Commit.** `feat(graph): reuse passing receipts for identical snapshots and checks`

### Task 3: `profile` and baseline

**Files:**
- Create: `src/graph/profile.mjs`
- Modify: `src/graph/cli.mjs` (`profile <story.md>` and `baseline <run.json>`)
- Test: `test/graph-profile.test.mjs` (new)

**Interfaces:**
- Produces:
  - `export async function detectProfile({ root, ids }): Promise<ProfileValue>`. Detection, in order:
    1. `package.json` `scripts.test` → `['npm','test','--','--watchAll=false']` when `react-scripts` is a dependency, else `['npm','test']`.
    2. `scripts.typecheck`, or a `tsconfig.json` → `['npx','tsc','--noEmit']`.
    3. `gradlew` → `['./gradlew','test']`.
    - Every check `covers` all Story V IDs. The default `timeoutMs` is 300000.
  - `profile` writes `.ai-workflow/verification.json` only when it does not exist yet, and prints the checks.
  - `baseline` runs every profile check once on the current snapshot through the receipt path (Task 2).
    - It prints the failing checks with a 20-line tail and the instruction "narrow this check to exclude pre-existing failures, then run baseline again".
    - `begin('implement')` refuses until a baseline passed for the current profile fingerprint.

- [ ] **Step 1: Write failing tests.**
  - `profile detects npm test and tsc`
  - `profile detects gradle`
  - `profile refuses an unknown project type` (error `/write .ai-workflow\/verification.json by hand/`, and no file written)
  - `profile never overwrites an existing profile`
  - `begin refuses before a passing baseline`
  - `a passing baseline unlocks begin and its receipts are reused by the first implement check`

- [ ] **Step 2: Run them.** `node --test test/graph-profile.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as specified above. The baseline gate stores `run.baseline = { profile: fingerprint, receipts }`.
  - Deviation from spec §4.5, recorded on purpose: the spec stores the failing cases and compares later runs against that list. That needs a per-framework test-report parser. This plan asks the agent once to narrow the check so that the baseline passes. It gives the same effect (no repeated baseline runs) without a parser.
  - If arm D shows narrowing costs too many turns, the per-case comparison becomes a follow-up.

- [ ] **Step 4: Run.** `node --test test/graph-profile.test.mjs test/graph-advance.test.mjs`. Expected: all pass.

- [ ] **Step 5: Commit.** `feat(graph): detect the check profile and gate implementation on a clean baseline`

### Task 4: Light lane and `Lane:`

**Files:**
- Create: `src/graph/light.mjs`
- Modify:
  - `src/graph/cli.mjs` (`light <story.md> <run.json>`, `check <run.json>`, `review <run.json>`, and `delivery` accepting `kind: 'light'`)
  - `src/graph/snapshot.mjs` (`canonicalStory` drops `Lane:` lines)
  - `assets/check.mjs` (validate `Lane:` values)
- Test: `test/graph-light.test.mjs` (new), `test/checker.test.mjs`

**Interfaces:**
- Consumes: PR 1's `isStoryRecordLine`. Task 2's receipt path.
- Produces: a run file with `{ version: 3, kind: 'light', story, verification, review?: {...}, receipts }`.
  - `light` requires `Lane: light` in the footer and an approved G1. It refuses when a standard run file for the same Story exists next to it (same directory, `kind: 'delivery'`).
  - `check` runs all profile checks once, with reuse.
  - `review --verdict pass|fix --notes <file>` records the reviewer's result. A `fix` clears the stored check receipts' validity for delivery.
  - `delivery` for `kind: 'light'` requires all of:
    - the approved Story;
    - a `review.verdict === 'pass'` recorded after the last code change;
    - passing receipts for the current snapshot;
    - G4 bound to that snapshot.
- Checker: `Lane:` must be `light`, `standard`, or `standard (from light: <reason>)`.

- [ ] **Step 1: Write failing tests.**
  - `light runs check, review and delivery in three commands`
  - `light refuses a Story with a standard run`
  - `light delivery refuses a review older than the last code change`
  - `Lane lines do not change the G1 Story hash`
  - `checker rejects an unknown Lane value`

- [ ] **Step 2: Run them.** `node --test test/graph-light.test.mjs test/checker.test.mjs`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement** as specified above.

- [ ] **Step 4: Run.** Same command. Expected: all pass.

- [ ] **Step 5: Commit.** `feat(graph): light lane with one check run, one review and G4`

### Task 5: Orchestration, reviewer budget, test volume and lighter reading (docs and defaults)

**Files:**
- Modify:
  - `src/graph/workflow.mjs:150`: `reviewBudget = { defaultAgents: 1, smallChangeAgents: [1, 1], highRiskAgents: [2, 2], … }`
  - `skills/workflow/SKILL.md`: routes by lane
  - `skills/workflow/references/execution.md`
  - `skills/workflow/references/model-selection.md`
  - `skills/workflow/references/skill-integration.md:55`
  - `skills/workflow/references/role-graphs.md:17`
- Create:
  - `skills/workflow/references/light-lane.md`
  - `skills/workflow/references/graph-minimal.md`: the minimal plan with `profile`, `baseline`, `begin`/`complete`, at most about 4 KB
  - `skills/workflow/references/graph-advanced.md`: the rest of today's `graph-engineering.md`
  - `graph-engineering.md` becomes a two-line pointer to both files.
- Test: `test/structure.test.mjs`, `test/graph-verification.test.mjs:56-65`

- [ ] **Step 1: Write failing tests.**
  - `SKILL.md routes light work to light-lane.md and standard work to graph-minimal.md`
  - `light lane reading is small`
    - `intake.md`, `assets/STORY.md` and `light-lane.md` together are under 12,000 bytes
  - `model-selection names the implementer tier and escalation`
    - the text contains `mid tier`, `two failed attempts` and `main model`
  - `execution limits tests to one per Verify item`
  - Update the `reviewBudget` assertions in `graph-verification.test.mjs` to `defaultAgents === 1`.

- [ ] **Step 2: Run them.** `node --test test/structure.test.mjs test/graph-verification.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Write the docs and change `reviewBudget`.**
  - **`execution.md` (orchestration).**
    - The main session keeps Story, G1, plan and G4 summary.
    - Implementation is dispatched to a mid-tier subagent. Its brief is the Story MUST/Verify plus the `begin` brief, and it returns a summary. The main session reads the summary, the diff stat and the check results, not the code.
    - The review subagent gets the Story and the diff.
    - After two failed attempts on the same node, the main model takes over.
    - Codex, or any host without subagents, does the same steps in the main session.
  - **Test volume.** One test per V#, a second only for a distinct failure path.
  - **`light-lane.md`.** The lane criteria from Global Constraints and the three commands.

- [ ] **Step 4: Run the whole suite.** `npm test`. Expected: `# fail 0`. Report passed/total.

- [ ] **Step 5: Commit.** `docs: route by lane, delegate implementation, one reviewer, one test per V`

### Task 6: Release candidate for arm D (operational)

- [ ] **Step 1:** Bump `package.json` to `5.4.0-rc.1`. Add CHANGELOG notes. Run `npm test` and report passed/total.
- [ ] **Step 2:** Run `npm pack`. Expected: `pazmo-ai-workflow-kit-5.4.0-rc.1.tgz`.
- [ ] **Step 3:** Hand the tarball path to the evaluation, which runs arm D (spec §6).
  - Do not publish to npm.
  - Do not merge PR 2 until D passes: on large tasks, cost and wall time at most 1.3× A, and checklist at least 92% overall.
