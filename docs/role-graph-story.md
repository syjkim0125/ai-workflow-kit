# Story: kit controls an assigned role's work
Status: Approved
Owner: project owner
Understanding gate (G1): docs/understanding/role-graph-scope.md · 2026-09-23 · Check-in: accepted
Understanding gate (G4): pending

## Goal
kit는 맡은 일을 끝내는 절차를 관리한다. Office는 여러 사람의 일이 하나의 목표로 이어지도록 관리한다. 단독 사용에서도 kit CLI로 진행·질문·수정·검증 기록을 보존한다. 역할 완료를 전체 목표 완료나 사람 승인으로 바꾸지 않는다.

## Domain
- Role completion: assigned work and its local checks have ended; downstream acceptance remains separate.
- Invariant: all roles reference agreed requirements. An agent cannot replace them with its own completion criteria.
- Invariant: kit owns local transitions; Office owns assignments, collaboration, integration, global resources and real approvals.

## MUST
- M1. PM, team-lead, developer and reviewer can initialize persistent role runs without repeating the whole delivery graph. Existing delivery runs remain compatible.
- M2. Required source and assigned scope are bound to a role run. Changed requirements require a new assignment/run. PM can clarify an unapproved request; implementation cannot bypass G1.
- M3. Questions pause work and answers resume the same attempt. Stale or duplicate answers/results cannot advance it. Questions do not count as failed tests or approvals.
- M4. External feedback carries evidence and invalidates affected work. Corrections retain attempt limits and independent evidence.
- M5. Installed guidance routes assigned roles through the CLI. English/Korean docs and an Office prompt explain state ownership, role completion and enforcement limits accurately.

## SHOULD
- S1. Reuse the existing scheduler, file lock, token and evidence checks; add no dependency.

## OUT
- O1. Office changes, ADK runtime, Jev, model execution, message broker, universal engine, worktree or permission manager.
- O2. npm publish, main merge, synthetic user acceptance or claims of real Office integration.

## Decisions
- D1. User authorized planning and implementation; see the G1 source quote.
- D2. Role runs use a versioned assignment and built-in small graphs. CLI files own local execution; Office may mirror them but must not independently advance the same state.
- D3. Questions and feedback use local JSON commands. Office transports them; standalone users can answer through their agent.
- D4. Read/write scheduling is local to a run. Cross-run writer isolation and global limits remain host responsibilities.

## Verify
- V1 [M1]. Installed Codex and Claude CLIs finish role runs with role-complete and preserve existing delivery G4-ready behavior.
- V2 [M2]. Reject invalid roles/scope, unapproved implementation and changed source; accept a PM request before G1.
- V3 [M3]. Restart between question and answer, resume without consuming another attempt, reject duplicate/stale reply and old worker result, enforce question bounds.
- V4 [M4]. Feedback reopens only affected work, passes context to the next attempt, rejects stale feedback and cannot reset the attempt limit.
- V5 [M5]. Run full tests and package checks; inspect installed references and Office handoff examples against the real CLI.
