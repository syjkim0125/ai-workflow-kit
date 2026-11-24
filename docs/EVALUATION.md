# Does the kit make AI coding better? Measured results

This page reports how AI Workflow Kit compared with a plain Claude Code session on real tasks. The tasks came from production repositories. Short version: the kit's process raised quality a little when a frontier model ran it, but cost 6× as much and took 10× as long. Making the kit cheaper by moving the main session to a mid-tier model brought cost down to the plain session's level, but the quality gain disappeared with it.

The numbers below come from November 2026. They cover kit 5.3.0 and the internal 5.4.0 release candidates (rc.1 to rc.18); 5.4.0 ships rc.18. Models: Claude Opus 5.5 and Claude Sonnet 5.5, in Claude Code.

## How it was measured

- **Tasks:** merged pull requests from three repositories of one e-commerce company (a Java/Gradle backend, a Node server, a React client). Each task resets the repository to the PR's starting commit and gives the PR's issue text, unchanged, as the request. Sizes are by the merged diff: small 11–27 lines, medium 99–147, large 488–535.
- **Arms:** each arm solves the same task in a fresh, sandboxed checkout. When the kit asks for approval (G1 before code, G4 before delivery), the harness answers "Approved. Continue with the recommended option. Make reasonable assumptions about anything unknown." No human time is counted.
- **Grading:** four measures, no human in the loop.
  - A rubric of 7–8 items per task, taken from the merged PR. An Opus 5.5 judge marks each item pass or fail and gives a verdict: merge, merge after fixes, or reject.
  - Behavior tests that check the requested behavior on the result.
  - The PR's own tests, and a count of existing tests the change broke.
  - Blind pairwise comparison: the judge sees two results with labels hidden, in both orders. A result wins only when both orders pick it; otherwise it is a tie.
- **Cost and time:** the cost the model reports, and wall-clock time for the whole run, subagents included.

The evaluation harness and the task data stay private, because they hold the company's code.

## Round 1: the kit on a frontier model (kit 5.3.0)

21 runs over 5 tasks, all on Opus 5.5.

| Arm | Rubric pass rate | Pairwise wins · ties · losses | Cost per run (median) | Time per run (median) |
|---|---|---|---|---|
| A: plain Opus | 84% | 3 · 1 · 10 | $0.69 | 1.8 min |
| B: Opus + Superpowers | 88% | 5 · 1 · 8 | $0.98 | 3.5 min |
| C: Opus + this kit | **92%** | **12 · 0 · 2** | $4.40 (6.4×) | 18.0 min (10×) |

All three arms passed every behavior test (6/6). The differences showed up only in the rubric and in the blind comparison. The kit run won 12 of its 14 pairings and came out ahead at every task size. It cost 6.4 times as much as plain Opus and took 10 times as long. It also needed 2–3 human answers per run.

## Round 2: making the kit cheaper (5.4.0 release candidates)

The goal was the same quality as plain Opus at lower cost and no more than 1.3× the time. The kit runs below used Superpowers too.

| Arm | Main model | Runs | Rubric | Cost (median) | Time (median) |
|---|---|---|---|---|---|
| A: plain Opus | Opus | 10 (6 tasks) | 73% | $1.18 | 2.9 min |
| D: kit rc.1, Opus main, Sonnet subagents | Opus | 2 (2 tasks) | 80% | $6.55 | 34.6 min |
| E: plain Sonnet | Sonnet | 6 (2 tasks) | 44% | $0.41 | 1.7 min |
| F: kit rc.16, Sonnet main, Opus writes the Story | Sonnet | 10 (6 tasks) | 71% | $1.16 | 6.0 min |
| F: kit rc.17, plus a direct lane, without the review subagent | Sonnet | 10 (6 tasks) | 71% | $1.63 | 7.9 min |

