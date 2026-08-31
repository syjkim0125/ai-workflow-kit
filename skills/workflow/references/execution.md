# Delivery and Execution

## Size first

- **Small/reversible:** one reviewable outcome, local effect. Record `Plan source: N/A — small and reversible`; use test-first implementation and review.
- **Normal:** use `ce-plan → ce-work → ce-code-review` when Compound Engineering is available. Otherwise perform equivalent repository-grounded plan, work, and review stages.
- **High-risk/hard to reverse:** add G3. Present the key design decision, alternatives, invariant, rollback/recovery path, and evidence plan; end the turn for human approval before work. Save that decision to `docs/understanding/<slug>-plan.md` and record `Understanding gate (G3): <artifact> · <YYYY-MM-DD> · Check-in: accepted`.

High-risk signals: money/payment, authentication/authorization, concurrency, destructive migration, sensitive data, data loss, and irreversible external side effects.

## Task rule

Create Tasks only when the approved Story cannot be reviewed as one PR. Each Task has one independent outcome, references Story M/V IDs, stays within 30 non-empty lines, and contains no speculative implementation choreography. **HOW belongs to the repository-grounded plan.**

## Execute

1. Read the approved Story, relevant code, tests, repository instructions, and prior learnings.
2. Make a plan that maps every M/V ID to code and evidence. Do not create a second requirement source.
3. For new behavior or a bug fix, demonstrate RED before production code, GREEN after the minimum change, then refactor while green.
4. Review the actual diff against the Story, including failure paths and what tests do not prove. Use `ce-code-review` for deep review when available.
5. Resolve or explicitly record material findings.
6. Continue to `understanding-gate.md`; passing tests alone are not completion.
