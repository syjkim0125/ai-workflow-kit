#!/usr/bin/env bash
# Per-person opt-in installer for the understanding-gate warning hook.
# Claude Code only. Not committed — it points at personal paths.
#
# Usage: enable-gate-hook.sh [--contract <path>]

set -uo pipefail

CONTRACT="docs/product/PRD.md"
while [ $# -gt 0 ]; do
  case "$1" in
    --contract) CONTRACT="${2-}"; shift 2 ;;
    -h|--help)  sed -n '2,8p' "$0"; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

command -v jq >/dev/null 2>&1 || { printf 'jq is required\n' >&2; exit 2; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="$PWD"
SET="$ROOT/.claude/settings.local.json"
mkdir -p "$ROOT/.claude"
[ -f "$SET" ] || printf '{}\n' > "$SET"
jq -e . "$SET" >/dev/null 2>&1 || { printf 'not valid JSON: %s\n' "$SET" >&2; exit 2; }

# $CLAUDE_PROJECT_DIR is preferred (Claude Code sets it at hook-fire time) but
# not load-bearing: if it is ever unset or empty when the hook runs, the path
# below would resolve to a bare "/.claude/..." and the guard would fail to
# find itself — silently, since it's Bash's own "no such file" on a hook
# invocation nothing surfaces. $ROOT, the absolute repo root known right now
# at install time, is baked in as the fallback so there is no single point of
# failure on that variable being populated correctly later.
CMD="GATE_GUARD_CONTRACT=$CONTRACT bash \"\${CLAUDE_PROJECT_DIR:-$ROOT}/.claude/skills/learning-gate/scripts/gate-guard.sh\""

TMPF="$(mktemp)"; trap 'rm -f "$TMPF"' EXIT
jq --arg cmd "$CMD" '
  .hooks //= {} |
  .hooks.PreToolUse //= [] |
  # drop any prior gate-guard entry, then add exactly one
  .hooks.PreToolUse = (
    [ .hooks.PreToolUse[]
      | .hooks = [ (.hooks // [])[] | select((.command // "") | test("gate-guard") | not) ]
    ] | map(select((.hooks | length) > 0))
  ) |
  .hooks.PreToolUse += [{
    matcher: "Bash",
    hooks: [{ type: "command", command: $cmd }]
  }]
' "$SET" > "$TMPF" && mv "$TMPF" "$SET"

# personal file; keep it out of the index
EX="$ROOT/.git/info/exclude"
[ -d "$ROOT/.git/info" ] && ! grep -qxF '.claude/settings.local.json' "$EX" 2>/dev/null \
  && printf '.claude/settings.local.json\n' >> "$EX"

printf 'installed: PreToolUse gate-guard, contract=%s\n' "$CONTRACT"
printf 'file: %s\n' "$SET"
