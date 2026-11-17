# Fast path (written for the model; terse on purpose)

MAIN = Story, G1, G4 summary, joins. Never read code, test logs or kit source in main. Never edit code or run formatters in main: an edit after `complete implement` reruns every check; a style nit is a note. Read only CLI JSON, subagent summaries, `git diff --stat`. CLI = `node .ai-workflow/bin/graph.mjs`; its JSON is compact, never tail it. Pipe other long output through `| tail -20`. No subagents on this host: do steps 1, 5 and the review in main, same order.

1. EXPLORE, fan-out: one message, two Agent calls, `subagent_type: Explore`, `model: haiku`. Area A: code path and callers. Area B: tests, config, external contracts. Each: at most 8 tool calls, at most 25 lines back: `file:line` refs, current behavior, constraints, test command. Join both into the map; afterwards grep only what it marks unknown.
2. STORY from the map at `docs/stories/<slug>.md`, template `../assets/STORY.md`:
   - Goal: `1. As-is:` `2. To-be:` `3. Unchanged:`. Domain: numbered Terms, Invariant.
   - Decisions above MUST: `ASSUMED` defaults; `OPEN BLOCKING` only for behavior a human must choose (money, migration, auth: never `ASSUMED`; see `domain-risks.md`).
   - MUST/SHOULD/OUT items: title line, nested numbers; results that happen together on one line joined by `+`.
   - Verify: `V# [M#]` success and failure.
   - Footer after `---`: Status, Owner, `Lane: light` only if reversible + one module + no external contract + no persistent data + not high-risk; else `Lane: standard`.
   - At most three blocking questions, two rounds. Open idea or more questions: `intake.md`.
3. G1: show the Story path and its Decisions lines, then explain in the user's language, at most five lines (today, after, unchanged, how we check). Ask. END THE TURN. Only an explicit approval counts. Save the reply to `.ai-workflow/approvals/<slug>-g1-reply.md`, then `graph.mjs approve G1 <story> --response <reply>`. Never edit Status or gate lines yourself; `approve` writes them.
4. RUN: `graph.mjs go <story> .ai-workflow/runs/<slug>.json --scope <module or path>` (repeat `--scope` per touched module). Returns the implement brief; its `checks` are the exact commands, so never open `verification.json` (light lane: the light run).
5. IMPLEMENT: one Agent, `model: sonnet`. Give it the Story MUST and Verify, the brief JSON and the map. Its rules: test-first; one focused test per Verify item, a second only for a distinct failure path; while iterating run only the tests it wrote (one file or class filter), never the full suite: the brief's checks run once in `complete`; never write a test runner; if tests cannot run here, say so; return at most 15 lines: files, `V# → test` for every Verify item, results, and `TESTS:` the test classes or files it wrote plus the existing tests of the classes it changed.
6. JOIN, one message, two calls in parallel:
   - Bash: `graph.mjs complete <run> implement --tests <each TESTS entry>` (light: `graph.mjs check <run> --tests …`). It runs only those tests and begins the review node.
   - Agent `model: sonnet`, reviewer: Story MUST/Verify and `git diff`. It writes its findings to `.ai-workflow/evidence/review-1.md`, at most 15 lines, and returns the verdict: `fix` only when a MUST or Verify item is unmet or behavior is wrong; anything else is a note.
   - Check failed: send `failing.tail` to the implementer, then `complete` again. A failure only in untouched tests existed before: drop it from `--tests`, note it for G4 line 4; never run full suites or baselines. After two failed attempts on one node, implement with `model: opus`.
7. REVIEW. Pass: one Bash call, `graph.mjs complete <run> workflow-review --verdict pass --notes .ai-workflow/evidence/review-1.md && graph.mjs complete <run> workflow-verify`. Fix: `--verdict fix` alone; the implementer fixes only the listed findings, `complete implement`, then the pass call above without a new reviewer (one round); anything not fixed goes to G4 line 4. Light: `graph.mjs review <run> --verdict … --notes …`, after a fix `check` first.
8. VERIFY reuses passing receipts; expect `next: g4`. Light: no verify step.
9. G4: four lines in the user's language: `1. 사용자가 겪는 변화` `2. 지킨 규칙과 실패할 때 동작` `3. 확인한 테스트` `4. 확인하지 못한 것`. Ask. END THE TURN. Only an explicit approval counts; on a correction, fix the line and ask again. Save the lines to `.ai-workflow/approvals/<slug>-g4-summary.md`, the reply to `-g4-reply.md`, then `graph.mjs approve G4 <run> --summary <file> --response <file>`. Report its result.

Other cases: `next: human|replan` → ask the human. `stop` → report, no new run. High-risk (G3) or several dependent outcomes → `execution.md`. Roles → `role-graphs.md`.
