# AI Tooling / Onboarding

This document covers the repository AI workflow. Keep third-party tooling minimal and verify current vendor/plugin instructions before changing installation state.

## 1. Prerequisites
- Git
- your supported coding-agent runtime (for example Claude Code or Codex)
- Compound Engineering installed in that runtime
- the `eli5` plugin is optional; `learning-gate` borrows its register but drives `ce-explain`, which ships with Compound Engineering

Superpowers may already be installed globally. **Do not uninstall or modify it.** For this repository it is explicit opt-in only: installation/discovery alone must not trigger its lifecycle skills.

## 2. Compound Engineering — primary lifecycle

Official source: <https://github.com/EveryInc/compound-engineering-plugin>. Upstream install instructions can change, so verify that README when installing/updating.

Claude Code currently uses:
```text
/plugin marketplace add EveryInc/compound-engineering-plugin
/plugin install compound-engineering
```

Codex CLI currently uses:
```bash
codex plugin marketplace add EveryInc/compound-engineering-plugin
codex plugin add compound-engineering@compound-engineering-plugin
```

Codex notes:
- For non-default profiles, run both Codex commands with a matching `CODEX_HOME` environment variable.
- Codex App users can add the marketplace via custom marketplace configuration in the UI.
- If Compound Engineering was previously installed with the legacy convert/`install --to codex` path, check the upstream README's cleanup instructions for obsolete managed blocks in global Codex instructions files.

After installation, run the runtime-appropriate Compound setup (`/ce-setup` on slash-command hosts) in the project when needed.

## 3. Repository workflow files
The project should absorb the kit rather than nest the whole distribution bundle:

```text
<project-root>/
├── AGENTS.md
├── CLAUDE.md
├── .claude/
│   └── skills/
│       ├── story-breakdown/    # Claude Code copy
│       │   ├── SKILL.md
│       │   └── EVALS.md        # optional validation material
│       ├── learning-gate/      # Claude Code copy; scripts live here for both runtimes
│       │   ├── SKILL.md
│       │   ├── EVALS.md
│       │   ├── scripts/
│       │   └── tests/
│       └── usage-handoff/      # Claude Code copy; scripts live here for both runtimes
│           ├── SKILL.md
│           ├── scripts/
│           ├── templates/
│           └── tests/
├── .agents/
│   └── skills/
│       ├── story-breakdown/    # Codex copy — keep in sync with .claude copy
│       │   ├── SKILL.md
│       │   └── EVALS.md
│       ├── learning-gate/      # Codex copy — SKILL.md and EVALS.md mirrored; no scripts
│       │   ├── SKILL.md
│       │   └── EVALS.md
│       └── usage-handoff/      # Codex copy — SKILL.md mirrored; no scripts
│           └── SKILL.md
├── docs/
│   ├── product/
│   │   └── PRD.md              # project-specific canonical/snapshot PRD
│   ├── understanding/          # understanding-gate artifacts
│   └── engineering/
│       ├── AI-WORKFLOW.md
│       ├── AI-SETUP.md
│       └── AI-WORKFLOW-SOURCES.md
└── templates/
    ├── PRD.md
    ├── ACCEPTANCE.md
    ├── UNDERSTANDING.md
    ├── JIRA-STORY.md
    └── JIRA-TASK.md
```

Create the project `README.md` for the actual repository. Do not rename the kit's `README-FIRST.md` into the project README.

## 4. Runtime routing
- Compound Engineering is the default lifecycle for this repository, for every runtime. The lifecycle policy lives in `AGENTS.md` ("Engineering lifecycle") so Claude Code and Codex receive the same instructions.
- `story-breakdown` is used only when an approved Story is too large for one reviewable PR. It ships in two mirrored locations — `.claude/skills/` (Claude Code) and `.agents/skills/` (Codex) — edit both together, or symlink one to the other when the project's platforms allow it.
- Do not invoke Superpowers lifecycle skills automatically. Use them only when the user explicitly requests Superpowers or names a specific Superpowers skill.
- Do not stack equivalent Superpowers and Compound lifecycle phases.
- Use direct work for tiny reversible changes; use `/ce-plan` when planning adds decision value; add an explicit human plan checkpoint for high-risk changes.
- `learning-gate` runs at the understanding gates (G1 before Acceptance approval, G4 before merge, G3/G5 conditionally). The checker is installed into this repository at `.ai-workflow/bin/` by `/workflow-setup`, so it runs without the plugin — CI and teammates who have not installed it can still verify a gate.

## 5. Durable learning
`/ce-compound` is not an automatic post-task ritual. After verified work, persist only a non-obvious, evidence-backed repo-local lesson that future work would otherwise have to rediscover, and ask before writing it.

## 6. Optional V2
Second Brain / Obsidian, extra retrieval infrastructure, RTK, and additional MCP/vector/graph layers are optional later additions. Adopt them only after a concrete recurring pain appears.
