# Fast path (written for the model; terse on purpose)

MAIN = Story, G1, G4 summary, joins. Never read code, test logs or kit source in main. Read only CLI JSON, subagent summaries, `git diff --stat`. Pipe long output through `| tail -20`. CLI = `node .ai-workflow/bin/graph.mjs`.

1. EXPLORE, fan-out: one message, two Agent calls, `subagent_type: Explore`, `model: haiku`. Area A: code path and callers. Area B: tests, config, external contracts. Each: at most 8 tool calls; returns at most 25 lines: files, current behavior, constraints, the module's test command. Join both into the map.
2. STORY from the map, template `../assets/STORY.md`:
   - Goal: `1. As-is:` `2. To-be:` `3. Unchanged:`. Domain: numbered Terms, Invariant.
   - Decisions above MUST: `ASSUMED` defaults; `OPEN BLOCKING` only for behavior a human must choose (money, migration, auth: never `ASSUMED`; see `domain-risks.md`).
   - MUST/SHOULD/OUT items: title line, nested numbers; results that happen together on one line joined by `+`.
   - Verify: `V# [M#]` success and failure.
   - Footer after `---`: Status, Owner, `Lane: light` only if reversible + one module + no external contract + no persistent data + not high-risk; else `Lane: standard`.
   - At most three blocking questions, two rounds. Open idea or more questions: `intake.md`.
3. G1: explain in the user's language, at most five lines (today, after, unchanged, how we check). Ask. END THE TURN. Only an explicit approval counts. Save the reply to `.ai-workflow/approvals/<slug>-g1-reply.md`, then `graph.mjs approve G1 <story> --response <reply>`.
4. RUN: `graph.mjs go <story> .ai-workflow/runs/<slug>.json --scope <module or path from the map>`. Returns the implement brief (light lane: the light run).
5. IMPLEMENT: one Agent, `model: sonnet`. Give it the Story MUST and Verify, the brief JSON and the map. Its rules: test-first; one focused test per Verify item, a second only for a distinct failure path; run only the module's tests; never write a test runner; if the module's tests cannot run here, say so; return at most 15 lines (files, tests, results).
6. JOIN, one message, two calls in parallel:
   - Bash: `graph.mjs complete <run> implement` (light: `graph.mjs check <run>`). It runs the checks and begins the review node.
   - Agent `model: sonnet`, reviewer: Story MUST/Verify and `git diff`. Blocking findings first, at most 15 lines. Main writes them to `.ai-workflow/evidence/review-1.md`.
   - Check failed: send `failing.tail` to the implementer, then `complete` again. After two failed attempts on one node, implement with `model: opus`.
7. REVIEW: `graph.mjs complete <run> workflow-review --verdict pass|fix --notes .ai-workflow/evidence/review-1.md` (light: `graph.mjs review <run> --verdict … --notes …`). One round only: after a fix, the implementer fixes the listed findings, `complete implement` (light: `check`), then record `--verdict pass` without a new reviewer; anything not fixed goes to G4 line 4.
8. VERIFY: `graph.mjs complete <run> workflow-verify` (reuses passing receipts). Expect `next: g4`.
9. G4: four lines in the user's language: `1. 사용자가 겪는 변화` `2. 지킨 규칙과 실패할 때 동작` `3. 확인한 테스트` `4. 확인하지 못한 것`. Ask. END THE TURN. Save the lines to `.ai-workflow/approvals/<slug>-g4-summary.md`, the reply to `-g4-reply.md`, then `graph.mjs approve G4 <run> --summary <file> --response <file>`. Report its result.

Other cases: `next: human|replan` → ask the human. `stop` → report, no new run. High-risk (G3) or several dependent outcomes → `execution.md`. Roles → `role-graphs.md`.
