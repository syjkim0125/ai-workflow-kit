<!-- BEGIN ai-workflow-kit -->
## AI workflow

- Start product or engineering work with the `workflow` skill before implementation.
- Keep one concise canonical Story contract: Goal, Domain, MUST, SHOULD, OUT, Decisions, Verify.
- Ask only blocking behavior questions; label safe defaults `ASSUMED` instead of silently inventing scope.
- Keep Tasks at most 30 non-empty lines and reference Story M/V IDs; HOW belongs to the repository-grounded plan.
- Use Compound Engineering when available: normal work `ce-plan → ce-work → ce-code-review`; high-risk work adds a human plan gate.
- Do not merge non-trivial changes until the workflow's G4 question gate records that a human understands behavior, an invariant/failure path, and the evidence boundary.
<!-- END ai-workflow-kit -->
