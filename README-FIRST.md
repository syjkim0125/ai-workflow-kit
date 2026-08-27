# AI Workflow Kit v2.4 — Start Here

Updated: 2026-08-11

Do **not** copy the whole `ai-workflow-kit/` directory into a project. It is a distribution bundle with separate test and real-work setups.

## 1) Olive Young coding test

Use only:

```text
oliveyoung-test/SKILL.md
```

`PREP-CHECKLIST.md` and `PRACTICE-EVALS.md` are rehearsal material, not exam artifacts.

If Superpowers is installed globally, **do not uninstall it just for the test**. Explicitly invoke the coding-test skill as the primary assessment workflow and do not stack unrelated lifecycle steps unless deliberately requested.

## 2) Real work — V1

Absorb the following into the repository instead of nesting `ai-workflow-kit/`:

```text
<project-root>/
├── AGENTS.md
├── CLAUDE.md
├── .claude/
│   └── skills/
│       └── story-breakdown/      # Claude Code copy
│           ├── SKILL.md
│           └── EVALS.md          # optional validation material
├── .agents/
│   └── skills/
│       └── story-breakdown/      # Codex copy — keep in sync with .claude copy
│           ├── SKILL.md
│           └── EVALS.md
├── docs/
│   ├── product/
│   │   └── PRD.md                # project-specific PRD; not supplied by the generic kit
│   └── engineering/
│       ├── AI-WORKFLOW.md
│       ├── AI-SETUP.md
│       └── AI-WORKFLOW-SOURCES.md
└── templates/
    ├── PRD.md
    ├── ACCEPTANCE.md
    ├── JIRA-STORY.md
    └── JIRA-TASK.md
```

`README.md` belongs to the actual project and should be written for that repository. `README-FIRST.md` is only the kit distribution guide.

### Runtime choices
- **Primary engineering lifecycle:** Compound Engineering — declared in `AGENTS.md` ("Engineering lifecycle") so Claude Code and Codex receive the same routing.
- **Globally installed Superpowers:** keep it installed, but treat it as **explicit opt-in only**; installation/discovery alone must not trigger Superpowers lifecycle skills.
- **Custom Skill:** `story-breakdown` only when an approved Story is too large to be one reviewable PR.
- **Second Brain / Obsidian:** optional V2, not required to start.
- **Extra MCP / RTK / vector/graph infrastructure:** add only after a concrete pain appears.

## 3) Repository knowledge routing
The supplied `AGENTS.md` contains the expected retrieval index:

```text
Product intent and scope      → docs/product/PRD.md (when present)
Team AI development workflow  → docs/engineering/AI-WORKFLOW.md
AI tooling/onboarding         → docs/engineering/AI-SETUP.md
Requirement templates         → templates/
Durable solved problems       → docs/solutions/ when present
```

Keep these paths accurate in the target repository. Do not duplicate the full contents of those documents into `AGENTS.md`.

## 4) Existing repositories
Normally, merge `AGENTS.md` / `CLAUDE.md` with existing project-specific conventions rather than overwriting them. If a project is intentionally being reset on a new branch while preserving Git history, replacing obsolete experimental instructions is reasonable after review.

## 5) Recommended first run
1. Put the project PRD at `docs/product/PRD.md` if the repo will keep a PRD snapshot/canonical copy.
2. Add the real-work workflow files and templates.
3. Install/enable Compound Engineering and use one pilot Story/Issue.
4. If the Story is already PR-sized, skip breakdown; otherwise invoke `story-breakdown`.
5. Right-size execution by risk: direct work for tiny reversible changes, `/ce-plan` for normal multi-step work, explicit human plan checkpoint for high-risk changes.
6. Verify with fresh executable evidence before claiming completion.
7. Run `/ce-compound` only when verified work produced a durable repo-local learning; ask before persisting it.

See `real-work/docs/engineering/AI-WORKFLOW.md` and `real-work/docs/engineering/AI-SETUP.md`.
