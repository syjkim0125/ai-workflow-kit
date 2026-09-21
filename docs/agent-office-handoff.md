# Agent Office 인계: kit 그래프와 단계별 스킬 조합

2026-09-21. Office의 `docs/ai-workflow-kit-adk-handoff.md` 정정본을 기준으로 작성했다. 이 문서는 kit 작업 결과와 Office 연동 제안이며, Office 구현 완료나 사용자 승인 기록이 아니다.

## 결정

- kit: 업무 그래프의 노드·의존관계·전이·검증·제한된 수정 규칙과 역할별 작업 절차.
- Office: 역할 배정, 모델/프로세스 실행, 협업 메시지, 저장, 전역 예산·취소, 사용자 접점과 실제 승인 기록.
- Superpowers: Developer의 집중 TDD, 필요한 systematic-debugging, verification-before-completion.
- CE: 팀장의 caller-owned ce-plan, ce-simplify-code, 독립 Reviewer의 ce-code-review mode:agent, 최종 검증 후 ce-compound.
- 각 agent는 맡은 단계만 수행한다. Developer가 전체 Superpowers workflow를 다시 시작하거나 CE 구현까지 중복 실행하지 않는다. ce-work return-to-caller는 명시적으로 선택한 대안이다.
- Google ADK SDK/런타임, 새 서버·DB·브로커·모델 provider를 추가하지 않는다. Jira는 생략한다.

정확한 스킬 선택·모드·fallback은 [skill-integration.md](../skills/workflow/references/skill-integration.md)가 기준이다. kit 설치는 해당 지침과 그래프 CLI를 배포한다. CE/Superpowers 플러그인을 설치하거나 모델을 자동 기동하지 않는다. 각 실제 worker에서 사용 가능 여부를 확인해야 한다.

## 현재 구현과 남은 차이

| 영역 | kit에 있는 것 | 추가 연동/검증이 필요한 것 |
|---|---|---|
| 설치 | 두 host에 그래프 runtime/CLI와 workflow 지침 설치·업데이트 | Office 실제 agent 환경에서 경로·스킬 발견 확인 |
| 실행 | DAG 검증, 의존성 준비 판정, explicit read 노드 병렬화, writer 배타 실행, 명시적 평가 | Office 모델 실행/저장과 연결; 서로 다른 run의 writer 격리 |
| delivery CLI | 승인된 Story로 init, start 예약, record, status, reset | PM 사전 질문용 진입점과 완성된 역할별 product adapter는 없음 |
| 복구 | run/시도/의존 상태 토큰, 영향받은 후속 노드 무효화, 노드당 최대 3회 | Office 전역 시간/비용/횟수 한도 및 프로세스 취소; 더 엄격한 host 한도 적용 |
| 질문 | human 분기와 host 전달 지침 | CLI question/reply/resume 명령 없음. 현재 human 처리 후에는 결정 반영 새 run 필요 |
| 변경본 | graph/Story fingerprint, 증거 파일 hash | 실제 코드 변경본을 리뷰·검증·승인에 묶는 Office 검사가 필요. dirty tree에는 commit ID만으로 부족 |
| 사람 승인 | G1/G4 기록 checker, G3 절차 지침 | checker가 사용자 신원을 인증하지 않음. Office가 실제 사용자의 승인 이벤트를 보존 |
| 학습 | 검증 후 유용한 교훈 기록, 다음 작업 전 조회 지침 | 실제 후속 작업에서 조회·사용했는지 확인; 모델 재학습 아님 |

현재 프로그램 API는 역할 그래프를 표현할 수 있지만 완성된 Office 상태 어댑터가 아니다. 문서상의 규약을 코드로 강제한다고 보고하지 않는다.

## 실행 가능한 기존 API

전체 사용법·result JSON은 [graph-engineering.md](../skills/workflow/references/graph-engineering.md)를 따른다. 아래 명령은 설치한 프로젝트 루트에서 실행한다.

```sh
node .ai-workflow/bin/graph.mjs init - .ai-workflow/runs/example.json docs/example-story.md
node .ai-workflow/bin/graph.mjs status .ai-workflow/runs/example.json
node .ai-workflow/bin/graph.mjs start .ai-workflow/runs/example.json implement '<ready-token>'
node .ai-workflow/bin/graph.mjs record .ai-workflow/runs/example.json implement result.json
node .ai-workflow/bin/graph.mjs reset .ai-workflow/runs/example.json implement '리뷰에서 확인한 동작 수정'
```

`example-story.md`는 실제 G1을 통과한 canonical Story여야 한다. `ready-token`은 status에서, 결과에 쓸 token은 start의 `started.token`에서 얻는다. `-`는 implement → workflow-review → workflow-verify 최소 그래프다. PM마다 이 명령으로 전체 delivery run을 생성하면 안 된다.