- **The kit lifts a mid-tier model to frontier quality.** On the two tasks both ran, plain Sonnet (E) scored 42% and 48%. The kit on Sonnet (F) scored 83% and 57%, and plain Opus scored 75% and 57%.
- **At about frontier cost.** Kit F's median cost matched plain Opus ($1.16 against $1.18). But the blind comparison against plain Opus came out even, 5 wins and 5 losses, so the kit bought no quality over Opus.
- **Small tasks:** same quality (rubric 100% for both), and F won both pairings because it wrote tests and changed nothing outside the request. It cost 1.76× as much and took 2.3× as long.
- **Large tasks:** same rubric (68%), at 1.78× the time.
- **Ambiguous requests:** F lost three of them. Its Story step settles open points early, with at most 12 exploration calls, and a quick `ASSUMED` default. Three times that default differed from the reading plain Opus chose, and from the merged PR.
- **An Opus main session cannot be cheaper than plain Opus.** In D, the main session's Opus share alone cost more than plain Opus's whole run. Each turn re-read about 137k tokens of context, against 65k for plain Opus.

## What moved the numbers

Between rc.2 and rc.16, each change was measured again on the same tasks.

| Change | Measured effect |
|---|---|
| A CLI command (`graph.mjs copies`) that lists parallel copies of the code a change touches, such as the same component under sibling brand folders | The Story covered every copy in 3/3 runs, up from 1/3 |
| Gradle `--tests` routed to the module that holds each test | One large task: 21.4 → 9.9 min, $2.71 → $1.81 |
| rc.17: a direct lane (no Story, gates or subagents) for a change that leaves nothing to decide | Taken on 1 of 10 runs, the smallest task: $0.29 and 1.0 min against $0.33 and 0.7 min for plain Opus, same rubric, and it won the blind pairing. The only run where the kit cost less than plain Opus |
| rc.17: no review subagent; the implementer runs tests only through the kit's CLI | Cost rose. Implementers used the CLI's full check as their test loop (one small task: 3 failed attempts, 10.3 min against 4.0 in rc.16), and the median run cost $1.63 against $1.16 |
| rc.18: the direct lane kept, the review subagent and a single RED run brought back (3 runs) | Both small tasks took the direct lane, with the same rubric as plain Opus (7/7) and both blind pairings won. One cost $0.40 and took 1.7 min against $0.67 and 2.4 min for plain Opus: the first task where the kit met all three goals. The other cost $0.36 and took 1.5 min against $0.33 and 0.7. The large task did not improve: $2.46 and 13.2 min against $1.27 and 4.2, though it won its pairing (rubric 7/8 against 6/8) |
| Prose rules for Story scope, added to the instructions | No lasting gain. Fixing one failure caused another, and the Sonnet main session sometimes skipped the rule |

Deterministic tools with tests behind them moved the numbers. More instructions did not.

## Where the time goes

The kit runs fixed steps in order: Story, approval, implementation, review, verification, approval. On a large task (9.4 min in total), the Story subagent took 2.1 min and implementation 5.2 min (2.2 min of it Gradle). Review took 0.8 min, and verification plus approvals 0.5 min. Plain Opus finished the same task in 4.3 min. On a small task the fixed steps alone cost more than plain Opus's whole run: 3.3 min against 0.7. In 10 of 10 runs the review subagent returned `pass`. It cannot catch a misread request, because it checks the diff against the Story, and in those runs the Story itself held the misreading.

## Limits

- Small samples. Four of the six tasks in round 2 ran once per arm. Plain Opus on one large task varied from $1.27 to $1.88 and from 4.2 to 6.7 min across repeats.
- One team's code: three repositories, with no large front-end task.
- The judge is a model, the same model as the plain-Opus arm. It may prefer its own style; this was not ruled out.
- The rubric takes the merged PR's reading as correct, so a different reasonable reading fails.
- Approval gates were answered automatically. A person who reads the Story at G1 could catch a misreading, but that would cost the person's time, and neither was measured.

## Takeaways

1. On today's frontier models, a plain agent session already plans, edits and tests by itself. A fixed process on top adds steps and context, so it adds cost and time. On tasks of this size it added a little quality (8 points of rubric in round 1) at 6× the cost.
2. A process kit is worth more on a weaker model: it raised Sonnet's rubric score by 9 and 41 points on the two tasks where both ran. But the result cost about the same as running the frontier model directly.
3. Deterministic tooling earned its place. A command that finds parallel copies, or one that runs the right tests in the right module, gives the same benefit to any model and costs little. Process rules written in prose did not reliably change model behavior.
