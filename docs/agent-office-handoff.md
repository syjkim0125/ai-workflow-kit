# Agent Office 인계: 역할별 kit 실행

2026-09-23. 현재 소스 계약이다. Office 구현 완료나 실제 사용자 승인 기록이 아니다.

**kit는 맡은 일을 끝내는 절차를 관리하고, Office는 여러 사람의 일이 하나의 목표로 이어지도록 관리한다.**

## Responsibilities

| 담당 | 소유하는 것 |
|---|---|
| kit | 역할별 노드, 의존관계, 진행 상태, 질문 대기와 재개, 증거 검사, 제한된 수정 |
| Office | 공통 요구사항과 완료 기준, 역할 배정, 실행 자원, 메시지, 결과 통합, 전역 예산과 취소, 사용자 접점과 승인 |
| Agent | 배정된 범위의 실제 작업, 검사, 산출물, 질문과 피드백 |

kit 파일은 개별 실행 상태의 원본이다. Office는 프로젝트와 협업 상태의 원본이다. Office DB에 kit 진행 상태를 표시하거나 색인할 수 있지만, 같은 노드의 상태를 독립적으로 확정하면 안 된다. Office에서 kit 전이 규칙을 다시 만들지 않는다.

PM과 Developer의 완료 기준이 다르면 Office가 공통 요구사항과 증거를 기준으로 조율한다. 에이전트는 수행 방법을 선택할 수 있지만 요구사항을 임의로 바꾸지 않는다. 요구사항이 바뀌면 새 assignment/run으로 연결하고 이전 기록을 보존한다.

## Model selection policy

공통 규칙은 [model-selection.md](../skills/workflow/references/model-selection.md)에 있다. Office는 실제 worker에 이 규칙과 허용된 모델 목록을 전달하고, 선택한 모델로 실행한다. 역할마다 모델 이름을 고정하지 않는다. 필요한 능력·도구·입력 크기·실패 영향을 확인한 뒤 전체 후보에서 적절한 저비용 모델을 고른다. 여러 단계 아래 모델도 선택할 수 있다. 사용자 지정 모델, 전역 예산과 실행 권한을 지킨다.

모델 목록은 현재 계정과 실행 경로에서 확인하고 재사용한다. 모델 변경을 지원하지 않으면 허용된 현재/기본 모델을 유지하고 한계를 표시한다. 선택 추천과 실제 실행 모델을 구분해 기존 작업 증거에 남긴다. 교체 전에 이전 worker를 중단하고 변경 내용을 확인한다. 재시도와 비용은 기존 한도에 포함한다. 검증·독립 리뷰·사람 승인을 생략하지 않는다.

이 변경은 설치되는 지침이다. assignment v1, role run v2, CLI/API는 그대로다. 별도 모델 라우터, Jev, SDK를 추가하거나 Office에서 규칙을 복사할 필요가 없다. 기존 worker의 kit 스킬을 업데이트하고 dispatch에 적용해야 한다. 정책 설치만으로 실제 모델 호출이나 비용 절감이 검증되지는 않는다.

## Shipped CLI contract

설치된 `.ai-workflow/bin/graph.mjs`와 패키지의 `ai-workflow-kit graph`가 같은 명령을 제공한다. 정확한 JSON 필드·역할별 예시는 [role-graphs.md](../skills/workflow/references/role-graphs.md), 기존 delivery 사용법은 [graph-engineering.md](../skills/workflow/references/graph-engineering.md)를 따른다.

```sh
node .ai-workflow/bin/graph.mjs init-role <assignment.json> <run.json>
node .ai-workflow/bin/graph.mjs status <run.json>
node .ai-workflow/bin/graph.mjs start <run.json> <node-id> <ready-token>
node .ai-workflow/bin/graph.mjs record <run.json> <node-id> <result.json>
node .ai-workflow/bin/graph.mjs question <run.json> <node-id> <question.json>
node .ai-workflow/bin/graph.mjs answer <run.json> <node-id> <answer.json>
node .ai-workflow/bin/graph.mjs feedback <run.json> <node-id> <feedback.json>
node .ai-workflow/bin/graph.mjs reset <run.json> <node-id> <reason>
```

| 역할 | 흐름 | Office가 받는 결과 |
|---|---|---|
| PM | clarify → propose | 승인 전 요청의 Story 제안. G1을 대신하지 않음 |
| 팀장 | investigate → plan | 승인된 Story에 연결한 계획과 역할 배정 제안 |
| Developer | implement → self-check | 변경본, 검증 증거, producedRevision |
| Reviewer | review | reviewedRevision, pass/needs_changes, 근거 |

assignment v1은 `taskId`, `role`, `source`, `scope`, `targetRevision`을 포함한다. PM의 source는 변경하지 않는 요청 파일이고 scope는 빈 배열이다. 나머지 역할의 source는 승인된 canonical Story이고 scope는 배정된 M/V ID다. 별도 역할 목표면 `init-role`, 이미 run/node/token을 받았다면 같은 노드에서 계속한다.

`start`가 반환한 `started.token`으로 결과를 기록한다. 질문은 `question.id`와 `question.token`으로 답변을 연결하고, 답변 후에는 `resumed.token`으로 계속한다. 질문은 구현 시도 횟수를 늘리지 않는다. 질문은 노드당 최대 3회, 실행은 노드당 최대 3회다.

