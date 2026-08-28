---
name: story-breakdown
description: Use when an approved product or Jira Story with acceptance criteria appears too large, coupled, or uncertain to implement as one independently reviewable pull request in the current repository.
---

# Story Breakdown

## Purpose
Convert an approved user-outcome Story into the smallest honest set of PR-sized engineering units. This is an organization adapter; Compound Engineering owns detailed implementation planning and execution after a task is selected. Superpowers is not part of this Skill's default path.

## Preconditions
Require:
- an approved Story/user outcome;
- one canonical Acceptance source with observable criteria;
- explicit human approval of the exact Acceptance contract, with approval evidence;
- access to the current repository.

Use the PRD, architecture docs, and `docs/solutions/` only when relevant. Surface unresolved product decisions instead of inventing them.

Before sizing, name the Acceptance source and verify its `Approved` state or equivalent evidence. Informal request approval, scope-direction approval, and breakdown approval do not satisfy this gate. If the contract is missing or still Draft, stop and return to requirement intake.

## First decision: is breakdown needed?
A Story is already PR-sized when it has one coherent outcome that can be reviewed, verified, and reverted independently without depending on unfinished sibling work.

- **Yes:** return one compact task. Do not manufacture subtasks, dependency maps, or parallel groups.
- **No:** continue with decomposition.

## Breakdown method
1. Inspect the smallest relevant code/tests/docs and identify real boundaries and integration points.
2. Map Acceptance Criteria to capabilities that must become true.
3. Split only where outcomes can be reviewed and merged independently. Prefer vertical capability slices over controller/service/repository layers or service-directory ownership.
4. Keep changes that must be atomic for correctness in one task, even if they touch multiple services in a monorepo.
5. Create a Spike/Discovery task only when a critical unknown prevents honest decomposition.
6. Mark only real dependencies and parallelism.

## Output
For each task provide:

**Title** — coherent engineering outcome.  
**Goal** — capability added and Acceptance Criteria advanced.  
**Scope** — likely areas involved without prescribing exact implementation.  
**Done when** — goal-backward observable truths and verification evidence.  
**Dependencies** — only when real.  
**Risks / unknowns** — only when material.

Adaptive ending:
- one task: stop after the compact task;
- two or more: add proposed order/dependencies;
- complex multi-task work: add parallel groups and Acceptance Criteria → task coverage only when they improve coordination.

## Optional Jira publication handoff
Jira publication is a downstream handoff, not part of decomposition. Run it only when the requester asks to publish and the repository workflow's readiness gates are satisfied.

1. Present the exact task set and obtain human approval before creating issues. This is separate from upstream Acceptance approval.
2. Apply the risk / reversibility gate. If normal or high-risk work requires `ce-plan` and no implementation-ready plan exists, stop and route to planning; do not publish executable-looking Tasks from breakdown content alone.
3. Read `templates/JIRA-TASK.md`. Populate Goal, Acceptance coverage, Scope, Dependencies, Parallelizable, and Risks from the approved breakdown. Populate Implementation approach, Change surfaces, API / data contract, and Test / verification plan from the implementation-ready plan.
4. For a genuinely small reversible task that skips `ce-plan`, set `Plan source: N/A — small reversible task` and provide a concrete direct-work approach.
5. Resolve the source Story, target project/Epic, regular Task issue type, available issue-link type, and likely duplicates before writing.
6. Create regular Jira Tasks by default. Associate them with the Story through an issue link rather than a Sub-Task parent relationship.
7. Verify each issue's readiness, Acceptance and plan sources, Epic placement when applicable, and Story link. Return created or updated keys and dependency / parallel groups.

If a placeholder Task already exists from an earlier workflow, mark it `Readiness: Draft` until the missing gates are satisfied, then update that issue instead of creating a duplicate. If no safe authenticated Jira integration is available, return template-complete paste-ready drafts.

## Boundaries
Do not:
- rewrite the Story into a technical design;
- decide unapproved product scope;
- prescribe classes, databases, queues, caches, or endpoints merely from preference;
- duplicate Compound Engineering implementation planning (`ce-plan`);
- invoke Superpowers as a substitute or companion lifecycle unless the user explicitly requested it;
- split work only to mirror code layers, repository folders, or team ownership;
- add speculative compatibility or future infrastructure.
- infer Acceptance approval from a request, scope direction, or breakdown approval;
- publish normal or high-risk Jira Tasks before implementation planning is complete;
- present a Draft Jira Task as executable work.
