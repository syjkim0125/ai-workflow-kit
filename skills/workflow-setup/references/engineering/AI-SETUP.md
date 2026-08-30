# AI Tooling / Onboarding

This document covers the repository AI workflow. Keep third-party tooling minimal and verify current vendor/plugin instructions before changing installation state.

## 1. Prerequisites
- Git
- your supported coding-agent runtime (for example Claude Code or Codex)
- Compound Engineering installed in that runtime
- the `eli5` plugin is optional; `learning-gate` borrows its register but drives `ce-explain`, which ships with Compound Engineering

Superpowers may already be installed globally. **Do not uninstall or modify it.** For this repository it is explicit opt-in only: installation/discovery alone must not trigger its lifecycle skills.

## 2. ai-workflow-kit itself — installing this plugin

This document ships into every repository that adopts the kit, so if you are
reading it from inside such a repository, here is the path back to the kit:

```text
once per machine   /plugin marketplace add syjkim0125/ai-workflow-kit
                    /plugin install ai-workflow-kit

per repository      /workflow-setup

after an update     /plugin update  →  re-run /workflow-setup
```

The marketplace/install step is once per machine (or per Codex `CODEX_HOME`).
`/workflow-setup` runs once per repository — the plugin cannot write into a
target repo itself, so this skill writes the repo-local half described in
§4 below. See the kit's own `README-FIRST.md` for the full install and
migration story.

## 3. Compound Engineering — primary lifecycle

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

## 4. Repository workflow files
Skills (`story-breakdown`, `learning-gate`, `usage-handoff`, `workflow-setup`) ship from the plugin's own `skills/` directory and are read directly from there by both runtimes — nothing is copied into the target repository for them. `/workflow-setup` writes only the repo-local half a plugin cannot supply: the always-on rules block and the gate checker. After it runs, a target repository contains:

```text
<project-root>/
├── AGENTS.md                       # managed block added between markers
├── CLAUDE.md                       # managed block added between markers
├── .ai-workflow/
│   ├── bin/                        # gate checker + hook-invoked scripts
│   │   ├── check-understanding.sh
│   │   ├── enable-gate-hook.sh
│   │   ├── enable-hook.sh
│   │   ├── gate-guard.sh
│   │   └── usage-guard.sh
│   └── VERSION                     # installed kit version
├── docs/
│   ├── product/
│   │   └── PRD.md                  # project-specific; kept only if the project already has one
│   ├── understanding/              # understanding-gate artifacts
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

There is no repo-local, per-runtime skill-copy directory — the hand-copied Claude Code folder and its mirrored Codex counterpart belonged to the pre-plugin distribution and are gone. Content outside the `AGENTS.md`/`CLAUDE.md` markers, and everything under `docs/product/`, is never touched by the installer.

Create the project `README.md` for the actual repository. Do not rename the kit's `README-FIRST.md` into the project README.

## 5. Runtime routing
- Compound Engineering is the default lifecycle for this repository, for every runtime. The lifecycle policy lives in `AGENTS.md` ("Engineering lifecycle") so Claude Code and Codex receive the same instructions.
- `story-breakdown` is used only when an approved Story is too large for one reviewable PR. It ships from the plugin's single `skills/` directory, read by both runtimes; `/workflow-setup` installs the repo-local half (the always-on rules block and `.ai-workflow/bin/`) that the plugin cannot write itself.
- Do not invoke Superpowers lifecycle skills automatically. Use them only when the user explicitly requests Superpowers or names a specific Superpowers skill.
- Do not stack equivalent Superpowers and Compound lifecycle phases.
- Use direct work for tiny reversible changes; use `/ce-plan` when planning adds decision value; add an explicit human plan checkpoint for high-risk changes.
- `learning-gate` runs at the understanding gates (G1 before Acceptance approval, G4 before merge, G3/G5 conditionally). The checker is installed into this repository at `.ai-workflow/bin/` by `/workflow-setup`, so it runs without the plugin — CI and teammates who have not installed it can still verify a gate.

## 6. Durable learning
`/ce-compound` is not an automatic post-task ritual. After verified work, persist only a non-obvious, evidence-backed repo-local lesson that future work would otherwise have to rediscover, and ask before writing it.

## 7. Optional V2
Second Brain / Obsidian, extra retrieval infrastructure, RTK, and additional MCP/vector/graph layers are optional later additions. Adopt them only after a concrete recurring pain appears.