외부 리뷰 피드백은 현재 `status.revisionToken`과 증거를 넣어 `feedback`으로 전달한다. 대상과 후속 노드를 다시 열고 기존 시도 횟수를 유지한다. 오래된 피드백, 중복 답변, 이전 worker 결과는 거부한다. 수정된 결과는 새 변경본에 연결한 Reviewer assignment로 검토한다.

`role-complete`는 맡은 역할이 끝났다는 뜻이다. `submission.output`의 실제 판정을 읽어야 한다. Reviewer가 작업을 끝냈어도 verdict가 needs_changes면 Developer에게 돌려보낸다. Developer 자체 검사를 독립 리뷰로 대체하지 않는다. 전체 결과 검증·유용한 Compound 학습·실제 사용자 확인은 인도 담당이 조율한다.

## Office integration boundary

kit는 모델을 실행하거나 메시지를 전송하지 않는다. Office는 CLI 준비 결과를 실제 agent 실행에 연결하고, 작업 identity와 실제 변경본이 맞는지 확인한 뒤 역할 결과를 받아들인다. 이 패키지는 완성된 Office 어댑터가 아니다.

- Office는 작업과 로컬 kit run을 일대일로 연결하고 재시작 시 같은 run을 조회한다.
- 질문·답변·리뷰 피드백은 실제 요청, 요구사항, 산출물, 변경본과 연결한다. 일반 대화나 답변을 승인 이벤트로 바꾸지 않는다.
- 취소된 작업이나 오래된 변경본의 결과를 반영하지 않는다. kit가 결과를 거부해도 이미 발생한 파일 변경이나 외부 부작용이 취소되지는 않는다.
- 별도 run의 Developer는 Office가 작업 공간을 분리하거나 직렬 실행한다. kit의 writer 배타 제어는 한 run 안에서만 적용된다.
- snapshot ID는 Office가 실제 코드와 연결한다. kit는 입력된 ID 비교와 증거 파일 hash를 검사하며, 실제 diff의 진실성이나 승인자의 신원을 인증하지 않는다.
- 비용·시간·전체 반복 한도, worker 종료와 재시작은 기존 Office 실행 환경에서 처리한다.

서로 피드백을 주고받는 대화 자체를 그래프라고 부르지 않는다. 검토 결과에 따라 수정하고 다시 검사하는 조건과 순서를 kit가 관리한다. Office는 그 결과를 다음 담당자와 공통 목표에 연결한다.

## Skills

[skill-integration.md](../skills/workflow/references/skill-integration.md)가 기준이다. 팀장 계획에는 CE, Developer 구현에는 Superpowers 집중 TDD와 필요한 diagnosis, 단순화·독립 리뷰·학습에는 CE를 연결한다. 스킬이 없으면 해당 단계의 직접 절차로 수행하고 알린다. kit 설치가 CE/Superpowers 설치까지 보장하지 않는다.

각 역할에서 전체 Superpowers/CE workflow를 중첩하지 않는다. 학습은 검증 후 재사용할 교훈만 저장하며 모델 자동 재학습이 아니다. Jira는 생략한다.

## Migration

- 기존 delivery v1 파일은 그대로 사용할 수 있다. 역할별 run은 v2, assignment는 v1이다. 이전 runtime은 역할 run을 읽을 수 없으므로 먼저 설치를 업데이트하고 doctor를 실행한다.
- 현재 package.json의 버전 표기만 보고 기능을 추정하지 않는다. 이 변경이 포함된 실제 커밋/패키지 해시를 확인한다. 기존 tarball과 이 기능을 포함한 tarball을 혼동하지 않는다.
- 진행 중인 delivery를 역할 run으로 강제 변환하지 않는다. 기존 작업은 그대로 마무리하고, 새 역할 배정에서 새 형식을 사용한다. 오래된 파일의 version/fingerprint를 고쳐 통과시키지 않는다.
- kit가 소유하는 로컬 상태를 Office가 별도로 확정하던 연결은 제거한다. 프로젝트 상태와 로컬 노드 상태를 구분하고, CLI 결과에서 Office 화면과 다음 배정을 갱신한다.
- 현재 CLI 파일 저장 방식이 Office 배포 구조와 맞지 않으면 필요한 호출·저장·실패 사례를 kit 세션에 반환한다. Office에서 규칙을 복사한 대체 실행기를 먼저 만들지 않는다.
- docs는 npm 패키지에 포함되지 않는다. 설치되는 역할 가이드는 workflow references에 있다.

## Verification boundary

kit 테스트는 설치된 두 host용 CLI의 역할 완료, 질문/답변, 피드백/수정, 입력 변경과 오래된 결과 거부를 검사한다. 실제 Office 모델 협업, 전역 취소, 통합 변경본 승인까지 증명하지 않는다. 최신 검증은 [이번 구현 기록](understanding/role-graph-verification.md)을 참고한다.

Office에서는 작은 실제 프로젝트 하나로 요청 → PM → 계획 → Developer → Reviewer → 수정 → 통합 검증 → 실제 사용자 승인까지 확인한다. 재시작·취소·중복 응답·늦은 결과도 기존 실행 환경에서 확인한다. 모의 응답이나 커밋·푸시만으로 실제 사용 완료를 선언하지 않는다.

Office 세션에 전달할 [프롬프트](office-role-graphs-prompt.md)를 별도로 제공한다. Office 저장소는 이 kit 세션에서 수정하지 않는다. npm 배포와 main 머지는 사용자가 수행한다.
