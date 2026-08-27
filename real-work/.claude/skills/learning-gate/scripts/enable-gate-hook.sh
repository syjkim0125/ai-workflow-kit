#!/usr/bin/env bash
# Per-person opt-in installer for the understanding-gate warning hook.
# Claude Code only. Not committed — it points at personal paths.
#
# Usage: enable-gate-hook.sh [--contract <path>]

set -uo pipefail

CONTRACT="docs/product/PRD.md"
while [ $# -gt 0 ]; do
  case "$1" in
    --contract)
      # Bash 3.2's `shift 2` silently no-ops (and returns nonzero) when only
      # one argument remains, which would otherwise leave $1 unchanged and
      # spin this loop forever. Require a value before consuming one.
      [ $# -ge 2 ] || { printf 'missing value for %s\n' "$1" >&2; exit 2; }
      CONTRACT="$2"; shift 2 ;;
    -h|--help)  sed -n '2,8p' "$0"; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

# An explicit but empty --contract would install a hook whose
# GATE_GUARD_CONTRACT is empty; gate-guard.sh then exits 0 unconditionally
# (its own empty-check), so the hook would run on every Bash call and warn
# about nothing, forever. Refuse rather than install a silent no-op.
[ -n "$CONTRACT" ] || { printf 'refusing to install: --contract must not be empty\n' >&2; exit 2; }

command -v jq >/dev/null 2>&1 || { printf 'jq is required\n' >&2; exit 2; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="$PWD"

# $ROOT and $CONTRACT both get interpolated below as literal shell text inside
# a double-quoted CMD word, not through jq's argument escaping. A literal "
# would close that quoting early and hand the hook a shell syntax error on
# every single Bash call; a $ or a backtick would be re-expanded when the
# hook itself runs. Rather than add quoting machinery to handle a path nobody
# has, refuse to install and say why, at the one moment a human is watching —
# a hook that errors on every Bash call is a hook that gets switched off, and
# a switched-off hook enforces nothing. Reject before touching the settings
# file at all.
reject_if_unsafe() {
  local label="$1" value="$2"
  case "$value" in
    *'"'*) printf 'refusing to install: %s contains a double quote (unsafe to embed): %s\n' "$label" "$value" >&2; exit 2 ;;
    *'$'*) printf 'refusing to install: %s contains a $ (unsafe to embed): %s\n'            "$label" "$value" >&2; exit 2 ;;
    *'`'*) printf 'refusing to install: %s contains a backtick (unsafe to embed): %s\n'     "$label" "$value" >&2; exit 2 ;;
  esac
}
reject_if_unsafe "repo root"    "$ROOT"
reject_if_unsafe "contract path" "$CONTRACT"

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
