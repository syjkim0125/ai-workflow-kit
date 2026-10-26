---
title: "fix: connect project verification recipes and bound review work"
date: 2026-10-26
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

## Goal Capsule

프로젝트의 실제 사용자 경로를 정의한 검증 스킬/가이드를 Graph 실행에 연결하고, 재현된 실행기 버그를 고친다. 일반 코드 리뷰는 기본 3명으로 운영하되 규모와 위험에 따라 조정한다. 기존 SP 검증, CE 계획/리뷰/학습, Graph 상태 관리의 소유권을 유지한다.

## Product Contract

- R1. 글의 설명을 공식 플러그인·포트와 대조해 도입 범위와 제외 범위를 명시한다.
- R2. 출력 파이프를 유지하는 분리된 자식이 있어도 검증 실행은 유한 시간 안에 실패 결과를 반환한다. 불완전한 출력은 성공이 아니다.
- R3. 허용된 검사 ID가 Object.prototype의 속성과 같아도 실행 순서와 무관하게 실행할 수 있다.
- R4. 기존 프로젝트 검증 스킬/가이드를 재사용하고, 선택한 경로와 실제 내용 해시를 작업 입력 및 실행 receipt에 연결한다. 레시피 변경은 기존 검증을 stale로 만든다.
- R5. 일반 리뷰의 기본 서브 에이전트 수는 3이다. 작은 변경은 줄이고 전문 위험이 있으면 확대한다. 내부 재위임과 단순화 리뷰도 같은 예산에 포함하며 메인이 결과를 통합한다.
- R6. 기존 recipe 없는 profile과 v3 run의 기본 동작, 두 호스트 설치, 오프라인 패키지 실행을 보존한다. 호스트가 실제 스킬을 호출했는지 코드가 인증했다고 주장하지 않는다.

### Scope

실행기·스냅샷·작업 입력, 기존 단계별 지침, 실제 검증 스킬 예제, 회귀 검사와 배포 검사를 수정한다. 모델 런타임, 추가 오케스트레이터, 개인 전역 설정, 자동 플러그인 설치, 전체 Pstack 워크플로우, 버전/태그 변경과 재배포는 포함하지 않는다. 기존 비추적 사용자 파일을 보존한다.

## Planning Contract

### Current evidence

검토 기준은 main `0d7fd02`다. 기존 166개 검사는 통과했지만 별도 재현에서 timeout 150ms가 3016ms 뒤에야 반환됐다. `addition → toString`은 잘못 거부되고 반대 순서는 성공했다. 현재 Pstack 번들은 원칙·생성 가이드이며, 프로젝트별 검증 스킬 참조는 실행 계약에 없다.

### Source review and alternatives

- 글은 실제 앱에서 재현·검증하는 절차를 강조한다. 공식 Cursor 플러그인 0.15.32와 커뮤니티 포트 모두 프로젝트 전용 검증 스킬 생성/유지보수 절차를 제공한다. 범용 `verify` 하나를 호출하는 인터페이스는 확인되지 않았다.
- 선택: 기존 Graph에 레시피 참조를 추가하고 Pstack의 Launch/Doctor/Drive/Evidence/Cleanup과 feature map을 프로젝트별 실행 절차로 사용한다. SP가 같은 실행의 최신 증거를 확인한다.
- 제외: `poteto-mode` 전체를 두 번째 워크플로우로 실행하거나 `interrogate`를 CE 리뷰 뒤에 중첩하지 않는다. `setup-pstack`의 전역 모델 규칙이나 기본 모델 이름을 복제하지 않는다.
- 기존 E2E/검증 가이드가 충분하면 재사용한다. 새 스킬 파일 작성 자체를 모든 프로젝트의 의무로 만들지 않는다.

### Key Technical Decisions

1. 기존 profile v1에 선택적 `recipe` 프로젝트 상대 경로를 추가한다. 비어 있거나 읽을 수 없는 지정 레시피는 거부하며, 기존 recipe 없는 profile은 계속 허용한다.
2. 레시피 경로/바이트 해시만 작업 입력과 receipt에 전달한다. 본문·전체 기능 문서·로그를 매번 모델 문맥에 넣지 않는다. feature map과 helper 디렉터리는 profile inputs로 선언한다.
3. 내부 필수 입력(profile/recipe/design)을 snapshot의 추가 입력으로 전달한다. Git-ignored 필수 파일도 포함하며, 이 추가 목록으로 비Git의 명시적 입력 요구를 우회하지 않는다.
4. 종료 후 grace 기간이 지나도 파이프가 닫히지 않으면 소유한 스트림을 닫고 incomplete 결과를 발행한다. 소유하지 않는 프로세스를 이름으로 종료하지 않는다.
5. 리뷰 작업 입력에 기본 3명·라운드 전체 예산·중첩 위임 금지·메인 합산 계약을 제공한다. 실제 dispatch 제한은 호스트가 적용하며, 지원되지 않는 CE 플래그를 만들지 않는다.
6. 현재 세션은 사용자 지침에 따라 메인에서 순차 실행한다. 독립 서브 에이전트 리뷰나 실측 비용 절감으로 표시하지 않는다.

## Implementation Units

### U1. Correct execution deadlines and check identity

**Goal:** R2, R3. **Dependencies:** 없음.

**Files:** `src/graph/verification.mjs`, `test/verification.test.mjs`.

**Approach:** 기존 프로세스 그룹 정리를 유지하고 최종 반환 경로를 추가한다. incomplete 출력은 pass에서 제외한다. 중복 검사 판단은 own-property 기준으로 한다.

