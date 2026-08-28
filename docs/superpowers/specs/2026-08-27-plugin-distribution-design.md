# Plugin Distribution (B) — 설계 문서

Date: 2026-08-27 (작성) / 2026-08-28 (확정)
Status: Approved (design) — 구현 미착수
Scope: B(흡수/설치 메커니즘). A(학습 게이트)는 `2026-08-27-learning-gate-design.md`, 구현 완료.

## 1. 문제

키트를 쓰려면 `README-FIRST.md`가 지시하는 대로 파일 십수 개를 손으로 복사하고,
`AGENTS.md`/`CLAUDE.md`는 기존 규칙과 **병합**해야 한다 — 기계적으로 불가능한 판단 작업이다.

결과:
- 레포마다 흡수 결과가 다르다. 절반만 복사되거나 충돌한 채 남는다.
- 키트가 v2.6으로 올라가도 이미 흡수한 레포는 v2.5에 머문다. 되돌릴 경로가 없다.
- 스킬을 두 벌(`.claude/skills/`, `.agents/skills/`) 유지해야 하고, `AGENTS.md`가 그걸
  규칙으로 못박고 있다: "when editing one, apply the same change to the other."

아무리 좋은 게이트를 설계해도 파일이 그 레포에 없으면 강제되지 않는다.

## 2. 플러그인이 할 수 있는 것과 없는 것

키트가 의존하는 CE 플러그인의 `ce-setup`이 패턴을 이미 증명한다:

```yaml
name: ce-setup
disable-model-invocation: true    # 사람이 명시 호출만
```
> Copy `references/config-template.yaml` to `<repo-root>/.compound-engineering/…`
> Append the entry to the repo-root `.gitignore` **only if the user approves**.

즉 **플러그인이 템플릿을 품고, 사용자가 호출한 셋업 스킬이 레포에 써넣는다.**

| 구성물 | 플러그인 배포 | 근거 |
|---|---|---|
| 스킬 + 테스트 | 가능 | 플러그인의 본래 기능 |
| 템플릿, 엔지니어링 문서 | 가능 (`references/`로 품고 셋업이 복사) | `ce-setup` 선례 |
| **`AGENTS.md`** | **불가** | 런타임이 레포 루트에서 자동으로 읽는 파일. 플러그인은 타겟 레포의 상시 컨텍스트에 텍스트를 주입할 수 없다 |
| **`docs/understanding/` 아티팩트** | **불가** | 3층 강제의 증거물. 레포에 있어야 검사 가능 |
| **검사 스크립트** | **불가 (의도적으로)** | §6 참조 — 강제가 플러그인 설치에 의존하면 안 된다 |