```json
{
  "token": "<started.token>",
  "output": {
    "summary": "실제로 수행한 단계와 결과",
    "evidence": ["docs/understanding/example-attempt-1.md"]
  },
  "evaluation": { "passed": false, "action": "fix", "feedback": "어떤 기대 동작이 실패했고 어느 작업을 수정해야 하는지" }
}
```

성공은 `evaluation: {"passed": true}`다. CLI 종료 코드 0은 실패 결과도 정상 기록했다는 뜻일 수 있다. `action: g4`는 사용자 승인 대기 준비이며 승인/인도가 아니다.

프로그램 API는 `.ai-workflow/graph/index.mjs`에서 `createTaskGraph`, `createRunState`, `getReadyNodes`, `assertRunState`, `resetAffectedSubgraph`, `executeTaskGraph`, `createPlanningGraph`를 제공한다. `executeTaskGraph({graph, runNode, evaluateNode, context, runState, maxConcurrency})`의 callback 실행과 저장 연결은 host가 담당한다. ready 조회 자체는 원자적 예약이 아니다. Office가 기존 저장소에 실행을 연결하기 전에 durable claim/결과 적용의 경계를 확인해야 한다.

## 상태 소유권

standalone에서는 CLI run 파일이 그래프 상태를 보존한다. Office에서는 **Office가 권위 있는 상태와 승인 기록을 보존하고 kit의 전이 규칙을 재사용**하는 것이 목표다. Office DB와 CLI 파일에서 같은 상태를 독립적으로 확정하면 안 된다.

Office 세션은 기존 저장·예약·승인 구조를 먼저 확인하고, kit API를 호출할 최소 어댑터와 부족한 kit seam을 구분한다. 현재 API로 durable 전이/중단/재개를 구현할 수 없다면 필요한 입력·출력·실패 사례를 kit 세션에 전달한다. Office에서 kit 전이 규칙을 별도로 재작성하거나 CLI 상태를 성공으로 보정하지 않는다. 어댑터가 준비될 때까지 standalone CLI 검증을 Office 통합 완료로 간주하지 않는다.

공유 상태에는 산출물 참조와 단계 결과를 저장하고, worker 문맥에는 자기 작업·제약·직접 의존 결과만 전달한다. 모든 대화 이력을 매번 모든 agent에게 복제하지 않는다.

## 역할 호출 예시

다음은 agent에게 넘길 문맥 예시이며 새 CLI flag가 아니다. 하나의 canonical Story/plan을 참조한다.

| 역할 | 예시 지시 | 반환 |
|---|---|---|
| PM | “요청과 기존 질문/답변을 읽고 kit intake로 Story 제안을 정리해라. 결정에 필요한 질문만 반환해라. 승인이나 구현을 대신하지 마라.” | Story proposal 또는 연결 가능한 질문 |
| 팀장 | “승인된 Story와 저장소를 근거로 ce-plan을 수행해라. caller가 실행·승인·다음 단계를 소유한다. 기존 유효한 계획은 재사용해라.” | M/V 연결 계획, 의존관계, 담당 역할 제안, 미해결 사항 |
| Developer | “이 task와 revision에 대해 kit 절차와 Superpowers 집중 TDD/필요한 diagnosis를 사용해라. 다른 task나 전체 workflow를 시작하지 마라. GREEN 후 범위 내 simplify를 수행해라.” | 변경본, 실제 검사 근거, 한계, 질문/차단 사유 |
| Reviewer | “제출된 정확한 변경본을 ce-code-review mode:agent로 검토해라. 제품 파일은 수정하지 말고 구체적인 finding을 반환해라.” | native review 결과와 근거; complete만으로 통과 판정 금지 |
| 검증/인도 담당 | “리뷰 수정이 반영된 변경본을 새로 검증하고 유용한 교훈만 ce-compound로 남겨라. 실제 G4 응답을 Office에 요청해라.” | 검증 근거, 학습 또는 생략 이유, 승인 대기 |

스킬이 없으면 해당 단계의 직접 절차로 대체하고 이를 기록한다. 실행 중 실패한 스킬 위에 다른 전체 workflow를 덮어 실행하지 않는다. 내부 worker/재시도도 Office의 전역 예산을 소비한다.

## Office 메시지 envelope 제안 — 아직 구현된 kit schema가 아님

기존 Office schema에 대응시킬 최소 예시다. 새 저장소/이벤트 체계를 별도로 만들라는 지시가 아니다. 구체적인 타입, 필수 필드, 검증은 기존 Office 계약을 확인한 뒤 확정한다.

