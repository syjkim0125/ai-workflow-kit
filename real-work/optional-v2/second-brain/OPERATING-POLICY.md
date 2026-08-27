# Second Brain Operating Policy for Engineering

## Store
- cross-project architectural patterns with evidence
- durable domain concepts
- research repeatedly used in decisions
- validated incident lessons that generalize
- historical rationale that matters across repositories

## Keep repo-local instead
- transient task status
- file/line references likely to drift
- routine implementation details visible in current code
- one-off fixes with no reusable lesson
- unverified hypotheses

## Retrieval rule
Memory is a map to evidence, not proof of current code state. Verify code/config/schema claims against the current repository before acting on them.

## Promotion rule
Preferred path:
`verified work -> /ce-compound -> docs/solutions -> explicit reusable candidate -> Second Brain inbox/raw -> compile/ingest`

Do not automatically mirror `docs/solutions/` wholesale.

## Maintenance
Use the chosen Second Brain implementation's own integrity/lint mechanism and Compound's `ce-compound-refresh` for repo-local learning drift. Do not create a third memory-maintenance workflow without a concrete gap.
