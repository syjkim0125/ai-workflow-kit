# story-breakdown — Evaluation Scenarios

These are behavioral scenarios for validating the Skill in a real agent runtime. Static checks alone do not prove compliance.

## 1. Already PR-sized Story
Given a small Story with one coherent outcome and clear AC, the Skill should return **one compact task** and stop. It must not invent subtasks, parallel groups, or a coverage matrix.

## 2. Large Story with two vertical outcomes
Given a Story containing two independently valuable/reviewable capabilities, split by vertical outcome rather than controller/service/repository layers.

## 3. Monorepo cross-service change
Given one user outcome that requires changes in `be-service` and `ai-service`, do not split merely because two service directories are touched. Split only if outcomes are independently reviewable/mergeable.

## 4. Critical unknown
Given missing information that materially changes the engineering approach and cannot be resolved from repo evidence, surface the question or create a bounded Spike/Discovery task rather than guessing.

## 5. Tempting horizontal decomposition
A Story mentioning API, service, repository, and persistence must not become separate layer tasks unless the repo proves those are independently shippable outcomes.

## 6. Real compatibility contract
When a released API/schema/external consumer is evidenced, preserve or explicitly migrate that constraint in task scope.

## 7. No compatibility contract
When no real contract exists, do not invent compatibility shims or migration tasks.

## 8. Goal-backward Done when
Each task's completion evidence should state observable truths that must hold if the Story outcome is achieved, not just activities such as "code implemented" or "tests added".

## 9. Planning boundary
The Skill may identify likely change surfaces but must not pre-write implementation code, exact class graphs, or detailed `/ce-plan` choreography.

## 10. Acceptance approval is required
Given a clear Story whose Acceptance checklist was drafted by an agent but not explicitly approved by the requester, stop before sizing or breakdown and return to requirement intake.

## 11. Breakdown approval is not Acceptance approval
Given informal scope agreement or approval of a proposed task split, do not treat either as approval of the exact Acceptance contract.

## 12. Planned Jira Tasks wait for planning
Given an approved multi-task breakdown classified as normal or high-risk, do not publish implementation-ready Jira Tasks until `ce-plan` supplies the implementation approach, change surfaces, contracts, and verification plan.

## 13. Premature Jira Task recovery
Given an existing Jira Task created before Acceptance or planning gates, mark it Draft and update that same issue after the gates pass. Do not create a duplicate or present it as executable.

## 14. Regular Task relationship
When publication is authorized, create regular Tasks linked to the source Story. Do not substitute Sub-Tasks merely to express the relationship.
