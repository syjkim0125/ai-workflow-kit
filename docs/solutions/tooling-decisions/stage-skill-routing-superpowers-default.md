---
title: Default kit planning and review to focused Superpowers skills; keep intake in the kit
date: 2026-11-04
last_updated: 2026-11-04
category: tooling-decisions
module: Stage skill routing (skill-integration)
problem_type: tooling_decision
component: development_workflow
severity: medium
applies_when:
  - Choosing which installed skill a kit stage (plan, implement, debug, review) routes to
  - A toolkit update or a new toolkit is proposed as a replacement for a kit stage skill
  - Deciding whether intake should call a brainstorming skill
tags: [skill-routing, superpowers, compound-engineering, pstack, benchmark, token-cost, writing-plans, requesting-code-review, intake, ce-brainstorm]
---

# Default kit planning and review to focused Superpowers skills; keep intake in the kit

## Context

Until this change the kit routed planning to CE `ce-plan` and review to bounded CE `ce-code-review mode:agent`, with Superpowers (SP) for TDD, debugging and fresh verification and CE `ce-compound` for learning. A proposal to keep only `ce-compound` and move every other stage to pstack prompted a controlled comparison on 2026-11-04.

Method: one fixture repository (about 84 lines of source), four tasks (implement coupons, debug a month-end billing bug, review a refund change with five planted defects, plan KRW/JPY carts), five arms (no toolkit, SP, CE 3.19, CE 3.35, pstack), one run per arm, same model. Implement and debug were graded by hidden tests (debug in three time zones). Review was graded against the planted-defect key. Plans were scored by two blind judges on a 10-point rubric; code quality by one blind judge on seven criteria (14 points). Cost is input + 1.25 × cache write + 0.1 × cache read + 5 × output tokens, nested subagents included.

| Stage | Quality (none / SP / CE 3.19 / CE 3.35 / pstack) | Cost, k weighted tokens (same order) |
|---|---|---|
| Implement | all 14/14 hidden tests | 332 / 576 / 314 / 504 / 1,048 |
| Debug | all 9/9 in 3 time zones | 269 / 280 / 2,852 / 3,589 / 720 |
| Review | all 10/10 (ceiling: task too easy) | 232 / 390 / 798 / 3,584 / 597 |
| Plan | 8.75 / 9.25 / 8.25 / 8.25 / 5.5 | 408 / 325 / 1,176 / 4,412 / 4,192 |
| Code quality, implement | 7 C / 13 B / 12 B / 13 B / 8 C | |
| Code quality, debug | 13 B / 13 B / 14 A / 11 B / 12 B | |

The two plan judges differed by up to 1.5 points, so only the pstack gap is clearly real: its 8,446-word plan depended on commits and a harness absent from the repository and added an unrequested public-API rename. The CE 3.35 plan run hit a spend limit and was finished by a second agent, which inflates its cost slightly.

A second comparison the same day covered intake, where the kit used `ce-brainstorm` "for material unresolved alternatives". Three named-feature requests on the same fixture (subscription pause with divergent billing options, receipt readability, a subscription price increase with items the PM had not settled) ran through kit intake alone, intake plus SP `brainstorming`, and intake plus CE `ce-brainstorm`, each stopping at the G1 question. A separate persona agent played the PM from a hidden answer key and revealed a fact only when a question touched it. Two blind judges scored each Story (facts captured, unsettled-item handling, questions, alternatives, overall /10).

| Intake arm | Mean overall /10 | Hidden facts captured | Cost, k weighted tokens |
|---|---|---|---|
| Kit intake alone | 7.2 | 26 / 30 | 979 |
| + CE `ce-brainstorm` | 7.0 | 26 / 30 | 2,368 |
| + SP `brainstorming` | 5.3 | 21.5 / 30 | 950 |

Both judges ranked the arms the same way in every scenario. CE led the divergent-billing scenario by one point (it captured the "request 7 days before renewal" cutoff cleanly) at 3.5× the cost and about seven minutes to its first question. On the price increase, only intake alone kept the unsettled "December invoices already issued" item as `OPEN BLOCKING`; CE downgraded it to a non-blocking ops note and SP labeled it `ASSUMED`, which the payment lens forbids. No arm asked how a price change is rolled back. With the caller-owned exploration instruction, all nine runs had zero contract violations: no extra spec, commit, self-approval or handoff menu.

## Guidance

