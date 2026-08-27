---
name: backend-coding-test
description: Use when solving a time-bounded backend coding assessment in an existing repository where correctness, architectural fit, testability, and explainable design decisions matter.
---

# Backend Coding Test

## Objective
Produce the smallest well-justified change that fully satisfies the required behavior, fits the existing repository, is verified by evidence, and can be explained in an interview.

Do not optimize for code volume, novelty, or speculative extensibility.

## Workflow

### 1. Ground
Before editing, inspect enough context to understand the current system:
- task statement and constraints
- build/test entry points
- relevant production path and nearby tests
- existing error, transaction, persistence, and naming conventions

Current code/tests/config describe the current state. The task describes the desired state.

### 2. Map
Briefly identify:
- required behaviors
- affected domain/code path
- invariants and material edge cases
- verification points

For long tasks, also propose a time budget across slices and final verification before implementing.

Do not commit to a file list or architecture before inspecting existing patterns.

### 3. Verdict
Choose the implementation strategy before coding. Prefer:
1. extending an existing pattern;
2. a small local abstraction when it protects a real invariant or removes meaningful duplication;
3. broader structure only when the requirement or current architecture demands it.

Reject speculative layers, premature interfaces, generic frameworks, and unrelated refactors.

When relevant, explicitly consider transactions, idempotency, concurrency, validation, persistence consistency, failures, and side effects.

### 4. Acceptance
Translate the prompt into a compact behavioral checklist. Every item must be independently verifiable.

If something is ambiguous, inspect nearby code/tests and choose the narrowest consistent assumption. Record it; do not invent hidden product requirements.

### 5. Slice Loop
Implement one meaningful behavior at a time:
1. add or identify a useful behavior test;
2. make the smallest production change;
3. run focused verification;
4. refactor only after correctness;
5. report what changed and its verification evidence, then pause for direction before the next acceptance item.

Do not force tests for trivial wiring. Material business rules and regression-prone behavior should have executable evidence when the repository supports it.

### 6. Review
Re-read the diff skeptically:
- all acceptance items covered?
- unrelated behavior changed?
- conventions preserved?
- invariants enforced at the right boundary?
- edge/failure cases explicit?
- abstractions worth their cost?
- tests proving behavior instead of implementation details?

Simplify or delete code when possible.

### 7. Verify
Before claiming completion, run the strongest practical evidence:
- relevant tests; broader tests if time permits
- build/compile
- configured lint/static checks
- final diff/status inspection

Never claim success from reasoning alone when executable verification is available.

### 8. Explain
Finish with:
- what changed
- why the design fits the existing system
- key invariant/trade-off
- commands/tests actually run and results
- explicit assumptions or remaining risk

## Time Pressure
Protect, in order: correctness and explicit requirements, executable verification, architectural fit. Cut optional refactoring and polish first.
