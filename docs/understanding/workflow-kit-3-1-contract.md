# Story: 안전한 설치와 선택적 Jira 발행
Status: Delivered
Owner: JongKun Kim
Understanding gate (G1): docs/understanding/workflow-kit-3-1-approval.md · 2026-09-08 · Check-in: accepted
Understanding gate (G4): docs/understanding/workflow-kit-3-1-diff.md · 2026-09-09 · Check-in: accepted

## Goal
사용자가 호스트에 맞는 명령으로 workflow를 시작하고, 설치 실패 후에도 기존 프로젝트를 유지할 수 있게 한다. 승인된 Story는 같은 구조로 Jira에 발행할 수 있으며, 실패나 재시도 때문에 원본이 바뀌거나 이슈가 중복 생성되지 않아야 한다.

## Domain
- Story가 요구사항 원본이다. Jira는 선택적 발행 대상이며 로컬 발행 기록은 원본과 결과를 연결한다.

## MUST
- M1. Codex `$workflow`, Claude Code `/workflow`를 기본·status·finish 안내에 일관되게 적용한다.
- M2. 버전·저장소 메타데이터·설치 예시를 정리하고 기존 미커밋 변경을 보존해 통합한다.
- M3. 설치 실패 시 지침·스킬·템플릿·설정·검사기에 부분 변경이 남지 않으며 기존 사용자 수정도 보존한다.
- M4. 선택적 Jira 발행 기능은 G1 승인과 명시적 대상·발행 승인을 요구한다. 미연동·대상 미지정 시 미리보기만 제공한다.
- M5. Jira 내용은 Goal → Domain → MUST → SHOULD → OUT → Decisions → Verify 순서와 요구사항·검증 ID를 보존한다. 중복 방지, 생성 후 재조회·내용 검증, 실패 시 원본 보존을 지원한다.
- M6. TDD와 독립 리뷰를 수행하고 Critical/Important 이슈를 해결한다. 전체 테스트와 tarball의 새 Codex·Claude 환경 설치를 검증한다.

## SHOULD
- S1. 실패 원인과 안전한 재시도 방법을 이해하기 쉽게 안내하고 재사용할 교훈만 지식 저장소에 남긴다.

## OUT
- O1. npm 배포, 머지, 공개 범위 변경, 실제 Jira 생성, 자격증명 저장. PR 생성에 필요한 브랜치 push는 후속 사용자 승인 범위다.

## Decisions
- D1. Jira 기능을 구현하는 3.1.0 마이너 버전을 후보로 삼는다. npm latest=3.0.4 (2026-09-08).
- D2. Jira 검증은 fixture/dry-run으로 제한하고 실제 호스트의 새 세션 인식과 사람의 G4 확인은 자동 테스트와 구분한다.
- D3. 원격 main 949605d에 기존 변경 6개가 바이트 단위로 동일하게 반영돼 있으므로 그 기반의 별도 worktree에서 작업한다.
- D4. 승인 초안의 M-1/V-1 표기는 기존 검사기 호환 표기 M1/V1로 정규화했다. 번호·의미·매핑은 동일하다. Jira 입력의 하이픈 ID는 변형 없이 보존해야 한다.

## Verify
- V1 [M1, M2]. 호스트별 안내·버전·메타데이터를 검사한다.
- V2 [M3]. 설치 실패 주입 후 이전 상태와 비교하고 기존 보존·재설치 동작을 확인한다.
- V3 [M4, M5]. 승인 전 거부, 미리보기, 성공, 실패, 중복 재시도, 재조회 불일치를 확인한다.
- V4 [M6]. 실패→통과 TDD 증거, 독립 리뷰, 전체 테스트, tarball 검사·새 환경 설치 결과를 기록한다.

G4: PASS — 사용자가 설치 실패 시 기존 파일·사용자 수정 보호와 Jira 중복 생성 방지를 위한 확인 후 재시도를 재설명했고, 자동 검증과 실제 환경 통합 검증의 차이를 확인했다.