- **Plan:** `superpowers:writing-plans` under a caller-owned instruction. The plan returns to the kit; the skill's Execution Handoff is skipped and the plan header names the kit graph as executor, because the graph owns dispatch and human gates.
- **Review:** `superpowers:requesting-code-review` (one reviewer per filled template, so one worker per assignment in the shared allocation) or direct bounded review.
- **CE:** `ce-plan` and `ce-code-review mode:agent` stay available when the user or host selects them. `ce-compound` still captures verified learning.
- **pstack:** keep only the vendored verification procedure; do not route stages to it.
- **Intake:** the kit's own `intake.md` explores alternatives; for a named change with divergent behaviors it shows two or three options with trade-offs and a recommended default as one question. Use `ce-brainstorm` only for an open idea (a goal or problem with no concrete change), when the user does not know what to build, or when the user selects it. Decide from the request before loading the skill, announce the choice, and pass the caller-owned exploration instruction. Do not route intake to SP `brainstorming`; it begins SP's end-to-end chain and scored lowest.
- **Payment lens:** ask for the rollback trigger of a changed price or charge rule and what happens to charges already issued.
- Decide routing by measured cost at equal quality. Re-measure instead of assuming a toolkit update helps: CE 3.19 → 3.35 kept every score and raised cost 1.3–4.5×.
- Keep code-style preferences (for example "prefer functional chaining") out of the kit. The measured quality failures were over-abstraction and unrequested behavior, and `execution.md` already states that replacing `for` with a stream is not evidence of improvement. Style belongs in each project's own instructions.

## Why This Matters

The routing table is applied to every task, so a stage skill's cost multiplies across all planning and review. At equal measured quality, CE cost 3.6–13.6× SP on planning and 2–9× on review, and pstack cost 1.5–12.9× SP on every stage.

The kit couples to upstream plugins only through the contracts it names, and agents read the installed skill at run time. An upstream release therefore needs a kit change only when one of those contracts changes:

- SP: `writing-plans` (Execution Handoff, plan header), `requesting-code-review` (reviewer template), `test-driven-development`, `systematic-debugging`, `verification-before-completion`.
- CE: `ce-compound mode:non-interactive`, `ce-brainstorm` (open ideas only, with the caller-owned exploration instruction; its Phase 4 menu can offer `lfg`, which opens a PR and pushes), plus the explicit alternatives `ce-plan`, `ce-code-review mode:agent`, `ce-work mode:return-to-caller` and `ce-simplify-code`.
- pstack: the vendored files under `skills/workflow/references/pstack/` are pinned by `provenance.json` and change only when re-vendored.

## When to Apply

- Before changing a row of the stage table in `skill-integration.md` or the README.
- When a toolkit release or a new toolkit claims better results: compare on a fixture with hidden tests, blind judging and nested-subagent cost before switching.
- At each kit release: check that the skill names and modes listed above still exist in the latest upstream versions.

## Examples

The caller-owned planning instruction now in `skills/workflow/references/skill-integration.md`:

> Caller-owned plan: save the plan and return its path and self-review result to this workflow. Skip the Execution Handoff; the caller owns execution, human gates and the next action. In the plan header, name this workflow's graph as the executor instead of an execution sub-skill. Return unresolved decisions as blockers.

The caller-owned exploration instruction for `ce-brainstorm`, used in all nine intake runs:

> Caller-owned exploration: return the decisions, alternatives considered and open questions to the kit intake. Do not write or commit a separate spec or requirements document, do not invoke a planning or implementation skill, and do not show a next-step handoff menu. The kit's Story and G1 are the only requirements source and approval.

A quality gap all five arms shared: SP and both CE versions reused the existing `percentOf` helper unchanged, so 1.4% of 2,750 rounded to 38 instead of 39. The two arms that fixed it (no toolkit, pstack) also added unrequested behavior or abstractions. None of the workflows both questioned the helper and stayed in scope.

Limits of this evidence: one run per arm, a small fixture, a review task with no discriminating power, some CE 3.19 and pstack runs had subagents refused by a concurrency cap, pstack ran from mirror files rather than an installed plugin, and learning capture and live verification were not measured. The intake comparison adds its own limits: one run per scenario, a simulated PM, runs stopped at G1 (an arm that raised an open item there might have recovered after the answer), and no open-idea request, which is exactly where the `ce-brainstorm` trigger now points.

## Related

- Introduced together with this doc on branch `feat/superpowers-plan-review-routing`: `skill-integration.md`, `execution.md`, both READMEs, `src/managed-block.mjs`, `src/graph/roles.mjs` and the Unreleased CHANGELOG entry.
- Intake routing added on branch `feat/intake-brainstorm-trigger`: `skill-integration.md`, `intake.md`, `domain-risks.md`, both READMEs, `test/structure.test.mjs` and the Unreleased CHANGELOG entry.
- [Installed graph execution contract](../integration-issues/installed-graph-execution-contract.md): why rewording role nodes requires restarting in-flight role runs.
