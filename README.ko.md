# AI Workflow Kit

한국어 · [English](https://github.com/syjkim0125/ai-workflow-kit/blob/main/README.md)

**AI에게 일을 맡기고, 작업 순서와 결과를 확인하세요. 최종 판단은 사람이 합니다.**

AI Workflow Kit은 Codex와 Claude Code에 작업 절차를 추가합니다. 무엇을 만들지 정하고, 작업 상태를 저장하고, 결과를 검사합니다. 다음 작업에 쓸 교훈도 남깁니다.

4버전에는 그래프 실행기가 들어 있습니다. **그래프는 작업 목록과 실행 순서를 정한 규칙입니다.**

## 시작하기

**Node.js 20 이상**과 Codex 또는 Claude Code가 필요합니다. 작업할 프로젝트 폴더에서 실행하세요.

```sh
npx @pazmo/ai-workflow-kit init
npx @pazmo/ai-workflow-kit doctor
```

설치하거나 업데이트한 뒤 **새 Codex 작업 또는 새 Claude Code 세션**을 여세요.

| 도구 | 작업 시작 | 진행 확인 | 마무리 |
|---|---|---|---|
| Codex | `$workflow 검색 결과가 없을 때 화면을 고쳐줘` | `$workflow status` | `$workflow finish` |
| Claude Code | `/workflow 검색 결과가 없을 때 화면을 고쳐줘` | `/workflow status` | `/workflow finish` |

에이전트는 설치된 절차를 따릅니다. 사람이 작업 범위를 승인하면 그래프를 사용합니다. 사용자가 그래프 명령을 하나씩 실행할 필요는 없습니다. 설치만으로 AI가 실행되지는 않습니다.

한 도구만 쓰면 `init --host codex` 또는 `init --host claude`로 설치하세요.

**ChatGPT:** 사용자 스킬을 지원하는 환경에서는 스킬이 자동 선택될 수 있습니다. 그래프 실행에는 Node.js와 프로젝트 파일 접근도 필요합니다. 일반 채팅만으로 전체 절차를 실행할 수는 없습니다.

## 작업 흐름

![요청, 범위 승인, 계획, 구현, 리뷰, 검증, 교훈 기록, 사람 확인 순서입니다. 리뷰나 검증이 실패하면 구현으로 돌아갑니다.](https://raw.githubusercontent.com/syjkim0125/ai-workflow-kit/22246e74aaf8480d9aa3071b351eea4196cd2c99/assets/readme/workflow-ko.png)

1. **원하는 결과를 적습니다.** 에이전트는 작업에 영향을 주는 질문만 합니다.
2. **범위를 승인합니다.** 무엇을 바꾸고 어떻게 확인할지 사람이 정합니다.
3. **계획을 세웁니다.** 작은 변경은 짧게 계획합니다. 큰 변경은 작업을 나누고 순서를 정합니다.
4. **구현하고 테스트합니다.** 코드를 고치고, 테스트하고, 불필요한 코드를 줄입니다.
5. **리뷰하고 다시 검증합니다.** 문제가 있으면 고칩니다. 바뀐 코드로 다시 확인합니다.
6. **쓸 만한 교훈을 남깁니다.** 확인된 내용만 저장합니다. 남길 것이 없으면 생략합니다.
7. **사람이 결과를 확인합니다.** 변경을 직접 설명한 뒤 실제 결과와 비교합니다.

위험한 변경은 구현 전에 설계를 확인합니다. 테스트가 통과해도 kit이 자동으로 머지하거나 배포하지 않습니다.

## 그래프가 하는 일

일반적인 코드 변경은 다음 순서로 진행합니다.

**구현·테스트·단순화 → 리뷰 → 최종 검증**

각 작업에는 이름, 입력, 선행 작업, 결과, 증거가 있습니다. 선행 작업은 먼저 끝나야 하는 작업입니다.

실행기는 다음 규칙을 적용합니다.

- 선행 작업이 통과해야 다음 작업을 시작합니다.
- 서로 독립적인 읽기 작업은 함께 실행할 수 있습니다.
- 한 실행 안에서 코드를 쓰는 작업은 하나씩 실행합니다.
- 작업마다 결과와 증거를 기록해야 합니다.
- 중복 결과와 오래된 작업 토큰을 거부합니다.
- 검사에 실패하면 관련 작업을 다시 시작합니다. 관계없는 완료 작업은 유지합니다.
- 같은 노드는 최대 3회 시도합니다. 한도에 도달하면 멈춥니다. 미해결 결정은 사람에게 묻습니다.

실제 작업은 에이전트가 합니다. 실행기는 저장된 상태를 검사하고 다음 행동을 알려줍니다. AI 모델을 직접 호출하지는 않습니다.

계획, 결과, 진행 상태는 프로젝트에 저장됩니다. 새 세션에서도 이 기록을 읽고 이어갈 수 있습니다. 작업 도중 멈췄다면 다시 시작하기 전에 남은 변경을 확인해야 합니다.

모든 노드가 통과하면 `action: g4`가 나옵니다. **사람이 확인할 준비가 됐다는 뜻입니다. 승인됐다는 뜻은 아닙니다.**

## 사람이 판단하는 시점

| 확인 | 판단할 내용 | 시점 |
|---|---|---|
| **G1: 범위** | 이 작업과 완료 조건이 맞는가? | 구현 전 |
| **G3: 설계** | 이 방법으로 진행해도 되는가? 실패하면 복구할 수 있는가? | 위험한 변경을 할 때 |
| **G4: 이해** | 무엇이 바뀌는가? 지켜야 할 규칙은 무엇인가? 테스트는 무엇을 확인했는가? | 완료 전 |

G4에서는 설명보다 바뀐 코드와 테스트 결과를 먼저 봅니다. 사람이 먼저 답합니다. 에이전트는 맞은 내용, 빠진 내용, 틀린 내용을 짚습니다. 사람은 수정된 내용을 자기 말로 다시 설명합니다.

작은 변경은 규칙에 따라 G4를 생략할 수 있습니다. 구체적인 이유를 기록해야 합니다.

검사기는 **기록과 파일**을 검사합니다. 누가 승인했는지, 테스트 결과가 사실인지는 증명하지 못합니다. 사람과 실행 도구가 실제 승인과 증거를 제공해야 합니다.

## 요구사항은 문서 하나에 적습니다

무엇을 만들지는 **Story**라는 짧은 문서에 적습니다.

| 항목 | 뜻 |
|---|---|
| Goal | 원하는 결과 |
| Domain | 이 변경에서 지켜야 할 규칙 |
| MUST | 반드시 필요한 동작 |
| SHOULD | 있으면 좋은 개선 |
| OUT | 이번에 하지 않을 작업 |
| Decisions | 합의한 결정과 표시한 가정 |
| Verify | 필요한 동작을 확인할 방법 |

에이전트는 한 번에 최대 3개를 묻고, 최대 2회 질문합니다. 안전한 기본값은 `ASSUMED`로 표시합니다. 작업을 막는 미해결 결정은 `OPEN BLOCKING`으로 남깁니다. 승인 표시로 숨길 수 없습니다.

한 번에 리뷰하기 어려울 때만 Story를 Task로 나눕니다. Task는 빈 줄을 뺀 30줄 이하로 씁니다. Story의 요구사항과 검증 항목 번호를 가리킵니다. 구현 방법은 계획에 적습니다.

## Superpowers와 Compound Engineering

kit이 전체 절차를 정합니다. 설치된 스킬은 각 단계를 맡습니다.

| 단계 | 우선 사용하는 스킬 |
|---|---|
| 계획 | CE `ce-plan` |
| 테스트를 쓰며 구현 | Superpowers `test-driven-development` |
| 실패 원인 분석 | Superpowers `systematic-debugging` |
| 테스트 통과 후 단순화 | CE `ce-simplify-code` |
| 리뷰 | CE `ce-code-review mode:agent` |
| 최신 코드 검증 | Superpowers `verification-before-completion` |
| 검증된 교훈 기록 | CE `ce-compound` |

Developer는 배정받은 작업만 합니다. Superpowers나 CE의 전체 절차를 다시 시작하지 않습니다. CE `ce-work mode:return-to-caller`는 명시적으로 선택할 때 쓰는 대안입니다. 구현을 두 번 수행하지 않습니다.

**이 플러그인들은 kit에 포함되지 않습니다.** 에이전트는 사용할 수 있는 스킬을 확인합니다. 스킬이 없으면 kit의 직접 수행 절차를 쓰고 그 사실을 알립니다.

교훈은 보통 `docs/solutions/`에 저장합니다. 다음 작업에서 관련 기록을 읽습니다. 프로젝트 지식을 저장하는 것이며, 모델 자체를 재학습시키지는 않습니다.

## Agent Office에서 사용하기

Office는 PM, 팀장, Developer, Reviewer에게 일을 배정합니다. 각 에이전트는 kit으로 자기 역할을 수행합니다.

에이전트는 배정된 kit 흐름을 실행합니다. Office는 kit의 결과를 작업 실행과 완료 처리에 연결합니다. 역할 흐름은 공통 그래프의 일부이거나 별도의 작은 그래프일 수 있습니다. 자기 역할을 끝냈다고 전체 프로젝트가 끝나는 것은 아닙니다. 에이전트마다 전체 workflow를 새로 시작하면 안 됩니다.

| 구성 요소 | 담당 |
|---|---|
| **kit** | 작업 규칙, 선행 관계, 검증, 수정 경로 |
| **Office** | 역할 배정, 에이전트 실행, 메시지, 상태 저장, 예산, 취소, 사용자 승인 |
| **에이전트** | 배정된 작업, 결과, 증거, 질문 |

작업 상태를 확정하는 곳은 하나여야 합니다. Office와 kit 파일에서 같은 작업의 완료를 따로 결정하면 안 됩니다.

현재 kit에는 **완성된 Office 연결 기능, 대화 화면, 모델 실행 기능이 없습니다.** Office가 연결해야 합니다. 여러 실행의 작업 공간 분리, 시간·비용 한도, 취소, 정확한 코드 변경본에 대한 승인도 실행 환경에서 처리해야 합니다.

단독 CLI에는 질문·답변·재개 명령이 없습니다. `human` 결과가 나오면 결정을 해결하고 새 run을 만들어야 합니다. 역할별 연결에서는 답변과 승인을 구분해야 합니다.

kit은 그래프 설계 개념을 사용합니다. Google ADK, Google Cloud, 새 서버는 필요하지 않습니다.

## 설치되는 파일

```text
AGENTS.md / CLAUDE.md       표시된 구간에 작업 지침 추가
.agents/skills/workflow/   Codex 스킬
.claude/skills/workflow/   Claude Code 스킬
.ai-workflow/bin/          검사기와 그래프 명령
.ai-workflow/graph/        그래프 실행 코드
.ai-workflow/runs/         작업 중 생성되는 실행 기록
templates/ai-workflow/     Story와 Task 서식
```

`init`은 기존 설치도 업데이트합니다. 사용자가 고친 관리 파일은 보존하고 알려줍니다. `remove`는 kit이 관리하는 파일과 지침 구간을 제거합니다. 사용자 변경, 실행 기록, 증거는 남깁니다.

설치 후 `doctor`를 실행하세요. 누락된 파일과 검사기·그래프를 숨기는 Git 무시 규칙을 찾습니다. 프로젝트를 공유하기 전에 안내대로 수정하세요.

## 명령어

프로젝트 폴더에서 실행합니다.

```sh
npx @pazmo/ai-workflow-kit init
npx @pazmo/ai-workflow-kit doctor
npx @pazmo/ai-workflow-kit remove

node .ai-workflow/bin/check.mjs story docs/STORY.md
node .ai-workflow/bin/check.mjs gate G1 docs/STORY.md
node .ai-workflow/bin/check.mjs gate G4 docs/STORY.md

node .ai-workflow/bin/graph.mjs status .ai-workflow/runs/change.json
```

실제 Story와 run 경로로 바꿔 쓰세요. `check story`는 문서를 검사합니다. Draft 문서가 통과해도 승인된 것은 아닙니다. 승인 기록은 `gate` 명령으로 검사합니다.

에이전트는 `init`, `start`, `record`, `status`, `reset`으로 그래프를 진행합니다. 입력 형식과 예시는 [그래프 안내](https://github.com/syjkim0125/ai-workflow-kit/blob/main/skills/workflow/references/graph-engineering.md)에 있습니다.

**Jira는 선택 사항입니다.** `npx @pazmo/ai-workflow-kit jira preview docs/STORY.md`는 로컬 미리보기만 출력합니다. 실제 발행에는 승인된 실행 환경의 연결 기능이 필요합니다. kit에는 Jira 인증정보나 클라이언트가 없습니다.

## 배포 전 검증

kit 저장소에서 실행합니다.

```sh
npm pack
# <version>을 npm pack 출력에 나온 버전으로 바꾸세요.
node test/fixtures/verify-tarball.mjs ./pazmo-ai-workflow-kit-<version>.tgz
```

`npm pack`은 전체 테스트를 실행합니다. tarball 검사는 Codex와 Claude용 패키지를 오프라인으로 설치하고, 그래프 실행·업데이트·제거를 확인합니다.

이 검사만으로 실제 에이전트가 모든 절차를 지킨다고 증명할 수는 없습니다. 작은 실제 작업에서도 그래프 명령, 테스트 로그, 리뷰 수정, 사람 확인을 살펴보세요.

## 자세한 안내

- [그래프 검증 방법](https://github.com/syjkim0125/ai-workflow-kit/blob/main/docs/graph-verification.md)
- [Office 인계 문서](https://github.com/syjkim0125/ai-workflow-kit/blob/main/docs/agent-office-handoff.md)
- [스킬 연결 규칙](https://github.com/syjkim0125/ai-workflow-kit/blob/main/skills/workflow/references/skill-integration.md)
- [4.0.0 변경 내용](https://github.com/syjkim0125/ai-workflow-kit/blob/main/CHANGELOG.md)

MIT · [JongKun Kim](https://github.com/syjkim0125)
