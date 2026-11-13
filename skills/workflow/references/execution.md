# Delivery and Execution

## Assigned graph work

If a host such as Agent Office delegates a started kit node, use its run/token and perform only the assigned role's procedure below. Return evidence and feedback to that graph; do not restart the entire workflow. Office coordinates roles and communication, while the kit continues to govern the work graph. See `graph-advanced.md` for dispatch boundaries.

## Stage integration

Read `skill-integration.md` before selecting skills. Prefer Superpowers focused planning/implementation/review/verification skills and CE learning capture; CE planning, simplify and review modes are explicit alternatives. Keep one workflow owner. Existing approvals and the assigned role/task bound each invocation. Use the same evidence requirements with a disclosed direct fallback when a compatible skill is unavailable.

## Orchestration

The main session keeps the Story, G1, the plan and the G4 summary. Code reading and writing go to subagents, on the tiers in `model-selection.md`:

- **Implementation:** a mid-tier subagent. Its brief is the Story's MUST/Verify, the `begin` brief and the intake map. It writes the tests and code and returns a short summary. The main session reads that summary, `git diff --stat` and the check results, not the code.
- **Review:** one mid-tier subagent with the Story's MUST/Verify and the diff; two main-model reviewers for a Story that needs G3.
- **Escalation:** after two failed attempts on the same node, the main model takes over.
- Codex, or any host without subagents, does the same steps in the main session.

**Test volume:** one focused test per Verify item, and a second only for a distinct failure path in its MUST. Add no tests for behavior the Story does not change unless an Invariant names it.

## Size first

- **Light lane** (`Lane: light`): follow `light-lane.md`. Record `Plan source: N/A — small and reversible`.
- **Standard, one outcome:** the built-in minimal plan. The Story's MUST/Verify, the `begin` brief and the intake map are the implementer's spec; write no plan document. Record `Plan source: N/A — minimal plan`.
- **Normal:** several dependent outcomes. Use `superpowers:writing-plans` under the caller-owned contract → Superpowers focused TDD/diagnosis → inline simplification → bounded review with `superpowers:requesting-code-review` or direct review when compatible skills are available; simplify only after related tests pass. Apply the shared review allocation in `skill-integration.md` (default 1). Otherwise perform equivalent repository-grounded stages directly.
- **High-risk/hard to reverse:** add G3. Present the key design decision, alternatives, invariant, rollback/recovery path, and evidence plan; end the turn for human approval before work. Save that decision to `docs/understanding/<slug>-plan.md` and record `Understanding gate (G3): <artifact> · <YYYY-MM-DD> · Check-in: accepted`.

High-risk signals: money/payment, authentication/authorization, concurrency, destructive migration, sensitive data, data loss, and irreversible external side effects.

## Explain the plan before G3

Lead with the human-visible change and the reason for the chosen approach. Then explain the key design decision in plain language: what is kept, what changes, why the alternative was not chosen, what must never happen, how failures recover, and what evidence will establish success. Put code symbols and file paths afterward, only where they help review.

Use one concrete scenario rather than a list of framework names. Explain each proposed Task by the behavior it delivers and how it connects to the next Task, not just the repository or layer it touches. Keep already-approved decisions visible without asking for them again; ask only for a new material decision. This explanation belongs to the existing plan and G3 checkpoint, not an extra document or gate.

This is pre-implementation explanation, not G4. At G4, follow `understanding-gate.md` for the Story's mode: `ai-summary` by default, `human-restatement` (prediction before reveal) for G3 work.

## Task rule

Create Tasks only when the approved Story cannot be reviewed as one PR. Each Task has one independent outcome, references Story M/V IDs, stays within 30 non-empty lines, and contains no speculative implementation choreography. **HOW belongs to the repository-grounded plan.**

## Execute

For user-authorized optional Jira publication after G1, follow `jira.md`. Without a connector or authorized target, produce a preview only; the Story remains canonical.

