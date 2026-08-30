---
name: usage-handoff
description: Use when subscription usage crosses its threshold mid-work (a usage-guard hook injects a [usage-guard] notice), or when the user asks to hand work off to another AI, write a handoff document, or wrap up before hitting a rate limit — captures current state into hand-off/HANDOFF-<TASK-KEY>-hhmmss.md.
---

# Usage Handoff

## Overview

When the quota is about to run out, the work-in-progress state lives only in this
conversation: which approach was abandoned and why, what is committed versus dirty,
what the next concrete step is. A handoff document moves that state onto disk so
another agent — or the same one after a reset — resumes without re-deriving it.

The document is written for two readers at once: the receiving agent, and the human
who has to trust it. Both language sections carry the same content.

## When to Use

- A `[usage-guard]` notice appeared in context (usage ≥ threshold).
- The user says work should move to another AI, or asks for a handoff/wrap-up.
- Approaching a long compaction or the end of a session with work unfinished.

**Not for** routine progress summaries — a handoff records transferable state, not
what happened this turn.

## Where This Skill Lives

Two layouts, same scripts. Resolve in this order:

```bash
# 1. Repository copy (shared with the team, works for every runtime)
SKILL="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/skills/usage-handoff"
# 2. Personal copy (repos that have not adopted it)
[ -d "$SKILL" ] || SKILL="$HOME/.claude/skills/usage-handoff"
```

Codex reads `.agents/skills/usage-handoff/SKILL.md`, a mirror of this file.
`new-handoff.sh`, `usage.py`, and `usage-refresh.py` stay under this skill's own
`scripts/` directory, so running them requires the skill (or its Codex mirror) to
be present. `enable-hook.sh` and the hook it installs (`usage-guard.sh`) are
installed into this repository at `.ai-workflow/bin/` by `/workflow-setup`, so the
warning hook fires without the plugin.

## Procedure

1. **Finish the current step first.** Do not interrupt an edit mid-file or leave a
   test half-written. A document describing a broken intermediate state is worse
   than no document. The threshold is a warning, not a stop signal.
2. **Create the skeleton:**
   ```bash
   bash "$SKILL/scripts/new-handoff.sh"
   ```
   It prints the path and prefills branch, HEAD, base ref, commits, dirty files,
   and the usage snapshot. It also adds `hand-off/` to `.git/info/exclude`, so the
   repo's tracked `.gitignore` is untouched.
3. **Fill the judgment sections** — the parts no script can know:
   - **진행 상태 / Progress:** status per Done-when ID, each with evidence
     (`tests 12/12 pass`, not `tests pass`).
   - **시도했으나 버린 접근 / Abandoned approaches:** with the reason. This is the
     highest-value section — it is what stops the recipient repeating your dead ends.
   - **다음 한 걸음 / Next single step:** one concrete action, startable immediately.
   - **검증 방법 / How to verify:** exact commands and expected output.
4. **Fill the JIRA-TASK skeleton** below the state block with current facts. Leave
   `N/A — reason` where a section does not apply. Never fill it by guessing.
5. **Report the path to the user** and say what remains. Then continue working
   within the remaining quota unless told otherwise.

## Both Languages, Same Content

The template is Korean-authored with an English mirror. Keep the same IDs and order
in both sections. Do not let one side drift into a summary of the other — a recipient
reading only English must get everything a recipient reading only Korean gets.

## Quick Reference

| Question | Answer |
|---|---|
| Where does it go? | `<repo-root>/hand-off/HANDOFF-<TASK-KEY>-hhmmss.md` |
| Which repo root? | `git rev-parse --show-toplevel`, else cwd |
| Where does TASK-KEY come from? | Branch: `task/<KEY>-<slug>` or `story/<KEY>-<slug>`; else any `KEY-123` in the branch; else `NO-TICKET` |
| Which template? | `<repo>/templates/JIRA-TASK.md` if present, else the copy beside this skill |
| Committed to the repo? | No — ignored via `.git/info/exclude` |
| Does an existing file get overwritten? | Never; a numeric suffix is added |

## Checking Usage Manually

```bash
python3 "$SKILL/scripts/usage.py"          # formatted report
python3 "$SKILL/scripts/usage.py" --json   # raw endpoint response
```

Reads the OAuth token from the macOS Keychain (`Claude Code-credentials`) or
`~/.claude/.credentials.json`, and queries `https://api.anthropic.com/api/oauth/usage`
— the same endpoint `/usage` uses. `percent` is **consumed**, not remaining. Never
print the token.

## Enabling the Automatic Warning (per person, opt-in)

The hook is personal — it reads *your* quota with *your* credentials — so it is not
committed, and nothing enables it for you.

```bash
bash .ai-workflow/bin/enable-hook.sh                  # both runtimes, 90%
bash .ai-workflow/bin/enable-hook.sh --threshold 80   # warn earlier
bash .ai-workflow/bin/enable-hook.sh --codex          # one runtime only
```

It merges into `.claude/settings.local.json` (Claude Code) and `.codex/hooks.json`
(Codex), keeping whatever those files already hold, and adds `.codex/hooks.json` to
`.git/info/exclude` so personal paths never reach a commit. Re-running with a
different threshold updates the entry instead of stacking a second one. Codex asks
you to trust a new hook once — run `/hooks` there to approve it.

**What the setting is:** the threshold percent, and nothing else. `90` means warn
when the highest of the three limit windows (5-hour, weekly all-models, weekly
per-model) reaches 90% consumed. Lower it for more room to hand off; raise it to be
interrupted less. Below the threshold the hook prints nothing and costs no tokens.

### Offer It When It Is Off

If the user has not enabled it, offer once — the person who most needs the warning is
the one who does not have it yet. Check for a `usage-guard` entry in
`.claude/settings.local.json` and `.codex/hooks.json`; if absent, the first time the
user raises usage, rate limits, or handing work off, ask whether to enable it and at
which threshold, then run the installer. If they decline, do not raise it again in
that session.

## Common Mistakes

- **Writing it and stopping work.** The threshold warns; it does not halt. Continue
  unless the user says otherwise.
- **Vague evidence.** "tests pass" is unverifiable. Give counts and commands.
- **Omitting dead ends.** Without them the recipient burns the quota you were trying
  to save.
- **Guessing at the JIRA-TASK sections.** `N/A — reason` beats invented content.
- **Editing one runtime's SKILL.md only.** `.claude/` and `.agents/` copies are
  mirrors; change both.
- **Making the hook print on the quiet path.** Non-JSON stdout from a hook can be
  injected into context; silence must be exactly zero bytes.