플러그인 전용으로 가면 전부 스킬 discovery에 의존하게 되는데, 키트는 그걸 의도적으로
버렸다 (`AI-WORKFLOW-SOURCES.md`: *"persistent documentation context can outperform
relying on automatic Skill discovery"*). 따라서 하이브리드이고, **셋업 커맨드가 하중을 받는다.**

## 3. 미러 소멸 — B의 가장 큰 이득

CE는 스킬 30개를 **한 벌만** `./skills/`에 두고 Codex 매니페스트가 그것을 가리킨다:

```json
// .codex-plugin/plugin.json
"skills": "./skills/"
```

`.agents/`에는 마켓플레이스 포인터만 있고 스킬 미러가 없다.

플러그인화하면 키트의 두 벌 미러가 한 벌이 된다. 함께 사라지는 것:
- `AGENTS.md`의 "편집하면 반대쪽도 같이 고쳐라" 규칙
- `test-kit-structure.sh`의 `cmp` 미러 검사 2개
- 모든 스킬 편집에 붙던 동기화 검증

부수 효과가 아니라 B를 하는 주된 이유 중 하나다.

## 4. 이름

`awk`는 유닉스 표준 도구 이름이다. `/awk-setup`은 사람에게도 에이전트에게도 혼동을 준다.

- 설치 스킬: **`workflow-setup`**
- 레포 로컬 디렉터리: **`.ai-workflow/`** (CE의 `.compound-engineering/` 선례를 따름)

## 5. 레포 구조

플러그인 = 레포 루트 (CE와 동일, `source: "./"`).
마켓플레이스는 `git-subdir`도 지원하지만 그쪽은 릴리스마다 `sha` 고정 관리가 붙고,
스킬을 옮기면 `real-work/`에 템플릿만 남아 이름이 무의미해진다.

```text
ai-workflow-kit/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json                source: "./"
├── .codex-plugin/
│   └── plugin.json                     skills: "./skills/"
├── .agents/plugins/marketplace.json    Codex 마켓플레이스 포인터
├── skills/
│   ├── learning-gate/                  SKILL.md · EVALS.md · tests/
│   ├── story-breakdown/                SKILL.md · EVALS.md
│   ├── usage-handoff/                  SKILL.md · scripts/(스킬용만) · tests/ · templates/
│   └── workflow-setup/                 신규: 설치기
│       ├── SKILL.md                    disable-model-invocation: true
│       └── references/                 타겟 레포로 복사될 것들
│           ├── agents-block.md
│           ├── bin/                    check-understanding.sh · gate-guard.sh · enable-gate-hook.sh
│           ├── templates/*.md
│           └── engineering/*.md
├── README.md · README-FIRST.md · CHANGELOG.md
├── docs/superpowers/
└── oliveyoung-test/                    (손대지 않음)
```

`real-work/`는 해체된다.

## 6. 경로 해석 — 플러그인화가 깨뜨리는 것

플러그인 캐시 경로는 **버전별로 나뉜다**. 이 머신에 `superpowers/5.1.0/`, `6.1.1/`,
`6.2.0/`, `6.3.0/`가 공존한다. 그리고 현재 키트에는 스킬 경로가 **7곳 하드코딩**돼 있다
(`AGENTS.md` ×2, `templates/UNDERSTANDING.md`, `AI-WORKFLOW.md`, `AI-SETUP.md`,
`SKILL.md` ×2). 플러그인으로 설치하면 그 경로는 레포에 존재하지 않는다.

훅은 더 나쁘다. `enable-gate-hook.sh`가 절대 경로를 구워 넣는데, 그 경로가 플러그인
캐시를 가리키면 **업데이트마다 깨지고**, `gate-guard.sh`는 검사기를 못 찾으면 exit 0
하므로 **조용히** 깨진다. A에서 R17·R19로 두 번 거부한 실패 양식이다.

**결정: `workflow-setup`이 세 스크립트를 레포로 복사한다.**

**규칙: 훅이 실행하는 스크립트와 강제 검사기는 레포로. 스킬이 실행하는 스크립트는
플러그인에 남고 `SKILL_DIR`로 자기 경로를 찾는다** (CE `ce-explain`의 방식).

훅 명령은 상시 컨텍스트가 아니라 `settings.local.json`에 굳어 있어서, 경로가 낡으면
아무도 모르는 채 무력화된다. 스킬은 실행될 때마다 자기 위치를 다시 계산할 수 있다.

```text
<repo>/.ai-workflow/
├── VERSION                     설치된 키트 버전
└── bin/
    ├── check-understanding.sh  강제 검사기 — CI·팀원도 써야 함
    ├── gate-guard.sh           훅이 실행
    ├── enable-gate-hook.sh     그 훅을 설치
    ├── usage-guard.sh          훅이 실행
    └── enable-hook.sh          그 훅을 설치
```

`usage-handoff`도 같은 문제를 갖고 있다 — 그 `enable-hook.sh`는
`$(git rev-parse --show-toplevel)/.claude/skills/usage-handoff/scripts/usage-guard.sh`를
구워 넣고, `usage-guard.sh`는 *"every failure path exits 0 silently"*다. 같은 처리를 받는다.

`new-handoff.sh`, `usage.py`, `usage-refresh.py`는 스킬이 실행하므로 플러그인에 남는다.

근거:
- **강제가 플러그인 설치에 의존하면 안 된다.** CI나 플러그인을 안 깐 팀원이 검사기를
  돌릴 수 없으면 3층이 약해진다. 검사기는 런타임 중립 bash이고 그렇게 설계됐다.
- 훅이 가리키는 경로가 안정적이 되어 플러그인 업데이트로 깨지지 않는다.
- `gate-guard.sh`의 형제 경로 해석(A의 R17)이 그대로 유효하다 — 셋이 같은 `bin/`에 있다.

대가: 레포가 스크립트 세 개를 지닌다. `/workflow-setup` 재실행으로 갱신하고,
`VERSION`으로 낡았는지 판별한다. 문서의 하드코딩 경로 7곳은 `.ai-workflow/bin/`으로
갱신되며, 다시 **정확해진다** — 레포에 실재하는 경로이기 때문이다.

## 7. `workflow-setup`

`ce-setup` 패턴: 진단 → 승인 요청 → 쓰기. `disable-model-invocation: true`.

레포에 쓰는 것은 **다섯 가지뿐**이다:

1. `AGENTS.md` 관리 블록
2. `.ai-workflow/bin/*` (훅 실행 스크립트 + 검사기) + `.ai-workflow/VERSION`
3. `templates/*.md`
4. `docs/engineering/*.md`
5. `docs/understanding/.gitkeep`

### 관리 블록

```markdown
<!-- BEGIN ai-workflow-kit v2.6 — managed; edits inside are overwritten -->
…
<!-- END ai-workflow-kit -->
```

규칙:
- 마커 없음 → 삽입 위치를 물어본 뒤 추가
- 마커 있음 → **그 사이만** 교체. 바깥은 절대 건드리지 않는다
- 쓰기 전 diff를 보여주고 승인받는다
- 마커에 버전을 박아 무엇이 설치됐는지 판별한다
- 대상 파일이 없으면 새로 만든다

### 블록 내용 (~75줄)

두 부분이다: 현재 `AGENTS.md`의 **엔지니어링 원칙 8개 섹션 전문**과, 게이트 규칙 +
라이프사이클 + 지식 인덱스.

**원칙을 스킬로 내리지 않는다.** 초안에서는 블록을 얇게 두려고 원칙을
`workflow-principles` 스킬로 옮기고 블록에는 "로드하라"는 한 줄만 남기려 했다.
검토에서 뒤집었다:

- **원칙은 절차가 아니라 태도다.** 스킬은 발동 시점이 있는 절차에 맞는다("머지 전에
  게이트를 돌려라"). 이 8종은 발동 시점이 없고 첫 도구 호출부터 작동해야 한다.
  "필요하면 로드하라"는 로드 여부를 매번 모델 판단에 맡기는 것이고, 그게 키트가
  거부한 discovery 의존이다.
- **`Explained completion`이 게이트를 명령하는 원칙이다.** 그 세 번째 불릿이 문자
  그대로 `learning-gate` 실행을 지시한다. 그것을 discovery 의존 스킬로 내리면서
  게이트만 상시 규칙으로 두면 의존 방향이 뒤집힌다.
- 비용은 38줄이다. `AGENTS.md`는 애초에 에이전트 규칙을 담는 파일이고, 실제로 하중을
  받는 규칙 75줄은 과하지 않다.

## 8. 업데이트 · 멱등성 · 제거

| 동작 | 흐름 |
|---|---|
| 최초 설치 | `/plugin marketplace add syjkim0125/ai-workflow-kit` → `/plugin install ai-workflow-kit` |
| 레포 적용 | `/workflow-setup` |
| 업데이트 | `/plugin update` (스킬 자동) → `/workflow-setup` 재실행 (레포 파일 갱신) |
| 재실행 | 멱등. 두 번 돌려도 블록 하나, 스크립트는 덮어쓰기 |
| 낡음 판별 | `.ai-workflow/VERSION` 과 플러그인 버전 비교, 다르면 알림 |
| 제거 | `/workflow-setup --remove` — 마커 사이와 `.ai-workflow/`만 삭제. 아티팩트와 템플릿은 남긴다 |

레포별 한 번의 명시 행동(`/workflow-setup`)은 없앨 수 없다. 플러그인은 타겟 레포에
파일을 쓸 수 없기 때문이다. 지금(파일 십수 개 수동 복사 + 손 병합)보다는 훨씬 낫다.

## 9. README 3층 보강

현재 README는 키트 자신의 3층 규칙 중 **1층만** 구현하고 있다. 그리고 1층에
정확성 문제가 있다: 노드 B "에이전트가 무엇을 만들지 정하고 보여줌"은 에이전트가
혼자 정하고 통보하는 것처럼 읽히는데, `AI-WORKFLOW.md`는 정반대를 규정한다 —
*"Do not silently expand it… interview the requester"*. 사람의 역할을 축소해서 그렸다.

세 층으로 만든다:

- **1층 ELI5** — 지금 그림 유지, 노드 B를 대화/인터뷰가 드러나게 수정
- **2층 전체 흐름** — 신규. `AI-WORKFLOW.md`의 13단계와 인간 게이트 4개를 표시:
  요청 → 인터뷰 → 인수조건 Draft → **G1** → 승인 → 크기 판단 → (필요시 breakdown +
  승인) → 위험도 게이트 → 구현·테스트 → **G4** → 머지
- **3층 링크** — 기존 표 + 플러그인 설치 안내로 갱신

## 10. 검증

`test-kit-structure.sh`의 역할이 바뀐다. 지금은 키트 자체 정합성을 보지만,
앞으로는 **`workflow-setup`이 만든 결과**를 검증한다:

- 임시 레포에 셋업을 돌리고 다섯 산출물이 모두 생겼는지
- 재실행 후에도 블록이 하나인지 (멱등성)
- 마커 바깥의 기존 내용이 바이트 동일하게 보존되는지
- `--remove` 후 마커 사이와 `.ai-workflow/`만 사라지고 나머지가 남는지
- 기존 `AGENTS.md`가 없는 레포에서도 동작하는지
- 복사된 `.ai-workflow/bin/check-understanding.sh`가 그 레포에서 실제로 동작하는지

제거: 미러 `cmp` 검사 2개 (미러가 사라짐).
`README-FIRST` 조건부 검사는 유지 — 키트 자체 검사로서 여전히 유효하다.

**경로 산술 주의:** 오늘 `test-kit-structure.sh`는 `$TEST_DIR/../../../..`로 4단계를
올라가 `real-work/`에 닿는다. 이동 후 `skills/learning-gate/tests/`에서는 3단계면
레포 루트다. 이 상수를 고치지 않으면 테스트가 조용히 엉뚱한 곳을 검사한다.

`check-understanding.sh`와 `enable-gate-hook.sh`의 자체 테스트는 경로만 바뀌고
내용은 그대로다.

## 11. 변경 대상

신규:
- `.claude-plugin/{plugin.json,marketplace.json}`
- `.codex-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `skills/workflow-setup/{SKILL.md,references/…}`

이동:
- `real-work/.claude/skills/*` → `skills/*`
- `real-work/.claude/skills/learning-gate/scripts/*` → `skills/workflow-setup/references/bin/`
- `real-work/.claude/skills/usage-handoff/scripts/{usage-guard.sh,enable-hook.sh}` → 같은 곳
  (`new-handoff.sh`, `usage.py`, `usage-refresh.py`는 `skills/usage-handoff/scripts/`에 잔류)
- `real-work/templates/*` → `skills/workflow-setup/references/templates/`
- `real-work/docs/engineering/*` → `skills/workflow-setup/references/engineering/`

삭제:
- `real-work/.agents/skills/*` (미러 소멸)
- `real-work/` 디렉터리

수정:
- `README.md` (3층 보강 + 설치 안내)
- `README-FIRST.md` (수동 복사 지침 → 플러그인 설치 지침)
- `CHANGELOG.md` (v2.6)
- `skills/learning-gate/tests/test-kit-structure.sh` (역할 전환 + 경로 산술)
- 하드코딩 경로 7곳 → `.ai-workflow/bin/`

## 12. 범위 밖

- `oliveyoung-test/` — 손대지 않는다
- 마켓플레이스 공개 등록 — 개인 레포를 직접 `marketplace add` 하는 것으로 충분
- 학습 게이트의 동작 변경 — A에서 확정됐고 B는 배포 방식만 바꾼다
- `check-understanding.sh` / `gate-guard.sh` / `usage-guard.sh` 내부 로직 — 위치만 이동, 내용 불변
- `usage-refresh.py`가 쓰는 `$HOME/.claude/hooks/` 경로 — 이미 홈 기준이라 영향 없음