1. Read the approved Story and the intake map. Open code only to settle a specific question; the implementer reads the code.
2. Choose the plan by size above and set up the run as `graph-minimal.md` describes (`profile`, `init`, `baseline`); several outcomes supply the reviewed task DAG (`graph-advanced.md`). Fix a wrong detected profile with `verification.md`: assert the actual user path and failure cases, rather than treating exit 0 from a no-op as behavioral proof. Do not create a second requirement source. Complete any required G3 before implementation nodes run.
3. `begin` each implementation node and dispatch the implementer (Orchestration above). It uses compatible `superpowers:test-driven-development`, and `superpowers:systematic-debugging` for unexplained failures. For new behavior or a bug fix it demonstrates RED before production code, then GREEN after the minimum change. Then `complete` the node; its checks decide.
4. Refactor while green: the implementer performs the simplification pass below. Use `ce-simplify-code` only when its actual dispatch fits the same round's allocation; otherwise apply the criteria directly.
5. Review the final diff against the Story, failure paths and testing limits with one reviewer (`skill-integration.md`): compatible `superpowers:requesting-code-review` or direct review, and bounded `ce-code-review mode:agent` only when the user or host selects it. Record its findings with `complete --verdict … --notes …`. Do not apply fixes from a read-only review assignment.
6. Apply compatible `superpowers:verification-before-completion` through `complete` on `workflow-verify`: it executes the configured checks, or reuses passing receipts for unchanged code. On a failure, read the receipt and raw log it names. Do not run a second verification pass solely to satisfy both names, and never claim old results cover new edits.
7. Require `next: g4` before continuing to `understanding-gate.md`; passing tests alone are not completion.

## Simplification pass

- Review is a default part of refactoring, not a change quota: no changes is a valid result when no clear benefit exists. Documentation-only or mechanical changes may need no code simplification; follow the skill's preflight.
- Limit scope to the current task's changed code and necessary related seams. Avoid unrelated refactoring, new abstractions or packages, and edits made just to fill a diff.
- Reduce duplication, unnecessary state, branches and complexity to improve understanding. Fewer lines or replacing `for` with a stream is not evidence of improvement; chaining operations does not necessarily reduce traversals. Check actual iteration and evaluation behavior before claiming efficiency.
- Preserve behavior, result order, side effects, domain boundaries, failure handling and safety checks. A proposal that changes them belongs to the existing design or scope-change process, not a silent simplification.
- The implementer simplifies inline by default. Any simplify workers consume the shared review allocation in `skill-integration.md`; select only skill modes that fit host limits.
- Include changes (or no-change outcome), review scope and fresh checks briefly in existing review/verification evidence. Add no separate approval gate, mandatory document or Jira Task.


## Graph planning and execution

Graph execution is installed and used automatically after G1. Small changes use the built-in minimal plan without a separate plan document; split larger work only where dependency tracking or independent verification helps. Keep the size-based route above: no planning ceremony for a small/reversible change.

Planning is repository-grounded planning → review → deterministic validation. Research code, tests and risks as needed; do not require separate analyzer, advocate or mediator agents. Reuse an existing plan, whichever skill produced it. The host performs agent/tool work and the installed CLI owns readiness, evidence records and recovery; never create a second nested orchestration pipeline for the same task.

The execution graph does not replace human gates. G1 still approves scope before planning/implementation, G3 still protects high-risk choices, and G4 still requires the human's own decision: explicit approval of the AI summary, or prediction-before-reveal restatement for G3 work. Superpowers focused skills and CE stage skills provide node behavior as mapped in `skill-integration.md`; the graph owns dependency and retry structure rather than copying those skills.

After each node, explicitly evaluate and record its evidence. Route failed checks to `fix`, changed assumptions to `replan`, and unresolved human decisions to `human`. For fixes within an unchanged plan, reset the earliest affected node and its descendants, preserving independent completed work. Changed plans/requirements require a new validated run; do not transplant stale evidence. Three attempts exhaust the run's retry allowance. Never silently create a new run to evade a stop. See `graph-minimal.md` for the executable protocol.

## Capture verified learning

After review findings are resolved and fresh verification passes, use the compatible non-interactive `ce-compound` mode in `skill-integration.md` to capture a reusable lesson in the resolved knowledge directory (default `docs/solutions/`). Otherwise record the proven cause, correction and prevention rule in the same directory directly. Skip the file when there is no reusable lesson; state that briefly. Read relevant prior lessons before later work. This is retrieval of project knowledge, not model retraining.

Capture once at the useful task boundary; do not make every role duplicate the same lesson. Learning records cannot replace G4 or turn an unverified hypothesis into a fact. For delegated work, return the lesson candidate to the delivery owner for consolidation.
