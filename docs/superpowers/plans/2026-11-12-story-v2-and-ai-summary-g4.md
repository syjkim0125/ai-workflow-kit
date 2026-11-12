# Story v2 and AI-summary G4 Implementation Plan (PR 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the owner-approved readability changes: Story template v2, checker and Jira support for both Story layouts, and a G4 mode where the agent writes a four-line summary and the human approves it, except for G3 work.

**Architecture:** `assets/check.mjs` learns two heading orders, the v2 Goal shape, a footer record block, and a G4 mode read from the gate record line. `src/jira.mjs` reuses the checker's layout and record helpers. `graph delivery` adds one guard for G3 runs. The template and gate docs change to match.

**Tech Stack:** Node.js ESM, `node:test`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-kit-cost-redesign-design.md` (§4.1, §4.7, §5 PR 1)

## Global Constraints

- Both layouts must pass the checker:
  - v1 order: `Goal, Domain, MUST, SHOULD, OUT, Decisions, Verify`.
  - v2 order: `Goal, Domain, Decisions, MUST, SHOULD, OUT, Verify`.
- v2 Goal has exactly three numbered lines, labelled `As-is:`, `To-be:`, `Unchanged:`.
- Record lines (`Status:`, `Owner:`, `Understanding gate (G1|G3|G4):`, `G4:`) may sit anywhere. The template puts them in a footer after `---` below Verify.
- G4 `ai-summary` passes with `G4: APPROVED — <owner> approved the AI summary` and `Mode: ai-summary` on the G4 gate line.
- A G4 record without a Mode is `human-restatement` and still needs `G4: PASS — …`.
- A Story with a G3 gate record cannot pass G4 in `ai-summary` mode. Neither can a run whose profile has `requiresG3`.
- The four summary labels are exactly: `사용자가 겪는 변화`, `지킨 규칙과 실패할 때 동작`, `확인한 테스트`, `확인하지 못한 것`.
- The existing suite stays green (190 tests at 5.3.0). Report counts as passed/total.
- No internal data from the evaluation in this public repository.

## Review Focus

1. A Story with `Status:` both at the top and in the footer → the checker reports a duplicate record line instead of reading one silently. Covered by Task 1, `duplicate record lines are rejected`.
2. A nested numbered line that mentions an ID (`  1. same as M1`) → counts as content. It neither creates an ID nor breaks Verify mapping. Covered by Task 1, `nested items are content not IDs`.
3. A Mode written in another case or spacing (`mode: AI-Summary`) → read as `ai-summary`. Covered by Task 3, `mode is read case-insensitively`.
4. `G4: APPROVED` with no `Mode: ai-summary` on the gate line → still needs `G4: PASS`. The approval line alone never switches the mode. Covered by Task 3, `APPROVED without ai-summary mode does not pass`.
5. A `---` line or `Status:` text inside a fenced code block in Verify → treated as content, not as the footer. Covered by Task 2, `footer inside a code fence is content`.

---

### Task 1: Checker accepts the v2 Story layout

**Files:**
- Modify: `assets/check.mjs` (heading constants near line 6, `requireOrderedHeadings`, `checkStoryShape`)
- Test: `test/checker.test.mjs`

**Interfaces:**
- Produces:
  - `export const STORY_LAYOUTS = { v1: [...], v2: [...] }`, each an array of the seven headings in order.
  - `export function storyLayout(text): 'v1' | 'v2' | null`. Returns the layout whose order matches the headings that are present, or `null`.
  - `export function isStoryRecordLine(line): boolean`. True for `Status:`, `Owner:`, `Lane:`, gate lines and `G4:` lines. `Lane:` is reserved for PR 2 and may appear now.

- [ ] **Step 1: Write failing tests** in `test/checker.test.mjs`.

  `v2Story` is a new fixture: `baseStory`'s content rearranged into v2 order, with the Goal as the three labelled lines, record lines in a `---` footer, and D/M/O items using nested numbers.

  ```js
  test('Story checker accepts the v2 layout with a record footer', async () => {
    // write v2Story; checkArtifact({ file, kind: 'story' }) → ok: true
  });
  test('Story checker keeps accepting the v1 layout', async () => { /* baseStory → ok */ });
  test('a Story mixing v1 and v2 order is rejected', async () => {
    // Decisions before MUST and SHOULD after OUT, but OUT before Decisions → error includes 'out of order'
  });
  test('v2 Goal needs As-is, To-be and Unchanged lines', async () => {
    // v2Story with the 'Unchanged:' line removed → error includes 'Unchanged'
  });
  test('nested items are content not IDs', async () => {
    // v2Story where M1 has '  1. same as M1 + logged'; V lines unchanged → ok: true, and no 'Duplicate' error
  });
  test('duplicate record lines are rejected', async () => {
    // v2Story plus 'Status: Approved' added at the top → error includes 'Status' and 'once'
  });
  ```

- [ ] **Step 2: Run them.** `node --test test/checker.test.mjs`. Expected: the six new tests FAIL; the old tests pass.

- [ ] **Step 3: Implement.**
  - `requireOrderedHeadings` takes the allowed orders. An order passes when every heading is present and their positions follow one layout.
  - In `checkStoryShape`:
    - When `storyLayout(text) === 'v2'`, require `^1\.\s*As-is:`, `^2\.\s*To-be:` and `^3\.\s*Unchanged:` lines in the Goal body.
    - Error once per missing label, naming the label.
    - Reject more than one `Status:` or `Owner:` line, with an error that says the line must appear once.
  - Keep `idsInSection`'s top-level-only match (`^[-*]\s+M…`). The new test pins this behavior.

- [ ] **Step 4: Run.** `node --test test/checker.test.mjs`. Expected: all pass.

- [ ] **Step 5: Commit.** `feat(check): accept the v2 Story layout with a record footer`

### Task 2: Template v2, intake guidance and Jira preview

**Files:**
- Modify: `skills/workflow/assets/STORY.md` (the v2 template from spec §4.1, verbatim)
- Modify: `skills/workflow/references/intake.md` (section list near lines 37–51)
- Modify: `src/jira.mjs` (`HEADINGS`, `formatStory`)
- Test: `test/jira.test.mjs`, `test/structure.test.mjs`

**Interfaces:**
- Consumes: `STORY_LAYOUTS`, `storyLayout`, `isStoryRecordLine` (Task 1).

- [ ] **Step 1: Write failing tests.**

  ```js
  // test/structure.test.mjs
  test('the shipped Story template uses the v2 layout and a record footer', async () => {
    // read skills/workflow/assets/STORY.md
    // headings === STORY_LAYOUTS.v2
    // Goal has 'As-is:', 'To-be:', 'Unchanged:'
    // text after the last '---' line contains 'Status:' and 'Understanding gate (G4):'
  });
  // test/jira.test.mjs
  test('Jira preview accepts a v2 Story and drops the record footer', () => {
    // formatStory(v2Story).preview has the sections in v2 order
    // and contains no 'Status:' and no 'Owner:'
  });
  test('footer inside a code fence is content', () => {
    // a Verify section with a ``` block holding '---' and 'Status: x' keeps both lines in the preview
  });
  ```

- [ ] **Step 2: Run them.** `node --test test/jira.test.mjs test/structure.test.mjs`. Expected: the three new tests FAIL.

- [ ] **Step 3: Implement.**
  - **Template.** Replace `STORY.md` with the spec §4.1 template, verbatim.
  - **Intake guidance.** Add the writing rules from §4.1 to `intake.md`'s section guidance:
    - Goal has three lines (As-is, To-be, Unchanged).
    - Terms and Invariant are numbered.
    - D/M/S/O items get a title line with nested numbers below it; results that happen together join with `+`, and a new number means a different action or result.
    - The record lines go in the footer.
  - **Jira preview.** In `formatStory`:
    - Accept either order from `STORY_LAYOUTS`.
    - Outside fences, a `---` line after Verify starts the record block. So does a record line (`isStoryRecordLine`) after Verify.
    - Inside the record block, only record lines and blank lines are allowed; anything else keeps the existing error.

- [ ] **Step 4: Run.** `node --test test/jira.test.mjs test/structure.test.mjs`. Expected: all pass.

- [ ] **Step 5: Commit.** `feat: ship Story template v2 and accept it in the Jira preview`

### Task 3: G4 `ai-summary` mode in the checker

**Files:**
- Modify: `assets/check.mjs` (`hasG4Pass`, `checkGate`)
- Test: `test/checker.test.mjs`

**Interfaces:**
- Produces: `export function g4Mode(record): 'ai-summary' | 'human-restatement'`. It reads `Mode:` from the G4 gate line, case-insensitively. A missing Mode means `human-restatement`.

- [ ] **Step 1: Write failing tests.**

  ```js
  test('ai-summary G4 passes with an APPROVED line', async () => {
    // G4 line '<artifact> · 2026-11-12 · Check-in: accepted · Mode: ai-summary'
    // plus 'G4: APPROVED — owner approved the AI summary' → checkGate G4 ok
  });
  test('ai-summary G4 without APPROVED fails', async () => { /* error includes 'G4: APPROVED' */ });
  test('APPROVED without ai-summary mode does not pass', async () => {
    // no Mode on the line, only an APPROVED line → error includes 'G4: PASS'
  });
  test('mode is read case-insensitively', async () => { /* 'mode: AI-Summary' + APPROVED → ok */ });
  test('a Story with a G3 record cannot use ai-summary G4', async () => {
    // accepted G3 gate line plus ai-summary G4 → error includes 'G3' and 'human restatement'
  });
  test('human-restatement G4 is unchanged', async () => { /* existing PASS form → ok */ });
  ```

- [ ] **Step 2: Run them.** `node --test test/checker.test.mjs`. Expected: the new tests FAIL, except `human-restatement G4 is unchanged`, which already passes.

- [ ] **Step 3: Implement.** In `checkGate` for G4, after the artifact check:
  - In `ai-summary` mode, require `^G4:\s*APPROVED\s*[—-]\s*\S.+$`.
  - Also reject it when `gateLine(text, 'G3')` is present and not `pending`. The error says: `A Story with a G3 decision needs G4 by human restatement (G4: PASS — …).`
  - In `human-restatement` mode, keep the current `G4: PASS` check and its message.

- [ ] **Step 4: Run.** `node --test test/checker.test.mjs`. Expected: all pass.

- [ ] **Step 5: Commit.** `feat(check): add the ai-summary G4 mode with the G3 rule`

### Task 4: Delivery guard, gate docs and changelog

**Files:**
- Modify: `src/graph/cli.mjs` (the `delivery` branch near line 145)
- Modify: `skills/workflow/references/understanding-gate.md`, `skills/workflow/SKILL.md` (lines 18–29), `CHANGELOG.md` (Unreleased)
- Test: `test/delivery-check.test.mjs`

**Interfaces:**
- Consumes: `g4Mode` (Task 3). `boundApproval` returns `{ file, hash }`; re-read the JSON with `readJson(root, file)`.

- [ ] **Step 1: Write a failing test** in `test/delivery-check.test.mjs`.

  ```js
  test('delivery rejects an ai-summary G4 when the run requires G3', async t => {
    // a G3 profile fixture as in the existing G3 test; record the three nodes
    // G4 line with 'Mode: ai-summary' and an APPROVED line; final.json { ..., mode: 'ai-summary' }
    // f.cli('delivery', 'run.json').stderr matches /G3.*human restatement/
  });
  ```

- [ ] **Step 2: Run it.** `node --test test/delivery-check.test.mjs`. Expected: FAIL.
  - If the checker's G3 rule from Task 3 already rejects this case before delivery runs, the test passes instead. Then keep the test as a guard and skip Step 3's code change.

- [ ] **Step 3: Implement.** In `delivery`, after `boundApproval`, read the approval JSON. If `run.verification.value.requiresG3` and `value.mode === 'ai-summary'`, throw the same message as Task 3.

- [ ] **Step 4: Update the docs.**
  - **`understanding-gate.md`:**
    - Describe two modes. `ai-summary` is the default. `human-restatement` is used on request and is required for G3 work.
    - For `ai-summary`, give the exact four-line format with the labels from Global Constraints. Each line is one or two lines long.
    - The human must approve explicitly. Silence or another agent's reply never counts.
    - The JSON record fields are `gate`, `mode`, `summary` (four strings), `approvalText`, `responseRef`, `storyHash`, `snapshot`, `runId`.
    - The Story footer and pass lines follow Global Constraints.
    - Keep the current prediction-before-reveal text as the `human-restatement` procedure.
  - **`SKILL.md`:**
    - Replace "Keep G4 prediction-before-reveal intact" with one line naming the two modes and the G3 rule.
    - The "Do not declare delivery complete… before G4 passes" rule stays.
  - **`CHANGELOG.md`:** Add an Unreleased entry that lists Story v2, dual-layout checking, the Jira preview change and the ai-summary G4.

- [ ] **Step 5: Run the whole suite.** `npm test`. Expected: `# fail 0`. Report passed/total.

- [ ] **Step 6: Commit.** `feat: AI-summary G4 for non-G3 work; docs and changelog`
