# AI Workflow Kit

한 줄짜리 요청을 **사람이 승인한 요구사항 → 저장소 기반 구현 → 사람이 설명할 수 있는 결과**로 연결하는 휴대형 Agent Skill입니다.

## 설치

```bash
npx @syjkim0125/ai-workflow-kit init
```

이 명령은 Codex/Claude Code 프로젝트에 기존 내용을 보존하면서 다음을 설치합니다.

- Codex: `.agents/skills/workflow/`
- Claude Code: `.claude/skills/workflow/`
- 짧은 라우팅 규칙: `AGENTS.md`, `CLAUDE.md`
- Contract/Task 템플릿과 정적 검사기

특정 호스트만 쓸 때:

```bash
npx @syjkim0125/ai-workflow-kit init --host codex
npx @syjkim0125/ai-workflow-kit init --host claude
```

## 사용

Coding agent에서 호스트의 native skill 호출 방식으로 시작합니다.

```text
Claude Code: /workflow 결제 시스템 만들고 싶어
Codex: $workflow 결제 시스템 만들고 싶어
```

ChatGPT Skills가 제공되는 계정/워크스페이스에서는 `skills/workflow/` 폴더를 Skill로 업로드한 뒤 관련 제품·개발 요청을 입력하면 `workflow`가 필요할 때 자동으로 선택될 수 있습니다. 플러그인으로 설치한 Claude Code에서는 namespaced command도 표시될 수 있습니다.

Workflow는 다음 순서를 지킵니다.

```text
요청 → 필요한 행동 질문 → Story Contract → 사람 승인(G1)
    → 위험도/크기 → plan/work/review → 사람 이해도 질문(G4) → 완료
```

### 사람이 읽는 Contract

하나의 Story만 요구사항 원본으로 관리합니다.

```text
Goal · Domain/Invariants · MUST · SHOULD · OUT · Decisions · Verify
```

AI에게 필요한 코드·테스트·plan context는 실행할 때 붙입니다. 별도의 “AI 요구사항 문서”를 만들지 않습니다.

### Task 규칙

Story가 한 PR로 리뷰되지 않을 때만 나눕니다. Task는 기본 30줄 이하이며 Story의 M/V ID만 참조합니다. 구현 HOW는 `ce-plan` 또는 저장소 기반 plan이 담당합니다.

### 마지막 G4

구현 후 AI가 먼저 정답을 설명하지 않습니다. diff와 증거만 보여준 뒤 담당자에게 behavior, invariant/failure path, 테스트가 증명한 범위와 남은 한계를 자기 말로 설명하게 합니다. 핵심 이해가 부족하면 보완 후 다시 답해야 완료됩니다.

## 선택적 Compound Engineering 연동

설치되어 있으면 `ce-plan → ce-work → ce-code-review`를 사용합니다. 없어도 같은 plan/work/review 단계를 호스트 기본 기능으로 수행합니다. 이 패키지는 Compound Engineering을 번들하지 않습니다.

## 검사와 제거

```bash
ai-workflow-kit doctor
ai-workflow-kit check story path/to/STORY.md
ai-workflow-kit check task path/to/TASK.md
ai-workflow-kit check gate G4 path/to/STORY.md
ai-workflow-kit remove
```

재설치는 idempotent합니다. 관리 marker 밖의 `AGENTS.md`/`CLAUDE.md` 내용과 사용자가 수정한 템플릿은 제거 시 보존합니다.

## 로컬 tarball 테스트

```bash
npm pack
npx --package ./syjkim0125-ai-workflow-kit-3.0.0.tgz ai-workflow-kit init
```

공개 배포는 scope 소유자의 npm 인증 후 다음 한 줄입니다.

```bash
npm publish --access public
```
