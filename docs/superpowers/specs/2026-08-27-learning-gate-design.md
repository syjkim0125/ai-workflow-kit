# Learning Gate — 설계 문서

Date: 2026-08-27
Status: Approved (design) — 구현 미착수
Scope: A(학습 게이트)만. B(흡수/설치 메커니즘)는 별도 스펙.

## 1. 문제

키트에는 인간 게이트가 6개 있지만, 사람이 **이해했는지**를 돕는 장치가 하나도 없다.
`AI-WORKFLOW.md:172`는 이미 understanding gate를 요구한다 —
*"have the agent explain the change in runtime/data-flow order… The owner must be able to restate it"* —
그런데 실행할 명령이 적혀 있지 않다. `AGENTS.md:44`도
*"demand a structure-first explainer, quiz yourself against the change"*로 끝난다.

산문으로 된 요구는 에이전트가 매번 즉흥 해석하고, 대개 건너뛴다.
결과: AI가 생성한 diff를 사람이 이해하지 못한 채 통과시키는 cognitive debt.

## 2. 도구 선택

`/eli5`(claude-community, 본문 5줄)는 *"big pictures and few words"*로 초심자 오리엔테이션을 만든다.
`ce-explain`(compound-engineering)은 밀도 높은 개인용 explainer + predict-then-reveal 체크인을 제공하며,
자기 목적을 *"agent-driven development removed the learning that writing code by hand used to provide;
this skill is the replacement"*로 선언한다.

**결정: ce-explain을 엔진으로 쓰고, eli5 레지스터를 그 필수 첫 층으로 강제한다.**

근거:
- `explainer-html.md`가 이미 *"Show, then tell — every explainer leads with something to look at"*를 규정한다.
  eli5 층은 덧붙이는 게 아니라 그 포맷의 기본형을 강화하는 것이다.
- eli5 단독은 인수조건 검토나 diff 검증에 필요한 밀도를 낼 수 없다.
- 산출물·읽기 습관이 하나로 유지된다.

**제약: diff 게이트에서 eli5 그림은 예측 이후에만 노출한다.**
`check-in.md`: *"The prediction must come before any interpretation reaches the user,
or the mechanic is dead on arrival."* eli5 그림은 해석이다.

## 3. 3층 아티팩트 구조

| 층 | 내용 | 읽는 시간 |
|---|---|---|
| 1. ELI5 | 그림 1장 + 문장 5개 이하, 전문용어 0 | 30초 |
| 2. 판단 | 이 게이트에서 사람이 실제로 결정할 것만 | 3분 |
| 3. 밀도 | runtime/data-flow, 실패 경로, 검증 안 된 것 | 필요 시 |

층별 시간 예산을 명시하는 것이 목적이다 — 사람의 읽는 시간이 병목이므로.

형식: HTML (ce-explain 기본값). 인라인 SVG 그림이 온전히 유지된다.
`docs/understanding/<YYYY-MM-DD>-<slug>.html`에 커밋한다.

## 4. 게이트 배치

기존 risk gate(`AGENTS.md:55-58`)에 얹는다. **새 판단축을 만들지 않는다** — 판단 지점이 늘면 그게 곧 미준수 지점이다.

| 게이트 | 위치 | 적용 |
|---|---|---|
| G1 Acceptance `Draft`→`Approved` | `AI-WORKFLOW.md:55` | **무조건 필수** |
| G4 merge 전 understanding gate | `AI-WORKFLOW.md:172` | **필수, 단 N/A 기록 시 생략 허용** |
| G3 high-risk plan checkpoint | `AI-WORKFLOW.md:74` | high-risk에서만 |
| G5 Story Acceptance verdict | `AI-WORKFLOW.md:114` | Task 2개 이상 분할 시만 |
| G2 task breakdown 승인 | `AI-WORKFLOW.md:69` | 제외 — 구조적 판단이라 그림이 무의미 |
| G6 compound 여부 | `AI-WORKFLOW.md:176` | 제외 — 현행으로 충분 |

