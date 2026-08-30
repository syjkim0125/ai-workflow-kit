# Team AI Development Workflow — V1

## Design goal
Use one primary orchestration lifecycle, right-size checkpoints by risk, and preserve useful repo-local knowledge without turning every task into ceremony.

## Core stack

```text
Always-on principles + lifecycle: AGENTS.md (read by every runtime)
Claude adapter:       CLAUDE.md (imports AGENTS.md; slash-command mapping)
Codex adapter:        AGENTS.md + .agents/skills/ (native discovery)
Primary lifecycle:    Compound Engineering (all runtimes)
Org adapter:          story-breakdown (only for oversized approved Stories;
                      mirrored in .claude/skills/ and .agents/skills/)
Repo learning:        docs/solutions/ via ce-compound
Global Superpowers:   keep installed; explicit opt-in only
```

## Requirement artifacts: right-size them
- large/new product capability: PRD may help;
- normal feature: Jira Story/Issue with a clear Acceptance contract may be enough;
- bug: expected vs actual behavior + reproducible evidence;
- technical work: technical problem statement + completion evidence;
- material unknown: bounded Spike/Discovery item. Frame it as exploration: state the destination (the outcome that must become true), name the fog (the specific unknowns blocking honest planning), then type each unknown (research / prototype / discussion), work only currently unblocked ones, and write resolutions back to the plan so new unknowns surface. Prefer prototypes over more documents when feedback on something real would settle the question. If planning fits one session, plan in one session — this framing is only for genuine fog.

Do not create a PRD merely because a PRD template exists.

`templates/ACCEPTANCE.md` defines the required content, not a mandatory destination file. Keep one canonical Acceptance contract in the smallest suitable artifact:
- an existing Jira Story or PRD when it already contains the full contract;
- the unified plan's Product Contract when CE brainstorm/plan owns intake;
- a dedicated Acceptance document only when neither existing artifact is appropriate.

Applying `templates/ACCEPTANCE.md` means writing its required sections and decisions into that chosen canonical artifact. Merely linking the template is not sufficient, and creating a separate `ACCEPTANCE.md` file is not required.

The canonical artifact must show `Draft` or `Approved` and record approval evidence. An agent-written draft is not approved. Approval of the request, a direction such as “go ahead,” or approval of a later task breakdown does not approve the exact Acceptance contract.

When requirements arrive, classify before decomposing:
- **Destination** — explicitly required outcomes;
- **Fog** — unspecified but behavior-affecting decisions: resolve with the narrowest documented assumption, never silently;
- **Frontier** — optional/deferred scope, touched only after Destination is verified.

Not specified ≠ out of scope. Unspecified behavior is a decision to record, not a requirement to invent.

A one-line request is a valid entry point. Do not silently expand it and do not demand a document up front: interview the requester (CE brainstorm, or the questioning phase of CE plan) and co-write the canonical Acceptance contract using `templates/ACCEPTANCE.md` as the checklist. Present the complete Goal, MUST/SHOULD, negative behaviors, unspecified policies, and deterministic verification approach. Obtain explicit human approval of that exact contract before classification, sizing, breakdown, planning, Jira publication, or implementation. For a large new capability, the PRD may carry the contract instead. Conditional checklist fields may be `N/A — reason`; do not invent mechanisms solely to fill a template.

## Product-to-engineering flow

```text
Request / existing product context
        ↓
Choose one canonical Acceptance artifact
        ↓
Write templates/ACCEPTANCE.md content into it (Draft)
        ↓
G1 understanding gate: learning-gate acceptance
        ↓
Human approves exact Acceptance contract (Approved)
        ↓
Classify and size the approved work
        ↓
Story Map / product decision when the capability needs it
        ↓
Approved Story or PR-sized work item
        ↓
Already one reviewable PR?
   ├─ yes → keep one engineering task
   └─ no  → story-breakdown
        ↓
PR-sized task
        ↓
Human approves exact task breakdown when split
        ↓
Risk / reversibility gate
   ├─ small → direct implementation path; record `Plan source: N/A`
   ├─ normal → /ce-plan
   └─ high-risk → /ce-plan + human plan checkpoint
        ↓
Implementation-ready task description
        ↓
Optional: create or update Jira Task from templates/JIRA-TASK.md
        ↓
Execute with the selected lifecycle
```

Do not feed an entire product PRD into `story-breakdown` and ask it to manufacture a project plan. Story mapping and product scope decisions happen first.

### Jira publication handoff

Jira publication is optional and is not owned only by `story-breakdown`; the same handoff applies to one approved PR-sized task and to an approved multi-task breakdown.

