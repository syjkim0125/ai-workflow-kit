h1. <한국어 Story 제목> / <English Story title>

*Acceptance status:* Draft | Approved
*Contract mode:* Story-canonical
*Epic:* <EPIC-KEY>
*Acceptance source:* this Story
*Approval evidence:* <active-conversation confirmation or durable record>
*Integration branch:* story/<STORY-KEY>-<slug> | 승인 후 PR 크기 판단 | N/A — single-Task Story
*Base ref:* main@<commit> | 승인 후 확정
*Final PR target:* main

h2. 한국어

h3. 사용자 스토리

<사용자/행위자>로서, <결과>를 얻기 위해 <기능>을 원한다.

h3. 배경

이 Story가 필요한 이유와 승인된 사용자 여정에서의 위치를 1–3줄로 작성한다.

h3. Goal

* G1. <완료 후 사용자가 얻는 결과>

h3. MUST

* [ ] M1. <독립적으로 검증할 수 있는 필수 행동>
* [ ] M2. <시스템이 거부하거나 절대 해서는 안 되는 행동>

h3. SHOULD

* [ ] S1. <MUST를 대체하지 않는 선택적 개선>

h3. 정책 결정 및 범위 제외

* D1. <요청에서 빠진 동작 정책에 대한 좁고 일관된 결정과 근거>
* O1. <이 Story에 포함하지 않는 항목>

h3. Verification

* [ ] V1. <입력, 행동, 기대 결과가 명확한 결정적 성공 검증>
* [ ] V2. <실패·경계 조건 또는 초기화 방법 검증>

h3. 검증 지원

* E1. <결정적 성공 검증, 실패 조건 강제, 초기화, mock/real 경계 또는 N/A — 이유>

h3. 문서화 계약

* DOC1. <실행 방법, mock 범위, 구현/미구현 범위, 트레이드오프 또는 N/A — 이유>

h3. 환경 가정

* ENV1. <검증에 필요한 런타임·배포 가정 또는 N/A — 이유>

h2. English

h3. User Story

As a <user/actor>, I want <capability>, so that <outcome>.

h3. Context

Explain in 1–3 lines why this Story exists and where it sits in the approved journey.

h3. Goal

* G1. <user-visible outcome when complete>

h3. MUST

* [ ] M1. <independently verifiable required behavior>
* [ ] M2. <behavior the system must refuse or must never perform>

h3. SHOULD

* [ ] S1. <optional improvement that never compensates for a missing MUST>

h3. Decisions and Out of Scope

* D1. <narrowest consistent policy decision and rationale>
* O1. <item excluded from this Story>

h3. Verification

* [ ] V1. <deterministic success check with clear input, action, and expected result>
* [ ] V2. <failure, edge-case, or reset verification>

h3. Verification enablement

* E1. <deterministic success, forced failure, reset, mock/real boundaries, or N/A — reason>

h3. Documentation contract

* DOC1. <run instructions, mock scope, implemented/deferred scope, trade-offs, or N/A — reason>

h3. Environment assumptions

* ENV1. <runtime or deployment assumptions required for verification, or N/A — reason>