### G1 — 인수조건 이해 게이트

트리거: Acceptance 계약이 `Draft`로 작성된 직후, 사람 승인 요청 **전**.
모드: ce-explain concept/idea.

판단층 고정 슬롯 4개 — `templates/ACCEPTANCE.md`의 기존 필드를 질문으로 뒤집은 것:

1. **이번에 반드시 되는 것** — MUST를 관찰 가능한 문장으로
2. **일부러 안 하는 것** — negative behaviors + out of scope
3. **당신이 말 안 해서 내가 정한 것** — unspecified-policies register
4. **다 됐는지 어떻게 확인하나** — 결정적 검증 방법

슬롯 3이 가장 중요하다. 에이전트가 조용히 내린 결정을 사람 눈앞에 강제로 올린다.

체크인: Boundary 유형 1개를 **제안 필수** —
*"이 계약이 적용되지 않는 경우를 하나 말해보세요."*
답을 못 하면 계약이 모호한 것이므로 승인이 아니라 계약 수정으로 간다.

수락은 강제하지 않는다. `check-in.md`가 *"The user can always decline the offer,
and a decline is final"*로 규정하고, 키트도 outer loop 주인은 사람이라고 선언한다
(`AGENTS.md` Engineering lifecycle). 거절 시 `Check-in: declined`로 정직하게 기록한다.

### G4 — 구현 이해 게이트

트리거: 구현 완료 + 검증 통과 후, merge/PR 전.
모드: ce-explain diff.

순서가 계약이다:

```text
1. raw diff / stat 만 제시 — 주석 0
2. "이 변경이 무엇을 하고 왜 만들어졌는가?" → 턴 종료
3. 예측 도착 후에만 3층 공개
```

판단층 고정 슬롯 3개:

1. **예측과의 격차** — 맞은 것 / 놓친 것 / 틀린 것
2. **G1 계약의 MUST별 PASS/FAIL + 증거**
3. **각 테스트가 증명하는 것과 여전히 증명 안 된 것**

통과: 사람이 변경을 재진술할 수 있음 + 기록.

생략: diff가 한눈에 읽히면 `Understanding gate (G4): N/A — <사유>`로 기록한다.
`Plan source: N/A — small reversible task` 선례와 같은 패턴이다. 생략도 기록이므로 눈에 보인다.

### G3 / G5 — 조건부 게이트 (새 템플릿 없음)

두 게이트는 **새 슬롯을 정의하지 않는다.** 기존 슬롯을 재사용하고 범위만 좁힌다.
템플릿이 늘면 유지 대상이 늘고, 유지 안 되는 템플릿은 강제력이 아니라 잡음이 된다.

- **G3 (high-risk plan checkpoint)** — G1 슬롯을 계획 문서에 그대로 적용한다.
  슬롯 3("당신이 말 안 해서 내가 정한 것")이 계획 단계에서 특히 값을 낸다:
  ce-plan이 조용히 고른 구현 방향을 사람 눈앞에 올린다.
  G1에서 이미 확정된 항목은 중복 서술하지 않고 "G1에서 확정" 한 줄로 참조한다.

- **G5 (Story Acceptance verdict)** — Task 2개 이상으로 분할된 Story에서만.
  Task별 G4를 이미 돌렸으므로 개별 diff는 다시 설명하지 않는다.
  범위는 **통합된 전체가 계약을 만족하는가** 하나로 좁힌다:
  판단층에 G1 계약의 MUST별 PASS/FAIL과, 어느 Task도 단독으로는 책임지지 않은
  통합 지점(Task 경계에서만 드러나는 동작)만 싣는다.

기록 줄은 같은 형식을 쓴다: `Understanding gate (G3): …`, `Understanding gate (G5): …`.

### 응집점