- Publish an executable or Implementation-ready issue only from an approved Acceptance contract and an approved task definition. The explicit Draft-placeholder exception below may be created earlier, but it must not be treated as executable.
- For normal or high-risk work, create or update Jira only after `ce-plan` produces an implementation-ready plan. Populate implementation approach, change surfaces, contracts, test scenarios, and verification from that plan.
- For small reversible work that legitimately skips `ce-plan`, set `Plan source: N/A — small reversible task` and include the concrete inspect/implement/verify approach directly.
- If a requester explicitly asks for a Jira placeholder before planning, mark it `Readiness: Draft`. Do not treat it as executable. Update the same issue after planning instead of creating a duplicate.
- Create regular Tasks by default. Link them to the source Story with an issue link rather than silently using a Sub-Task parent relationship.
- Create and update Jira Stories and Tasks bilingually by default. Write the Summary as `<concise Korean> / <concise English>`, then write the Description in Korean followed by its English translation using `templates/JIRA-STORY.md` or `templates/JIRA-TASK.md`.
- Treat the Korean section as the authoring source and the English section as its synchronized translation. Use the same stable item IDs and order in both sections; leave code identifiers, paths, payloads, and commands unchanged. Before publishing or updating, check that neither language adds or omits scope, acceptance, implementation, or verification details.
- Use the Jira-wiki section order in `templates/JIRA-STORY.md` as the fixed Story-canonical shape: title and delivery metadata, then User Story, Context, Goal, MUST, SHOULD, Decisions/Out of Scope, Verification, Verification enablement, Documentation contract, and Environment assumptions in both languages. Do not omit the enablement, documentation, or environment sections; write `N/A — reason` when they do not apply.
- Keep Task delivery details in Jira issue links and the Task descriptions. Do not append ad hoc `References` or implementation-delivery sections to the Story contract when the same trace already exists in Epic, branch metadata, linked Tasks, or their plan sources.
- Resolve the target project/Epic, issue type, link type, and duplicates before writing. Verify created or updated keys, readiness, Epic placement, and Story links afterward.

### Story integration branch delivery

Use this flow when an approved Story is split into two or more independently reviewable Tasks. A Story branch is an integration and Acceptance surface, not a substitute for `main` or a place for untracked implementation.

```text
main with official workflow
        ↓ merge prerequisite feature PR
main with prerequisite behavior
        ↓ create Story integration branch
story/<STORY-KEY>-<slug>
        ├─ task/<TASK-KEY>-<slug> → Task PR → Story branch
        └─ task/<TASK-KEY>-<slug> → Task PR → Story branch
        ↓ all approved Task PRs merged
Story-level automated + human Acceptance review
        ↓ human verdict: Accepted
Story PR → main
```

- Land an approved workflow-only change on `main` before creating product branches that depend on it. Keep that commit free of product code, feature plans, generated artifacts, and personal tool configuration.
- Merge every prerequisite feature into `main` before creating the dependent Story branch. The Story branch base must therefore contain both the official workflow and the behavior the Story will verify or extend.
- Name the integration branch `story/<STORY-KEY>-<slug>`. Record its base ref and final PR target in the Story.
- Name implementation branches `task/<TASK-KEY>-<slug>`. Create an isolated branch/worktree per Jira Task from the Story branch and record the Story branch as the Task PR target.
- Parallelize only disjoint Tasks. A dependent Task starts after its prerequisite Task reaches the Story branch, or synchronizes the Story branch before its final verification and PR review.
- Merge implementation through reviewed Task PRs. Direct commits to the Story branch are limited to explicit integration-only changes that cannot honestly belong to one Task; link those changes to the Story and review them separately.
- Do not merge a Story branch to `main` merely because all Tasks are Done. Run the Story Acceptance review below and obtain the human verdict first.
- If a Story has only one PR-sized Task, skip the integration branch unless a real integration or Acceptance need justifies it; target that Task PR directly to `main`.

### Story Acceptance review

The canonical Acceptance contract is also the review checklist. After all approved Task PRs are merged into the Story branch:

1. Synchronize the current target `main` into the Story branch, then record both the reviewed Story head commit and reviewed `main` base commit. If either ref changes afterward, synchronize again and repeat affected Acceptance checks.
2. Build and run from that exact Story head and base pair. The final Story PR must present the same reviewed pair; conflict resolution or another integration change invalidates the earlier verdict until rechecked.
3. Check every MUST and Verification ID independently. Record `PASS`, `FAIL`, or `BLOCKED` plus an evidence link or reproducible note.
4. Exercise user-visible flows manually when the Story promises direct interaction; automated Task tests alone do not replace this check.
5. Treat SHOULD items as non-blocking but record any omissions explicitly.
6. Re-run affected checks after fixes; never convert a prior failure to PASS without fresh evidence.
7. Record results in the canonical Acceptance artifact. For a Story-canonical Jira issue, append the `templates/ACCEPTANCE.md` review record only after integration begins; the Story creation template stays focused on the approved contract. If Jira is not canonical, keep only its source link and stable ID coverage instead of a second contract or verdict.
8. Run `learning-gate story` (G5) over the integrated Story branch: does the whole satisfy the contract, including the integration points no single Task owned? Confirm every Task's G4 record line is present, then write the G5 record line.
9. Ask the human owner to judge evidence sufficiency and record `Accepted` or `Rejected`. Agents may prepare evidence but do not make this verdict implicitly.
10. Open or merge the Story PR to `main` only after all MUST and Verification items pass and the human verdict is `Accepted`.

