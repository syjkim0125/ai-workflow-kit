# 릴리스 노트

한국어 · [English](README.md)

릴리스마다 사용자에게 바뀌는 점입니다. 모든 변경은 [CHANGELOG](https://github.com/syjkim0125/ai-workflow-kit/blob/main/CHANGELOG.md)에 있습니다.

| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| [5.4.0](5.4.0.ko.md) | 2026-11-24 | 작은 변경을 바로 처리하는 길, 더 짧은 일반 경로, 그래프 CLI 기록, 평행 복사본 나열 |
| [5.3.0](5.3.0.ko.md) | 2026-11-05 | 업데이트할 때 CLI와 설치 버전을 알려 주고, 버전이 섞인 설치를 알림 |
| [5.2.0](5.2.0.ko.md) | 2026-11-04 | intake가 대안을 직접 보여 주고, 결제 렌즈가 되돌릴 기준을 물음 |
| [5.1.0](5.1.0.ko.md) | 2026-11-04 | 계획·리뷰에 Superpowers 단계별 스킬 사용 (npm 미배포) |
| [5.0.2](5.0.2.ko.md) | 2026-11-02 | 위험한 선택을 G1 전에 드러냄 |
| [5.0.1](5.0.1.ko.md) | 2026-10-26 | 검증 스킬 재사용, Pstack 검증, 리뷰 인원 조정 |

## 4.x에서 업데이트할 때

5.x는 실제 실행 기록을 요구하는 v3 형식을 사용합니다. [검증 가이드](https://github.com/syjkim0125/ai-workflow-kit/blob/main/skills/workflow/references/verification.md)에 따라 `.ai-workflow/verification.json`과 Story에 연결된 G1/G3 기록을 준비하세요. 기존 v1/v2는 조회 전용(`upgrade-required`)입니다. 기존 worker를 중지하고 증거·시도 기록을 보존한 뒤 v3에서 리뷰·검증해야 합니다. `graph delivery`는 최종 스냅샷에 연결된 실제 G4도 확인합니다.