G4 판단층 슬롯 2가 G1이 만든 계약을 직접 참조한다.
두 게이트는 같은 문서를 축으로 도는 하나의 루프다.
G1을 건너뛰면 G4가 검사할 대상이 없어지고, 그 자체가 미준수 신호로 드러난다.

## 5. 강제 — 4층

스킬로 만드는 것만으로는 강제되지 않는다. 근거는 키트 자신의 `AI-WORKFLOW-SOURCES.md`:
*"persistent, lightweight documentation/index context can outperform relying on
automatic Skill discovery… Skills remain useful for explicit workflows."*

| 층 | 수단 | 강제력 | Codex 패리티 |
|---|---|---|---|
| 1 | `AGENTS.md` 규칙 | 약 | O |
| 2 | 스킬 | 중 | O |
| 3 | 산출물 의존성 | **강** | O |
| 4 | hook | 최강 | X |

### 1층 — AGENTS.md

- `AGENTS.md:44`의 산문을 명령으로 교체: `learning-gate`를 실행하라, 규약은 `templates/UNDERSTANDING.md`
- Engineering lifecycle 섹션에 G1/G4 필수 bullet 추가
- Skills 섹션에 `learning-gate` 등록 (story-breakdown / usage-handoff 옆)

### 2층 — learning-gate 스킬

`.claude/skills/learning-gate/` + `.agents/skills/learning-gate/` 미러 두 벌. **얇게 유지한다.**
무거운 내용(질문 슬롯)은 `templates/UNDERSTANDING.md`가 한 벌로 소유하여
story-breakdown이 겪는 두 벌 동기화 부담을 늘리지 않는다.

하는 일 6가지:

1. 게이트 판정 (`acceptance` | `diff`) — 인자 또는 문맥
2. `templates/UNDERSTANDING.md`에서 해당 슬롯 로드
3. ce-explain 호출 — 슬롯을 인자로 주입, 3층 구조 요구
4. diff 게이트면 predict-then-reveal 순서 보장
5. **destination 강제** — `docs/understanding/<YYYY-MM-DD>-<slug>.html`
6. canonical 계약에 기록 줄 append

5번이 래퍼의 핵심 존재 이유다. ce-explain 기본 출력은 `$RUN_DIR`(/tmp)이고
스킬 본문이 *"a temporary location that does not survive reboot"*라고 못박는다.
/tmp에 남으면 3층 강제가 불가능해진다.

명시 호출도 지원: `/learning-gate acceptance`, `/learning-gate diff`.

### 3층 — 산출물 의존성 (핵심)

기록 줄 형식 (`templates/UNDERSTANDING.md`가 소유):

```text
Understanding gate (G1): docs/understanding/2026-08-27-checkout-contract.html · 2026-08-27 · Check-in: accepted
Understanding gate (G4): docs/understanding/2026-08-28-checkout-diff.html · 2026-08-28 · Check-in: declined
Understanding gate (G4): N/A — 상수 1줄 변경, diff 4행
```

차단 규칙:
- G1 줄 없으면 `Draft` → `Approved` 전환 금지
- G4 줄(또는 `N/A — 사유`) 없으면 PR merge 금지

배선:
- `AI-WORKFLOW.md:55` 흐름도에 G1 단계 삽입
- `AI-WORKFLOW.md:172` 문단을 명령 + 기록 요구로 교체
- Story Acceptance review 체크리스트(1-9번)에 G4 기록 확인 항목 추가

**Jira 대응.** 키트는 canonical 계약이 Jira Story일 수 있다고 허용한다.
그러면 파일 grep이 불가능하다. 해결: 아티팩트는 계약이 어디 있든 **항상 레포 로컬**에 남긴다.
계약이 Jira면 Jira에 경로를 적고, 검사는 로컬 파일 존재 여부로 한다.

산문 규칙은 얼버무릴 수 있지만 파일 존재 여부는 얼버무릴 수 없다.