For a verification Story built on an earlier feature, map the earlier Story's Acceptance IDs to the new Story's interactive or automated checks. This makes the verification Story a concrete acceptance harness for the already-merged behavior instead of a disconnected demo.

## Risk / reversibility gate

### Small / reversible
```text
inspect → implement → focused verify → review diff → G4 (or record N/A)
```
Do not force `/ce-plan` when it adds no decision value.

### Normal multi-step
```text
/ce-plan → /ce-work → right-sized review → verify → G4 → merge
```
`ce-plan` should capture decisions, scope, relevant files, test scenarios, and risks — guardrails rather than pre-written implementation choreography.

### High-risk / hard to reverse
Examples: payment, auth/security, public contracts, schema/data migration, message/event compatibility, concurrency correctness.

```text
/ce-plan → G3 → human plan checkpoint → /ce-work → deeper review/verification → G4 → merge
```

## Bugs
Use `/ce-debug` when root cause is not already established. Reproduce and trace before patching.

## Review and verification
Review depth should match risk and diff complexity. Ground truth is the approved Acceptance contract plus fresh executable evidence from current code, tests, build, static checks, and runtime behavior.

Review is comprehension, not approval: the reviewer should be able to explain the change afterward. If a diff has grown past what one reviewer can genuinely understand, that is a signal to re-split the task, not to skim harder.

Every change passes an understanding gate before merge: run `learning-gate diff` (G4). It produces a three-layer artifact — an eli5 opening of one picture and at most five jargon-free sentences, then the decisions the owner must make, then runtime/data-flow order, invariants, failure paths, what each test proves and what remains unproven. In diff mode the owner predicts before anything is revealed, and the reveal names the gaps; that prediction is what makes the gate a check rather than a reading assignment. The owner must be able to restate the change afterward.

When the diff is small enough to read at a glance, record `Understanding gate (G4): N/A — <reason>` instead of running the full cycle, the same way `Plan source: N/A — small reversible task` works. The skip stays visible.

The gate is satisfied by evidence: an artifact under `docs/understanding/` and one record line in the canonical Acceptance artifact, verified with `bash .claude/skills/learning-gate/scripts/check-understanding.sh`. Purpose is preventing cognitive debt, not producing documentation.

Use goal-backward verification: **what must be true if this outcome is actually complete?** Every non-trivial task ends with an explained completion: what changed, why it fits, key trade-offs, verification run with results, remaining assumptions/risks.

## Learning loop
After verified work, evaluate:

> Will a future engineer/agent otherwise have to rediscover a non-obvious, evidence-backed lesson from this work?

- No: finish.
- Yes: present the learning candidate briefly and ask before persisting it. If approved, `/ce-compound` → `docs/solutions/`.

Do not create memory for routine task status, obvious code facts, speculation, or line-number trivia.

The learning loop also applies to the process itself: when a skill or workflow step misbehaves, capture that case as a pressure-test scenario in the skill's `EVALS.md` and re-run it after revising the skill.

When multiple tasks or sessions run in parallel on one repository, isolate each in its own git worktree; do not share a mutable checkout.

## Superpowers coexistence
Superpowers may remain globally installed. Do not uninstall or modify the global installation.

For this repository, Superpowers is **explicit opt-in only**:
- Compound is the project default lifecycle.
- Do not invoke `using-superpowers`, brainstorming, planning, TDD, debugging, review, verification, or other Superpowers lifecycle skills merely because they are installed, discoverable, or appear relevant.
- The agent must not self-select Superpowers as a "unique capability" exception.
- Use Superpowers only when the user explicitly asks for Superpowers or explicitly names a Superpowers skill.
- When explicitly selected, do not duplicate the same responsibility with Compound.

## Repository knowledge routing
- Product intent and scope: `docs/product/PRD.md` when present (created from `templates/PRD.md` when the project adopts a PRD)
- Team AI development workflow: `docs/engineering/AI-WORKFLOW.md`
- AI tooling/onboarding: `docs/engineering/AI-SETUP.md`
- Requirement templates: `templates/`
- Understanding gate contract: `templates/UNDERSTANDING.md`
- Understanding gate artifacts: `docs/understanding/` when present
- Durable solved problems: `docs/solutions/` when present

## V2 trigger: Second Brain
Add cross-project memory only after repo-local knowledge exists and repeated cross-repository retrieval pain is observed. Do not make it a V1 prerequisite.