```json
{
  "contractVersion": "office-kit-draft-1",
  "runId": "run-1",
  "taskId": "task-1",
  "nodeId": "implement",
  "attemptId": "attempt-1",
  "expectedStateVersion": 4,
  "role": "developer",
  "stage": "implementation",
  "targetRevision": "<immutable snapshot identifier covering uncommitted changes>",
  "storyRef": "docs/example-story.md",
  "planRef": "<existing plan or null>",
  "feedbackRefs": [],
  "constraints": { "workspace": "<assigned isolated workspace>", "allowChildAgents": false }
}
```

반환은 위 identity/revision과 `outcome`(completed/needs_changes/question/blocked), `artifactRefs`, `evidenceRefs`, `findingRefs`, `nextAction`, `reason`을 포함하도록 기존 Office 타입에 매핑한다. 질문은 `questionId`, 응답은 `replyToQuestionId`로 연결한다. 이 outcome은 CLI evaluation으로 자동 변환되지 않는다. 질문을 테스트 실패로 기록하거나 답변을 승인으로 변환하지 않는다.

결과 적용 시 Office는 현재 run/task/attempt/revision/stateVersion 및 취소 여부를 대조하고 원자적으로 한 번만 반영한다. 오래된 응답을 버려도 worker가 이미 쓴 파일은 복구되지 않는다. 격리 workspace와 프로세스 정지까지 검증해야 한다. 승인 이벤트는 승인 주체·대상·변경본과 결정을 보존하고 일반 메시지와 구분한다.

## 전달 버전과 마이그레이션

- package.json: **4.0.0**, 이 기능 변경을 포함하며 아직 공개 배포하지 않았다.
- 기반 HEAD: `f21f21d2b06c3a9619bb3d42ef316adbe75df3ab`. 이 SHA는 변경 전 기반이다. 전달 기능 브랜치 `feat/graph-engineering-runtime`의 최신 커밋을 사용하고 실제 SHA를 기록한다.
- 전달용 패키지는 현재 소스에서 새로 pack한 tarball과 SHA-256을 함께 사용한다. 이전 설치본 3.1.1 또는 `@latest`라는 이름을 최신 기능의 증거로 쓰지 않는다.
- `docs/`는 현재 npm package files 목록에 포함되지 않으므로 이 문서는 별도로 읽거나 전달한다. 배포된 workflow references는 패키지에 포함된다.
- Office의 기존 설치/업데이트 경로를 사용하고, 기존 run·사용자 문서·증거는 보존한다. 이전 schema/fingerprint run을 억지로 새 상태로 고치지 않는다. 진행 작업을 정리하고 필요한 새 run과 기존 증거를 연결한다.
- Office 세션은 Office만 수정한다. kit의 결함/추가 API는 재현 사례와 필요한 계약을 kit 세션에 돌려준다. kit publish나 main merge는 이 문서가 허가하지 않는다.

## Office에서 이어 할 순서와 완료 증거

1. 기존 Office 구현과 이 계약을 비교하여 구현/부분 구현/미구현을 짧게 보고한다. 특히 상태 권위·예약·revision·승인을 먼저 확인한다.
2. 실제 agent 환경의 kit artifact와 스킬 가용성을 확인한다. 이미 승인된 목표·설계를 반복 승인하지 않는다.
3. 작은 실제 프로젝트 하나에서 요청 → PM → 계획 → Developer → Reviewer → 최신 검증 → 실제 사용자 승인까지 연결한다. kit seam이 막히면 구체적인 요청을 반환하며 독립 작업은 계속한다.
4. 리뷰/테스트의 실제 피드백 → 수정 → 재검증을 확인한다. 비용/횟수 한도, 취소·재시작·중복·늦은 결과도 검증한다.
5. 기존 학습을 조회하고 검증된 새 교훈만 저장한다. 실행 방법, evidence, 남은 한계를 기록한다.

kit 테스트/오프라인 tarball fixture는 모델 협업이나 실제 사용자의 승인을 검증하지 않는다. Office의 기존 기능은 인계 문서의 설명에 근거하며 이 세션에서 Office 코드를 감사하거나 수정하지 않았다. 테스트 데이터의 승인 이벤트로 실제 완료를 선언하지 않는다.

## Office 세션에 붙여넣을 프롬프트

