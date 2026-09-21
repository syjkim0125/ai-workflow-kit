# 그래프 검증 안내

검증 대상은 세 층이다. 자동 테스트는 그래프의 전이 규칙, tarball 검사는 실제 배포물 설치, 실제 host 실행은 에이전트가 그 규칙을 지키며 일하는지를 확인한다. 앞의 두 가지 통과가 실제 모델 협업을 증명하지 않는다.

## 1. 소스와 배포물

kit 저장소의 배포할 커밋에서 실행한다.

```sh
npm test
npm pack
# npm pack 출력의 실제 파일명으로 바꾼다.
node test/fixtures/verify-tarball.mjs ./pazmo-ai-workflow-kit-<version>.tgz
```

`npm pack`도 prepack에서 전체 테스트를 실행한다. 빠르게 그래프만 점검하려면 다음을 사용한다.

```sh
node --test test/graph-runtime.test.mjs test/graph-cli.test.mjs
```

현재 전체 테스트는 120개다. tarball 스크립트는 저장소 package.json의 버전과 비교하므로 같은 배포 소스에서 실행한다. 임시 디렉터리에 Codex·Claude를 각각 설치하고 설치 반복, update/doctor, 그래프의 G4 준비 도달, 사용자 문서·run·증거 보존 및 제거를 확인한다. 실제 모델 호출이나 실제 사람 승인을 하지 않는 fixture다.

| 실패 사례 | 자동 검사에서 확인하는 기대 결과 |
|---|---|
| 순환·잘못된 의존성·누락된 Story M/V | 초기화 거부 |
| start 전 결과·잘못된 token·중복 결과 | 완료 처리 거부 |
| 다른 run 또는 이전 시도의 늦은 결과 | 현재 상태 변경 거부 |
| 읽기 작업 실행 중 쓰기 작업 | writer 실행 보류 |
| 실패 후 reset | 영향받은 후속 작업만 무효화; 독립 증거 유지 |
| 3회 실패 | stop, 추가 reset 거부 |
| 사람이 결정해야 하는 실패 | human, 자동 수정 반복 금지 |
| 요구사항·계획·기록한 증거 변경 | 오래된 상태로 진행 거부 |
| 모든 노드 통과 | g4 준비만 반환; Story 승인/Delivered 자동 생성 금지 |

## 2. 실제 Codex/Claude에서 작은 작업 하나

1. 기존 테스트가 있는 작은 실제 프로젝트의 별도 작업 브랜치에서 방금 검증한 tarball을 설치한다. kit README의 로컬 설치 방법을 사용한다. 새 세션을 시작하고 doctor로 설치 상태를 확인한다.
2. 예를 들어 기존 문자열 유틸리티의 잘못된 입력 처리를 고치는 작은 요청으로 시작한다. 자기 프로젝트에 맞는 명확한 성공/실패 조건을 사용한다.
3. 아래 프롬프트를 넣고 필요한 G1/G3 판단에는 실제로 응답한다. Claude에서는 `$workflow`를 `/workflow`로 바꾼다.

```text
$workflow 이 프로젝트의 [작은 수정 요청]을 구현해줘. Jira는 생략해.
설치된 graph CLI로 실행하고, 각 작업의 start/record와 실제 테스트 근거를 남겨줘.
구현은 Superpowers 집중 스킬, 계획·단순화·리뷰·학습은 CE를 가용 범위에서 사용해.
전체 workflow를 중첩하지 말고, 스킬이 없으면 대체 수행을 명시해.
사용한 run 경로와 각 단계의 증거 경로를 마지막에 알려줘.
실제 사람의 승인 없이 G4를 통과했다고 기록하지 마.
```

에이전트가 알려준 run 경로를 확인한다.

```sh
node .ai-workflow/bin/graph.mjs status .ai-workflow/runs/<실제-run>.json
```

관찰할 점:

- G1 후 실제 init/start/record 호출이 있었는지. “graph를 사용했다”는 설명만으로 통과시키지 않는다.
- 구현 → 리뷰 → 최신 검증이 이어지는지. 실제 변경 파일과 명령/exit code가 증거와 일치하는지.
- 리뷰에 수정 요구가 있으면 Reviewer가 직접 코드를 고치지 않고 구현을 reset하고 후속 리뷰/검증을 다시 수행하는지.
- 새 세션에서 같은 run을 읽고 이어가는지. 실행 중이던 worker는 먼저 생존 여부와 부수 효과를 확인해야 하며 무작정 reset하지 않는다.
- 모든 노드가 통과해도 `action: g4`에서 실제 사람 확인을 진행하는지. 모델의 “승인됨” 문장을 사람 응답으로 사용하지 않는다.

수정 경로를 확실히 시험하려면 폐기 가능한 복제 프로젝트에 알려진 작은 결함과 그 결함을 드러내는 테스트를 준비한다. 시험 결함이라고 명시하고 실제 실패 로그 → 수정 → 성공 로그를 남긴다. 자연 발생 결함을 찾았다는 증거나 실제 납품 승인을 꾸미지 않는다.

## 3. Agent Office 통합

[Office 인계 문서](agent-office-handoff.md)를 사용한다. 실제 PM·팀장·Developer·Reviewer 호출과 역할별 메시지/산출물을 Office UI에서 확인한다. 다음은 Office 연결 계층까지 있어야 검증할 수 있다.

- 동일 변경본에 대한 리뷰·테스트·사용자 승인.
- 재시작 후 중복 dispatch 방지, 취소 worker의 늦은 결과 거부, workspace 부수 효과 격리.
- 여러 run에 걸친 슬롯·시간·비용·재시도 한도.
- 질문/답변 연결과 승인 분리, 실제 모델의 피드백·수정·재검증.

현재 kit CLI에는 Office용 question/reply/resume 또는 취소 명령이 없다. evidence hash도 실제 코드 revision 검사를 대신하지 않는다. 위 통합 사례가 확인되기 전에는 “Office에서 검증 완료”로 보고하지 않는다.

## 배포 시 기록

검증한 commit SHA, 새 package version, tarball SHA-256, 테스트/설치 결과를 보존한다. 이번 배포 대상은 4.0.0이다. 4.0.0 변경에는 그래프 callback 입력과 평가 계약 변경이 있으므로 버전 선택에 반영한다. main merge와 npm publish는 사용자가 수행한다.
