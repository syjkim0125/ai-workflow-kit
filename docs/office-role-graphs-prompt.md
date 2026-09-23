# Agent Office 개발 세션에 전달할 프롬프트

지금까지 진행한 Agent Office 작업을 아래 방향에 맞춰 이어가줘. 이 방향은 사용자와 ai-workflow-kit 담당 세션이 나눈 대화에서 정리한 의도다. 기존 진행 내용을 보존하고, 이미 승인된 목표를 처음부터 다시 설계하거나 승인받지 마.

**kit는 맡은 일을 끝내는 절차를 관리하고, Office는 여러 사람의 일이 하나의 목표로 이어지도록 관리한다.**

먼저 다음 문서를 읽고 실제 코드와 비교해줘.

- `/Users/jongkkim/Documents/ai-workflow-kit/docs/agent-office-handoff.md`
- `/Users/jongkkim/Documents/ai-workflow-kit/skills/workflow/references/role-graphs.md`
- `/Users/jongkkim/Documents/ai-workflow-kit/skills/workflow/references/skill-integration.md`

## 사용자가 원하는 구조

각 에이전트는 kit로 자기 역할의 절차를 실행한다. kit는 Office 없이도 같은 절차를 사용할 수 있어야 한다. Office가 있어야만 kit 그래프가 켜지는 구조로 만들지 마.

Office는 PM·팀장·Developer·Reviewer에게 역할과 일을 배정하고, 실행 자원과 소통을 관리한다. 질문, 답변, 산출물, 리뷰 의견을 관련 작업에 연결한다. 여러 에이전트가 하나의 회사처럼 협력하되, 불필요한 대화나 에이전트 수를 늘리지 마.

PM과 Developer가 생각하는 완료 기준이 다를 수 있다. 이때 Office가 공통 요구사항과 증거를 기준으로 조율해야 한다. 에이전트가 절차를 스스로 수행하는 것과 완료 기준을 자기 마음대로 바꾸는 것은 다르다. 요구사항은 한 곳에서 관리하고, 각 역할은 그 문서와 배정된 범위를 참조해야 한다.

kit는 개별 작업의 상태 전이·검증·제한된 수정과 질문 재개를 관리한다. Office는 프로젝트의 목표·역할 배정·협업·결과 통합·전역 예산과 취소·사용자 접점·실제 승인을 관리한다. Office에 kit의 노드 전이 규칙을 다시 만들지 마. 서로 피드백을 주고받는 대화 자체를 그래프 실행으로 간주하지 마.

## 현재 kit와 연결할 방법

별도의 역할 목표는 `init-role <assignment.json> <run.json>`으로 시작하고, 이미 배정된 run/node/token이 있으면 그 실행을 계속한다. Developer마다 요구사항 승인부터 최종 사용자 승인까지 전체 workflow를 반복하면 안 된다.

kit의 `status → start → record`를 기존 Office worker 실행에 연결해줘. role run은 `role-complete`를 반환한다. 이는 역할 종료이며 프로젝트 완료나 사용자 승인이 아니다. Reviewer의 `submission.output.verdict`가 `needs_changes`라면 수정이 필요하다. Developer 자체 검사를 독립 Reviewer 검토로 대체하지 마.

질문은 kit `question`, 답변은 `answer`, 외부 리뷰 피드백은 `feedback`으로 연결한다. Office는 실제 메시지의 전달과 기록을 맡고 kit는 그 입력에 따른 로컬 전이를 맡는다. 답변 후에는 `resumed.token`을 사용한다. 예전 token으로 계속 실행하거나 답변을 승인으로 바꾸지 마.

로컬 kit run 파일은 개별 그래프 상태의 원본이다. Office DB는 프로젝트·배정·대화·승인 상태를 관리한다. kit 진행 상태를 화면에 표시하거나 색인할 수 있지만 같은 노드 상태를 양쪽에서 따로 확정하면 안 된다. 현재 Office 저장 구조와 CLI 파일 방식이 맞지 않으면, 필요한 입력·출력·저장 방식·실패 사례를 kit 세션에 전달해줘. 규칙을 복사한 대체 실행기를 먼저 만들지 마.

assignment의 taskId, scope, targetRevision과 실제 코드 변경본을 연결해줘. Developer가 만든 producedRevision을 Reviewer의 targetRevision으로 넘겨야 한다. commit ID만으로 미커밋 변경까지 식별된다고 가정하지 마. kit는 ID와 증거 hash를 검사하지만 실제 코드와 ID의 연결은 Office/host가 확인해야 한다.

여러 Developer를 돌릴 때 작업 공간 분리나 직렬 실행은 Office가 담당한다. kit는 한 run 안에서만 writer를 배타 실행한다. 전역 비용·시간·반복 제한, 프로세스 종료, 취소된 작업의 결과 거부도 Office 책임이다.

## 진행 방식

1. 현재 Office 코드와 문서를 확인하고 구현·부분 구현·미구현, 그리고 위 방향과 다른 부분을 짧게 보고해줘.
2. 이미 승인된 설계와 동작을 유지하면서 가장 작은 실제 사용 흐름부터 연결해줘. 일반 구현은 계속 진행해. kit 저장소는 읽기만 하고 Office 저장소에서 작업해줘.
3. 실제 worker에 설치된 kit 커밋/패키지와 스킬을 확인해줘. package.json의 버전명만으로 새 명령이 설치됐다고 판단하지 마.
4. 계획에는 CE, 구현에는 Superpowers 집중 TDD와 필요한 debugging, 단순화·리뷰·검증 후 학습에는 해당 CE/검증 스킬을 적용해줘. 각 단계에서 전체 workflow를 다시 시작하지 마. Jira는 생략해줘.
5. 검증된 교훈만 저장하고 다음 작업에서 관련 기록을 조회하게 해줘. 이것을 모델 자동 재학습이라고 설명하지 마.
6. 별도 `codex/` 브랜치에서 작업하고 검증 후 커밋·푸시해줘. main 머지와 배포는 사용자가 한다. 기존 다른 작업을 되돌리지 마.

## 완료 기준

- Office에서 실제 프로젝트 요청을 넣으면 PM 요구사항 정리 → 팀장 계획 → Developer 구현 → Reviewer 검토 → 피드백 수정 → 통합 검증 → 실제 사용자 승인까지 이어진다.
- 서로 다른 완료 기준이나 변경된 요구사항을 Office가 조율하고, kit의 기존 완료 증거를 잘못 재사용하지 않는다.
- 재시작은 기존 run을 이어가고, 취소·중복 답변·늦게 도착한 결과에도 상태가 일관된다.
- 사용자는 Office에서 역할별 진행, 필요한 대화, 변경 내용, 검증 증거와 승인 대기를 확인한다.
- 실제 모델 실행과 실제 사용자 승인의 증거가 있다. 모의 응답, 단위 테스트 통과, 커밋·푸시만으로 완료라고 하지 않는다.
- 실행 방법, 검증 결과, 남은 한계, kit에 필요한 추가 연결 계약을 보고한다.

Google ADK SDK, Jev, 새 범용 그래프 엔진, 불필요한 서버나 메시지 브로커를 추가하지 마. 노드·조건 분기·공유 상태·역할별 흐름·검증·제한된 피드백 루프라는 설계 개념을 기존 구조 안에서 사용해줘.
