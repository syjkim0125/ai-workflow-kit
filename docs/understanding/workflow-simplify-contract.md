# Story: 테스트 이후 동작 보존 단순화 검토
Status: Delivered
Owner: JongKun Kim
Understanding gate (G1): docs/understanding/workflow-simplify-evidence.md · 2026-09-11 · Check-in: accepted
Understanding gate (G4): docs/understanding/workflow-simplify-diff.md · 2026-09-11 · Check-in: accepted

## Goal
사용자는 기존처럼 workflow를 시작한다. AI는 관련 테스트를 통과시킨 뒤 이해하기 쉽게 정리할 여지를 검토하고, 최종 변경을 리뷰·재검증한 다음 기존 G4로 진행한다.

## Domain
- 단순화는 동작을 유지하는 정리다. 검토는 기본이지만 수정은 선택이다.

## MUST
- M1. ce-simplify-code가 있으면 읽고 실행하며, 없으면 같은 기준으로 직접 검토한다. 설치 요구나 중단 없이 진행한다.
- M2. 현재 변경과 필요한 연관 부분만 검토한다. 이득이 없으면 변경 없이 통과하며, 무관한 정리·새 추상화·패키지를 추가하지 않는다.
- M3. 중복·불필요한 상태·분기·복잡성을 기준으로 판단한다. 줄 수나 반복문 표기 변경, 체이닝을 반복 횟수 감소와 혼동하지 않는다.
- M4. 동작·결과 순서·부수 효과·도메인 경계·실패 처리·안전 검증을 보존한다. 이를 바꾸려면 기존 설계·범위 변경 절차를 따른다.
- M5. 단순화 후 최종 diff를 리뷰·검증한다. 리뷰 수정 후 영향받은 범위만 재확인한다. 새 게이트·필수 문서·Jira Task·고정 에이전트 수를 추가하지 않는다.
- M6. 배포 원본·설치본·안내를 일치시키고 신규 설치와 업데이트를 검증한다.

## SHOULD
- S1. 결과와 확인 범위는 기존 리뷰·검증 기록에 짧게 남긴다.

## OUT
- O1. npm 배포, Jira 기능 변경, 무관한 코드 정리, eevee-be 수정.

## Decisions
- D1. 에이전트 사용은 호출된 스킬과 저장소·런타임 지침에 맡긴다.
- D2. 새 사용자 승인 절차가 아니라 기존 refactor-while-green 단계의 구체화다.

## Verify
- V1 [M1, M2, M3, M4, M5]. 스킬 있음/없음·수정 불필요·동작 변경 제안·수정 후 재검증 시나리오를 테스트/EVALS로 확인한다. 자동 구조 검사와 행동 평가 결과를 구분한다.
- V2 [M6]. Codex·Claude 신규 설치/업데이트와 사용자 수정 보존을 확인하고 배포 원본·설치 지침·README를 비교한다.

G4: PASS — 사용자가 단순화 흐름, 기존 동작 보존 규칙, 실제 배포 후의 흐름은 이번 검증으로 확인할 수 없다는 증거 경계를 설명했다.
