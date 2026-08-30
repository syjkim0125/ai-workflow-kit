# AI Workflow Kit v2.6 — Start Here

Updated: 2026-08-28

This kit ships as a Claude Code / Codex plugin. It is no longer absorbed by hand-copying files out of this repository.

## 1) Install

```text
한 번만    /plugin marketplace add syjkim0125/ai-workflow-kit
           /plugin install ai-workflow-kit

레포마다   /workflow-setup

업데이트   /plugin update  →  /workflow-setup 다시 실행
```

The plugin marketplace/install step is once per machine (or per Codex `CODEX_HOME`). `/workflow-setup` runs once per repository — the plugin cannot write into a target repo itself, so this skill writes the repo-local half.

## 2) What `/workflow-setup` writes — and does not

Exactly five things:

1. A managed block in `AGENTS.md` and `CLAUDE.md`
2. `.ai-workflow/bin/` — the gate checker and the hook-invoked scripts
3. `.ai-workflow/VERSION` — the installed kit version
4. `templates/*.md` and `docs/engineering/*.md`
5. `docs/understanding/.gitkeep`

It shows the diff and asks before writing anything. It never touches:

- content outside the `<!-- BEGIN ai-workflow-kit -->` / `<!-- END ai-workflow-kit -->` markers in `AGENTS.md`/`CLAUDE.md` — your project's own conventions live there undisturbed;
- your own files — `docs/product/PRD.md`, application code, project-specific docs. Those are yours; the kit only supplies the templates that can seed them.

To remove the kit's footprint, run the same skill with `--remove`: it strips the managed block and deletes `.ai-workflow/`, and leaves `templates/`, `docs/engineering/`, and `docs/understanding/` in place, since those may carry your own work by then.

## 3) Already absorbed the old way?

Earlier versions of this kit were absorbed by hand: files copied into `.claude/skills/` and mirrored into `.agents/skills/`. That model is gone — skills now ship from the plugin's own `skills/` directory, read by both runtimes, and the mirror is not maintained anywhere.

To move a repo that still has the old layout onto the plugin model:

1. Install the plugin and run `/workflow-setup` as above. It adds the managed block to `AGENTS.md`/`CLAUDE.md` and the other four items, without touching anything else in the repo.
2. By hand, delete the old copies that are no longer read by anything: `.claude/skills/{learning-gate,story-breakdown,usage-handoff}/` and any `.agents/skills/` mirror of the same. `/workflow-setup` does not delete these for you — it only writes the five items above.

## 4) Runtime choices

- **Primary engineering lifecycle:** Compound Engineering — declared in the `AGENTS.md` managed block ("Engineering lifecycle") so Claude Code and Codex receive the same routing.
- **Globally installed Superpowers:** keep it installed, but treat it as **explicit opt-in only**; installation/discovery alone must not trigger Superpowers lifecycle skills.
- **`story-breakdown`:** only when an approved Story is too large to be one reviewable PR. It ships from the plugin's `skills/` directory — no repo-local copy needed.
- **Understanding gates:** `learning-gate` runs before Acceptance approval (G1) and before merge (G4). The checker lives at `.ai-workflow/bin/check-understanding.sh`, installed by `/workflow-setup`, so a teammate or CI job without the plugin can still run it.

## 5) Repository knowledge routing

The managed block in `AGENTS.md` points at this index:

```text
Product intent and scope      → docs/product/PRD.md (when present)
Team AI development workflow  → docs/engineering/AI-WORKFLOW.md
AI tooling/onboarding         → docs/engineering/AI-SETUP.md
Requirement templates         → templates/
Understanding gate contract   → templates/UNDERSTANDING.md
Understanding gate artifacts  → docs/understanding/ when present
Durable solved problems       → docs/solutions/ when present
```

Keep these paths accurate in the target repository. Do not duplicate the full contents of those documents into `AGENTS.md`.

## 6) `oliveyoung-test/`

`oliveyoung-test/SKILL.md` is a standalone coding-test assessment skill, unrelated to this plugin distribution — it does not ship as part of the `ai-workflow-kit` plugin and installing/updating the plugin does not touch it.