### 4층 — hook (옵인)

`usage-handoff/scripts/enable-hook.sh` 패턴 그대로: 커밋하지 않음,
`.claude/settings.local.json`, 사람이 켤 때만.

범위: PreToolUse on `git merge` / `gh pr create` →
`docs/understanding/`에 현재 브랜치 관련 최근 아티팩트가 있는지 확인, 없으면 **경고**.

**차단이 아니라 경고인 이유:** hook은 계약 문서 위치를 모르므로 판정이 부정확할 수밖에 없다.
오탐이 몇 번 나면 사람이 hook을 끄고, 그러면 강제력이 0이 된다. 경고는 살아남는다.

hook은 Claude Code 전용이므로 필수로 만들지 않는다 — v2.3에서 세운 Claude/Codex 패리티 원칙을 지킨다.

## 6. 질문 템플릿 고정

`templates/UNDERSTANDING.md`가 게이트별 고정 슬롯을 소유한다.
새로 발명하지 않고 기존 필드를 질문 형태로 뒤집는다:

- G1 슬롯 ← `templates/ACCEPTANCE.md`: MUST/SHOULD, negative behaviors,
  unspecified-policies register, verification enablement, environment assumptions
- G4 슬롯 ← `AI-WORKFLOW.md:172`: runtime/data-flow order, why this structure,
  invariants, failure paths, what each test proves and what remains unproven

이것이 "누가 얘기해도 비슷한 응답 형태"의 실제 구현이다.

## 7. 검증 — EVALS.md 압박 시나리오

`AI-WORKFLOW.md:184`가 요구하는 방식을 따른다. 6개:

1. 사람이 "그냥 승인해줘, 설명 필요 없어" → 체크인은 `declined`로 기록되되 아티팩트는 여전히 생성되는가
2. diff 게이트에서 예측 요청과 설명이 같은 메시지에 나오는가 (계약 위반 탐지)
3. 계약이 Jira에만 있을 때 기록 줄이 어디로 가는가
4. 1줄 변경에 G4가 과잉 실행되는가, 아니면 N/A로 처리되는가
5. eli5 층이 실제로 문장 5개 이하 / 전문용어 0을 지키는가 — 제일 먼저 무너질 곳
6. Superpowers 전역 설치 상태에서 learning-gate가 brainstorming을 끌어오지 않는가

## 8. 변경 대상 파일

신규:
- `real-work/templates/UNDERSTANDING.md`
- `real-work/.claude/skills/learning-gate/{SKILL.md,EVALS.md}`
- `real-work/.agents/skills/learning-gate/{SKILL.md,EVALS.md}`
- `real-work/docs/understanding/.gitkeep`

수정:
- `real-work/AGENTS.md`
- `real-work/docs/engineering/AI-WORKFLOW.md`
- `real-work/docs/engineering/AI-SETUP.md`
- `real-work/docs/engineering/AI-WORKFLOW-SOURCES.md` (eli5 / ce-explain 출처 기록)
- `README-FIRST.md` (파일 트리)
- `CHANGELOG.md` (v2.5)

## 9. 범위 밖

- **B: 흡수/설치 메커니즘.** `README-FIRST.md`는 파일 10개 이상의 수동 복사를 요구하고,
  `AGENTS.md`/`CLAUDE.md`는 기존 규칙과 **병합**해야 한다 — 기계적으로 불가능한 판단 작업이다.
  따라서 레포마다 흡수 결과가 달라지고, 키트가 올라가도 이미 흡수한 레포는 옛 버전에 머문다.
  아무리 좋은 게이트를 설계해도 파일이 그 레포에 없으면 강제되지 않는다.
  별도 스펙에서 다룬다. 순서는 A → B (A가 파일 목록을 바꾸므로).
- G2 / G6 게이트
- `/eli5` 스킬 자체의 수정 — 외부 플러그인이므로 건드리지 않고 레지스터만 차용한다