```text
아래 kit 인계 문서를 먼저 읽고 Agent Office 작업을 이어가줘.
/Users/jongkkim/Documents/ai-workflow-kit/docs/agent-office-handoff.md

기존 Office 코드와 진행 중인 변경을 보존하고, 인계 문서와 비교해 구현/부분 구현/미구현을 짧게 보고해줘. 이 세션은 Office만 수정하고 kit 저장소는 읽기만 해줘. Jira는 생략해줘.

kit이 업무 그래프와 검증 규칙을 제공하고, Office가 역할 배정·실행·메시지·권위 있는 상태·전역 예산·취소·사용자 승인을 관리해. ADK SDK/런타임이나 새 범용 그래프 엔진을 도입하지 마.

각 agent는 자기 역할/작업만 수행해. Developer에는 Superpowers 집중 TDD/필요한 diagnosis, 계획·단순화·독립 리뷰·학습에는 CE를 연결해. 전체 workflow를 중첩하거나 승인된 계획을 다시 만들지 마. 실제 worker의 스킬 가용성을 확인하고 부재 시 해당 단계의 직접 수행을 명시해.

문서의 기존 API와 제안 schema를 구분해. Office의 기존 저장 구조에 kit 규칙을 연결하고 같은 상태를 두 곳에서 독립 확정하지 마. kit에 부족한 API는 구체적 입력·기대 출력·실패 사례를 정리해 kit 세션에 전달하고, 독립적으로 가능한 Office 작업은 계속해줘.

가장 작은 실제 프로젝트 흐름부터 연결해: 요청 → PM 요구사항/필요 질문 → 팀장 계획 → Developer 구현 → Reviewer 피드백 → 수정/최신 검증 → 실제 사용자 승인. 질문은 승인이 아니며, 같은 변경본의 증거만 인정해. 재시작·취소·중복·늦은 결과·반복 한도를 검증해줘.

이미 승인된 목표와 설계를 유지하며 되돌릴 수 있는 일반 작업은 진행해. 검증 후 유용한 교훈만 Compound에 저장해. 모의 응답·단위 테스트·패키지 설치만으로 실제 모델 협업이나 사람 승인까지 완료했다고 선언하지 마. 실행 방법, 실제 검증 증거, 남은 한계와 kit 측 요청사항을 보고해줘.
```

## 이번 인계 검증 기록

- 전체 테스트: `npm pack`의 prepack `npm test`, **120/120 통과**.
- 새 tarball 오프라인 설치: Codex·Claude 각각 init/update/doctor, graph의 G4 준비 도달, 증거 보존, remove 확인.
- 지침 변경 관련 14개 테스트 통과, `git diff --check`와 이 문서의 로컬 링크 확인 통과.
- 최초 검증의 3개 실패는 설치 지침에서 빠진 명시적 simplify 스킬명과 이전 CE 구현 경로를 기대하던 테스트였다. 지침의 스킬명을 복구하고 변경된 정책에 맞게 기존 테스트를 갱신한 뒤 위 전체 검증을 수행했다.
- 이번 추가 변경은 지침/문서와 그 기존 구조 테스트에 한정한다. 코드 단순화 추가 변경은 필요 없었다. 새 판단의 이유와 예방 규칙이 이 문서와 skill-integration에 이미 있어 중복 Compound 문서는 만들지 않았다.
- 실제 Office 모델 E2E·사용자 승인·취소/재시작 통합 검증은 미수행. 이 기록 작성 당시 변경은 로컬 미커밋이었다. 이후 커밋/푸시 상태는 Git에서 확인한다. npm publish/main merge는 사용자 담당이다.

이전 인계 시점의 3.1.1 tarball (아래 값은 과거 검증 기록이다. 현재 배포 대상은 4.0.0이며 아래 패키지로 대체하지 않는다):

```text
/tmp/pazmo-ai-workflow-kit-3.1.1-office-handoff-20260921.tgz
SHA-256 c226999336659a68187ec07cbe15e509c04b771d8ce957fdb9a1deda718f7264
```

로그: `/tmp/office-handoff-pack-final.log`, `/tmp/office-handoff-smoke.log`, `/tmp/office-handoff-focused.log`. npm 패키지에 이 인계 문서는 포함되지 않는다.

## 4.0.0 릴리스 준비 검증 (이전 tarball 대체)

사용자 요청으로 package, 두 plugin manifest, marketplace를 **4.0.0**으로 맞췄다. 전체 120개 테스트와 Codex·Claude 오프라인 tarball 설치/실행 검증이 모두 통과했다. [그래프 검증 안내](graph-verification.md)에 재현 명령과 실제 host/Office 검증 절차를 정리했다.

```text
/tmp/pazmo-ai-workflow-kit-4.0.0.tgz
SHA-256 2f9adc22db9a70dad2e58fa6d8cf4a4b5b62777fa3ca75651caec5afe850c712
```

검증 로그: `/tmp/graph-v4-pack.log`, `/tmp/graph-v4-smoke.log`. npm 공개 배포와 main merge는 사용자가 수행한다. 위 SHA-256은 이번 로컬 패키지 식별자이며, 다른 환경에서 재생성한 패키지는 실제 해시를 별도로 기록한다.
