# Baseline failures observed in the existing workflow

1. A Jira Task repeats the Story, acceptance, plan, file list, API/data contract, verification, dependency, parallelism, and risk sections in two languages; a human cannot review it quickly.
2. The agent can turn a vague request into implementation details before behavior and failure semantics are approved.
3. MUST/SHOULD/OUT boundaries are diluted when copied into multiple artifacts.
4. A passing test is treated as completion even when the human cannot explain runtime flow, invariants, failure paths, or what remains unproven.
5. Onboarding requires reading several long documents and remembering multiple commands.