**Test scenarios:**
- 분리된 자식이 파이프를 유지해도 종료 grace 안에 실패 결과가 반환된다. 테스트가 만든 분리 프로세스는 테스트가 정리한다.
- 일반 timeout/signal/startup failure와 기존 로그 보존은 유지된다.
- `addition`, `toString`, `hasOwnProperty` 검사가 순서에 관계없이 실행되고 완료 증거로 인정된다.

**Execution note:** 각 회귀 검사의 실제 RED를 확인한 뒤 구현한다.

### U2. Bind project recipes to execution

**Goal:** R4, R6. **Dependencies:** U1.

**Files:** `src/graph/verification.mjs`, `src/graph/cli.mjs`, `src/graph/workflow.mjs`, `src/graph/snapshot.mjs`, `test/graph-verification.test.mjs`, `test/snapshot.test.mjs`.

**Approach:** 지정된 레시피를 읽어 경로/해시를 제공하고 같은 실행 receipt에 보존한다. snapshot 추가 입력으로 내용 변경을 감지한다. 작업별 V scope에 관련된 검사 ID만 입력에 제공한다.

**Test scenarios:**
- 레시피 경로와 해시가 설치된 CLI의 작업 입력/receipt에 나타난다.
- 레시피 변경이 저장 상태를 다시 쓰지 않고 stale을 반환하며 reset 이후 재검증할 수 있다.
- 빈 파일·경로 이탈·symlink 지정은 거부된다.
- recipe 없는 기존 profile은 유지되고, 추가 내부 파일만으로 비Git 입력 요구를 만족했다고 처리하지 않는다.
- Git-ignored 레시피도 추가 필수 입력으로 fingerprint에 반영된다.

### U3. Connect the verification skill and review budget

**Goal:** R1, R4, R5. **Dependencies:** U2.

**Files:** `skills/workflow/references/verification.md`, `skills/workflow/references/execution.md`, `skills/workflow/references/skill-integration.md`, `skills/workflow/references/role-graphs.md`, `skills/workflow/EVALS.md`, `src/graph/workflow.mjs`, `examples/verification/verify-cli/`, `examples/verification/verification.json`, `test/graph-verification.test.mjs`.

**Approach:** 기존 프로젝트 스킬/가이드 발견→재사용/최소 작성→실제 경로 최초 구동→SP 절차 안에서 Graph 실행을 명시한다. 예제는 Launch/Doctor/Drive/Evidence/Cleanup과 feature map을 포함한다. 일반 3명, 단순 변경 0~2명, 전문 위험 4~5명의 기준을 기존 문서에 둔다. simplify는 기본 inline, 리뷰 합산은 메인이다.

**Test scenarios:**
- 리뷰 노드에 예산 계약이 제공되며 구현 노드에 불필요한 리뷰 문맥을 붙이지 않는다.
- 예제의 Doctor/Drive 명령을 실제 실행하고 실패→수정→통과→레시피 변경 stale을 확인한다.
- 프롬프트 평가는 모델 호출 없이 증명됐다고 표시하지 않는다. 단순화/CE/Pstack 내부 위임도 예산에 포함하는 수동 평가 시나리오를 둔다.

### U4. Verify distribution and capture learning

**Goal:** R1–R6. **Dependencies:** U1–U3.

**Files:** `test/fixtures/verify-tarball.mjs`, `README.md`, `README.ko.md`, 관련 기존 `docs/solutions/` 문서.

**Approach:** 기존 설치 트리와 npm files 규칙을 재사용한다. 새 레시피를 포함한 tarball을 두 호스트에 오프라인 설치해 실행한다. 리뷰·새 검증 이후에만 실제 교훈을 갱신한다.

## Verification Contract

관련 node:test 회귀 검사 → 전체 `npm test` → `npm run check:package` → 새 tarball의 `test/fixtures/verify-tarball.mjs`. 필요한 파일의 기존 검사를 먼저 확인하며 텍스트 존재 테스트로 스킬 준수를 대신하지 않는다. 위험·복구/계약, 검증 실효성, 복잡도/비용을 메인에서 순차 검토한다.

## Definition of Done

모든 U의 실제 실행 근거가 있고 기존 검사와 두 호스트 패키지 경로가 통과한다. 소스·문서가 같은 recipe/예산 계약을 설명한다. 미지원 호스트 실행과 계측하지 않은 비용 절감은 성공으로 표시하지 않는다.

## Risks and Assumptions

레시피 본문의 의미와 호스트가 읽었는지는 해시만으로 증명할 수 없다. 실제 assertion과 사용자 경로는 리뷰 대상이다. 3명은 운영 기본값이며 통계적으로 최적인 인원이라는 주장이 아니다. 레시피 자동 생성·전체 기능 유지보수·모델 라우터를 추가하면 문맥과 위임 비용이 늘 수 있으므로 범위를 제한한다.

## Sources

- https://it-developer-tistory.tistory.com/261
- https://github.com/cursor/plugins/blob/99b609a72323b70204eab407c622f436e858e112/pstack/plugin.json
- https://github.com/cursor/plugins/blob/99b609a72323b70204eab407c622f436e858e112/pstack/skills/create-verification-skill/SKILL.md
- https://github.com/cursor/plugins/blob/99b609a72323b70204eab407c622f436e858e112/pstack/skills/interrogate/SKILL.md
- https://github.com/michael-denyer/pstack-claude/tree/356c6e0f978df729eb16f227d795f34d221c5aad/plugins/pstack
