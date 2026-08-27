# ai-workflow-kit

AI 에이전트와 함께 일할 때 **사람이 이해를 놓치지 않게** 하는 작업 규칙 모음.

## 그림 한 장

```mermaid
flowchart TD
    A["한 줄 요청<br/>'결제 취소 되게 해줘'"] --> B["에이전트가 인수조건 초안을 씀"]
    B --> G1{{"G1 · eli5로 설명<br/>'이게 맞아요?'"}}
    G1 --> C["사람이 승인"]
    C --> D["에이전트가 구현하고 테스트"]
    D --> G4{{"G4 · 먼저 맞춰보기<br/>'이 변경이 뭘 할 것 같아요?'"}}
    G4 --> E["사람이 이해한 채로 머지"]

    style G1 fill:#fff3cd,stroke:#d39e00,color:#000
    style G4 fill:#fff3cd,stroke:#d39e00,color:#000
```

## 다섯 문장

에이전트는 코드를 아주 빨리 씁니다.
사람이 읽는 속도는 그대로입니다.
그래서 아무도 이해하지 못한 코드가 쌓입니다.
이 키트는 사람이 승인하기 **직전**마다 짧은 설명을 만들게 합니다.
설명 없이는 다음 단계로 못 갑니다.

## 노란 상자가 하는 일

**G1 — 만들기 전.** 무엇을 만들 건지 그림 한 장으로 보여줍니다. 그리고 이렇게 묻습니다: *"당신이 말 안 해서 제가 정한 것들, 이게 맞나요?"*

**G4 — 머지 전.** 설명을 **먼저 안 보여줍니다.** 바뀐 코드만 보여주고 묻습니다: *"이게 뭘 하는 것 같아요?"* 답하고 나서야 정답이 나옵니다. 틀린 부분이 어디였는지 알려줍니다.

맞춰보기를 먼저 하는 이유는, 설명을 읽는 것과 이해하는 것이 다르기 때문입니다.

## 지키게 만드는 방법

규칙을 문서에 적어두는 것만으로는 지켜지지 않습니다. 그래서 게이트는 **파일을 남깁니다.**

```text
Understanding gate (G1): docs/understanding/2026-08-27-checkout.html · 2026-08-27 · Check-in: accepted
```

이 줄이 없으면 인수조건이 승인되지 않고, 머지도 안 됩니다.
"설명했습니다"라고 말할 수는 있어도, 없는 파일을 있다고 할 수는 없으니까요.

작은 변경이라 건너뛰고 싶으면 그것도 적습니다:

```text
Understanding gate (G4): N/A — 상수 한 줄 변경
```

건너뛴 것도 기록이라 눈에 보입니다.

## 시작하기

이 저장소를 통째로 복사하지 마세요. `real-work/` 안의 파일들을 프로젝트에 흡수시키는 방식입니다.

전체 배포 지침: **[README-FIRST.md](README-FIRST.md)**

| 알고 싶은 것 | 읽을 곳 |
|---|---|
| 어떻게 설치하나 | [README-FIRST.md](README-FIRST.md) · [AI-SETUP.md](real-work/docs/engineering/AI-SETUP.md) |
| 전체 작업 흐름 | [AI-WORKFLOW.md](real-work/docs/engineering/AI-WORKFLOW.md) |
| 항상 지킬 원칙 | [AGENTS.md](real-work/AGENTS.md) |
| 게이트가 뭘 물어보나 | [UNDERSTANDING.md](real-work/templates/UNDERSTANDING.md) |
| 왜 이렇게 만들었나 | [AI-WORKFLOW-SOURCES.md](real-work/docs/engineering/AI-WORKFLOW-SOURCES.md) |

## 필요한 것

- 코딩 에이전트 (Claude Code 또는 Codex)
- [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) 플러그인 — 게이트의 설명 엔진(`ce-explain`)이 여기 들어 있습니다
