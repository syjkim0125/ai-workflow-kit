# <한국어 엔지니어링 결과> / <English engineering outcome>

**Readiness:** Draft | Implementation-ready
**Acceptance source:** <approved Story/PRD/Product Contract URL or path>
**Acceptance approval:** <evidence>
**Plan source:** <implementation-ready plan URL/path> | N/A — small reversible task
**Language policy:** Korean is the authoring source; English is a synchronized translation. Keep the same IDs and order in both sections.
**Story branch / branch base:** story/<STORY-KEY>-<slug> | main@<commit> — single-Task Story
**Task branch:** task/<TASK-KEY>-<slug>
**PR target:** story/<STORY-KEY>-<slug> | main — single-Task Story

## 한국어

### Goal
- G1. <이 Task가 만드는 엔지니어링 결과>

### Story 인수조건 대응
- C1. <Story의 M/V ID와 이 Task의 책임>

### 범위
- I1. <포함>
- O1. <제외>

### 구현 접근
계획이 필요한 작업은 `ce-plan`의 결정, 컴포넌트 경계, 구현 순서를 옮겨 적는다.
- A1. <구현 단계와 책임 경계>

### 변경 지점
- F1. <애플리케이션/모듈과 예상 책임>
- F2. <테스트 파일 또는 검증 지점>

### API / 데이터 계약
- K1. <endpoint, 요청/응답 필드, 상태 전이, 저장소 또는 서비스 계약>
- 계약 변경이 없으면 `N/A — <이유>`를 작성한다.

### 테스트 / 검증 계획
- V1. <시나리오: 입력/행동/기대 결과>
- V2. <완료를 증명할 명령 또는 검사와 기대 증거>

### 완료 조건
- [ ] D1. <행동 또는 증거>
- [ ] D2. <관련 테스트 또는 검증>

### 의존성
없음

### 병렬 가능 여부
예/아니오 — <이유>

### 위험 / 미확정 사항
- R1. <위험과 처리 방법>

## English

### Goal
- G1. <engineering outcome produced by this Task>

### Story Acceptance coverage
- C1. <source Story M/V IDs and this Task's responsibility>

### Scope
- I1. <included>
- O1. <excluded>

### Implementation approach
For planned work, carry over decisions, component boundaries, and implementation order from `ce-plan`.
- A1. <implementation step and responsibility boundary>

### Change surfaces
- F1. <application/module and expected responsibility>
- F2. <test file or verification surface>

### API / data contract
- K1. <endpoint, request/response fields, state transitions, persistence or service contract>
- Use `N/A — <reason>` when the task changes no contract.

### Test / verification plan
- V1. <scenario: input/action/expected result>
- V2. <command or check that proves completion and expected evidence>

### Done when
- [ ] D1. <behavior or evidence>
- [ ] D2. <relevant test or verification>

### Dependencies
none

### Parallelizable
yes/no — reason

### Risks / unknowns
- R1. <risk and mitigation>
