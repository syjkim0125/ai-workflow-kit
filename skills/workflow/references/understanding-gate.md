# G4 Human Understanding Gate

This gate checks ownership of the actual implementation. It is not a generated summary ceremony.

## Predict before reveal

1. Gather the approved Story, test results, review findings, and the **raw diff** or mechanical diff/stat. Show only that evidence; do not explain the solution yet.
2. Ask in the user's language: “이 변경이 사용자나 시스템의 어떤 behavior를 바꾸나요? 핵심 invariant 또는 failure path는 무엇이고, 어떤 테스트가 이를 증명하며 아직 unproven인 evidence boundary는 무엇인가요?” **END THE TURN.**
3. Only after the human answers, **compare** the answer with the Story, diff, runtime flow, and tests.
4. Return three short sections: correct, missed, incorrect/risky. Never reward confident guessing.
5. If a core gap remains, teach only that gap and require a one- or two-sentence **restatement**. Repeat until the owner can explain behavior, one invariant/failure path, and the evidence boundary.

## Record

Save the raw evidence, human answer, and evaluation to `docs/understanding/<slug>-diff.md`. Then record:

`Understanding gate (G4): <artifact> · <date> · Check-in: accepted`

Also append `G4: PASS — <what the human correctly restated>`. Set `Status: Delivered` only after both records exist and both of these exit 0:

```
node .ai-workflow/bin/check.mjs story <story-file>
node .ai-workflow/bin/check.mjs gate G4 <story-file>
```

Run them and report both exit codes; never claim the gate passed without that output. A `story` run on a Story that is not yet `Delivered` does not check G4 at all, and says so. Use `G4: N/A — <specific reason>` only when no implementation behavior changed; never use it to bypass uncertainty.
