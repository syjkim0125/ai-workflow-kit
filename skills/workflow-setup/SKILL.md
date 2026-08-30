---
name: workflow-setup
description: Install, update, or remove the ai-workflow-kit footprint in this repository — the always-on rules block, the gate checker and hook scripts, the requirement templates, and the gate artifact directory. Use when the user types /workflow-setup, or after updating the plugin.
disable-model-invocation: true
---

# Workflow Setup

A plugin cannot write into a target repository, but the kit's enforcement lives
in files that must be there: the rules an agent reads at the repo root, the gate
artifacts, and a checker that CI or a teammate without the plugin can still run.
This skill puts them there and keeps them current.

## What it writes

Exactly five things, and nothing else:

1. A managed block in `AGENTS.md` and `CLAUDE.md`
2. `.ai-workflow/bin/` — the gate checker and the hook-invoked scripts
3. `.ai-workflow/VERSION` — the installed kit version
4. `templates/*.md` and `docs/engineering/*.md`
5. `docs/understanding/.gitkeep`

The managed block is delimited by markers. Content outside them is never
touched. If a file's markers are unbalanced the installer refuses and writes
nothing rather than guessing.

## Run it

Set `SKILL_DIR` to the absolute directory you loaded this SKILL.md from — the
Bash tool's working directory is the user's project, not the skill directory, so
a bare relative path will not resolve.

Always preview first:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
bash "$SKILL_DIR/scripts/workflow-install.sh" \
  --references "$SKILL_DIR/references" --dry-run
```

Show the user the diff. Ask for approval with the platform's blocking question
tool (`AskUserQuestion` in Claude Code; call `ToolSearch` with
`select:AskUserQuestion` first if its schema is not loaded). Never write without
an explicit yes.

On approval, drop `--dry-run`. Report the exit code.

To remove: add `--remove`. It strips the block and `.ai-workflow/`, and leaves
`templates/`, `docs/engineering/`, and `docs/understanding/` in place — those may
carry the user's own work.

## After a plugin update

`/plugin update` refreshes the skills; it cannot refresh what lives in the repo.
Re-run this skill. Compare `.ai-workflow/VERSION` against the plugin version and
tell the user when they differ.

## Boundaries

- Never edit outside the markers.
- Never write without showing the diff and getting a yes.
- Do not add the block to a file the user did not agree to touch.
- This skill installs; it does not run gates. That is `learning-gate`.
