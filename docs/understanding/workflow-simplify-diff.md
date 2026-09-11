# Workflow simplify — G4 evidence and human check-in

Date: 2026-09-11
Story: [workflow-simplify-contract.md](workflow-simplify-contract.md)
Verification: [workflow-simplify-evidence.md](workflow-simplify-evidence.md)

## Evidence reviewed

Mechanical tracked diff against base c1a7070 before the G4 record update (`git diff --numstat`):

```text
10  5  README.md
25  0  skills/workflow/EVALS.md
1   1  skills/workflow/SKILL.md
15  5  skills/workflow/references/execution.md
1   1  src/managed-block.mjs
1   1  test/fixtures/expected-managed-block.md
```

The new, untracked `test/simplify.test.mjs` has 88 lines. The Story and verification record are task evidence, not package runtime additions.

Prior verification outputs, recorded in the linked evidence:

```text
RED: 3 failed, 1 passed; exit 1
Affected tests after review: 14 passed, 0 failed; exit 0
Final full suite: 86 passed, 0 failed; exit 0
Tarball fresh/update: codex, claude, both — passed
```

Review coverage: installed simplify skill applied; separate main-agent quality review; no independent-model review claimed. Native application sessions were not exercised. Generic skill validation remains incompatible with pre-existing `argument-hint` frontmatter. npm publication, push and merge were not performed.

## Human response

Initial response:

> 사용자의 흐름에 구현 후, ce-code-simplify로 코드 구현이 불필요하게 복잡해지지 않게 단순화 하는 FLow가 추가되었어. 단순화 중 지켜야 할 규칙은 기존 동작이나 이런거엔 영향 없어야 하고 불필요한 상태나 분기 복잡성을 기준으로 판단해. 줄 수나 반복문 표기나 체이닝 반복횟수 감소 등으로 판단하지 않아.

The assistant confirmed the behavior-preservation invariant and complexity criteria. It corrected the name to `ce-simplify-code`, clarified that related tests must pass first, and distinguished chaining/style changes from an actual verified reduction in traversals. It explained the missing evidence boundary: installation and automated checks do not prove that agents follow the instructions in real Codex/Claude sessions. The assistant then ended the turn and requested a restatement of that boundary.

Human restatement:

> 이번 검증으로 실제 배포된 후의 흐름이 잘 되는지는 확인할 수 없음

## Evaluation

- Correct: the user described the new simplification review, identified preserving existing behavior as an invariant, and used unnecessary state/branches/complexity rather than notation as the criterion.
- Previously missing: the initial answer omitted the evidence boundary. The follow-up correctly identifies deployed end-to-end operation as unverified. More precisely, local tarball propagation was tested; actual application-session compliance was not.
- Incorrect/risky: the initial skill-name typo and chaining/traversal ambiguity were corrected explicitly. No speedup, live-runtime success, independent-model review or release approval is inferred from the human answer.

G4: PASS — The human explained the added simplification flow, the behavior-preservation invariant, and that the current evidence cannot confirm actual deployed workflow operation.

This check-in closes the existing understanding gate only. It does not authorize commit, push, merge, npm publication, or changes to eevee-be.
