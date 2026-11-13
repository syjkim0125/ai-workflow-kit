# G4 Human Understanding Gate

This gate checks that the owner knows what the actual implementation does before delivery. It has two modes:

- **`ai-summary`** is the default. The agent explains the change in four short numbered lines, and the human approves.
- **`human-restatement`** is used when the owner asks for it, and it is required for any Story with a G3 decision (high-risk or hard-to-reverse work). The checker and the delivery check reject `ai-summary` for G3 Stories.

Before presenting G4 in either mode, run `node .ai-workflow/bin/graph.mjs status <run.json>` and require `action: g4`. Graph readiness only establishes recorded workflow evidence. It never supplies the human's answer and never approves this gate. For work completed before graph installation, initialize a run and record freshly checked implementation, review and verification evidence before continuing.

## Mode `ai-summary`

Write these four lines in the user's language, one or two lines each, from the approved Story, the diff, the test results and the review findings:

```
1. 사용자가 겪는 변화: <what changes for the person using it>
2. 지킨 규칙과 실패할 때 동작: <the invariant kept and what happens on failure>
3. 확인한 테스트: <which tests or checks proved it>
4. 확인하지 못한 것: <what is unproven: the evidence boundary>
```

Ask for approval and **END THE TURN.**

- Only an explicit approval from the human counts, such as "승인" or an equivalent reply.
- Silence, continuing the conversation, or a reply produced by another agent never counts.
- If the human corrects a line, fix it and ask again.

## Mode `human-restatement`

Predict before reveal:

1. Gather the approved Story, test results, review findings, and the **raw diff** or mechanical diff/stat. Show only that evidence; do not explain the solution yet.
2. Ask in the user's language: "이 변경 뒤에 사용자가 겪는 일이 어떻게 달라질까요? 꼭 지켜야 할 규칙과 실패했을 때의 동작은 무엇인가요? 어떤 테스트가 그걸 확인했고, 아직 확인하지 못한 것은 무엇인가요?" **END THE TURN.**
3. Only after the human answers, **compare** the answer with the Story, diff, runtime flow, and tests.
4. Return three short sections: correct, missed, incorrect/risky. Never reward confident guessing.
5. If a core gap remains, teach only that gap and require a one- or two-sentence **restatement**. Repeat until the owner can explain behavior, one invariant/failure path, and the evidence boundary.

## Record

Save the evidence, the human's actual reply, and (for `human-restatement`) the evaluation privately under `.ai-workflow/approvals/`.

The referenced G4 JSON records:

- `gate: "G4"`
- `mode`: `"ai-summary"` or `"human-restatement"`
- for `ai-summary`, `summary` (an array of the four lines shown) and `approvalText` (the human's reply)
- the canonical `storyHash`
- the current Graph `snapshot` and `runId`
- a nonempty `responseRef` pointing to the real response

See `verification.md`. `graph delivery` rejects a record whose mode differs from the Story's G4 line. Binding detects reuse; it does not authenticate a person. Never invent a response or obtain it from another agent.

Then replace the existing `Understanding gate (G4)` line in the Story's record footer; each gate line appears once. For `ai-summary`, add the mode:

`Understanding gate (G4): <artifact> · <date> · Check-in: accepted · Mode: ai-summary`

Append the pass line for the mode:

- `ai-summary`: `G4: APPROVED — <owner> approved the AI summary`
- `human-restatement` (a gate line without `Mode:`): `G4: PASS — <what the human correctly restated>`

`node .ai-workflow/bin/graph.mjs approve G4 <run.json> --summary <four-lines-file> --response <reply-file>` writes the JSON, both footer lines and `Status: Delivered`, then runs the delivery check. By hand, set `Status: Delivered` only after both records exist and the document checks and the bound delivery check exit 0:

```
node .ai-workflow/bin/check.mjs story <story-file>
node .ai-workflow/bin/check.mjs gate G4 <story-file>
node .ai-workflow/bin/graph.mjs delivery <run.json>
```

Run them and report the exit codes. Never claim the gate passed without that output. A `story` run on a Story that is not yet `Delivered` does not check G4 at all, and says so.

Use `G4: N/A — <specific reason>` only when no implementation behavior changed. Never use it to bypass uncertainty. Document-only `G4: N/A` remains a shape-check exception, not executable delivery proof. The delivery check requires a bound human G4 plus fresh Graph evidence; do not relabel N/A as runtime verification.
