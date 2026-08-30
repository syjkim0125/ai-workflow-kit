#!/usr/bin/env bash
# PreToolUse warning for the G4 understanding gate. Claude Code only, opt-in.
#
# Warns; never blocks. The hook cannot know where the canonical contract lives,
# so its judgment is approximate. A blocking hook that misfires gets switched
# off, and a switched-off hook enforces nothing. A warning survives.
#
# Env:
#   GATE_GUARD_CONTRACT  path (repo-relative or absolute) to the canonical contract

set -uo pipefail

CONTRACT="${GATE_GUARD_CONTRACT:-}"
[ -n "$CONTRACT" ] || exit 0

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="$PWD"
case "$CONTRACT" in /*) ABS="$CONTRACT" ;; *) ABS="$ROOT/$CONTRACT" ;; esac
[ -r "$ABS" ] || exit 0

# check-understanding.sh always ships as this script's sibling under the same
# scripts/ directory, in every repo that absorbs the kit and in a user-level
# skill install alike. Resolve it relative to this script's own location, not
# $ROOT: $ROOT is the git toplevel of wherever cwd happens to be, which is
# wrong inside a worktree, wrong when cwd sits in an unrelated repo, and wrong
# for a user-level install. A miss here means the guard exits silently with no
# warning at all — the worst outcome for a hook whose only job is to warn — so
# do not "simplify" this back to an $ROOT-relative path.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CHECKER="$SCRIPT_DIR/check-understanding.sh"
[ -x "$CHECKER" ] || [ -r "$CHECKER" ] || exit 0

if ! bash "$CHECKER" --gate G4 --contract "$ABS" --repo-root "$ROOT" >/dev/null 2>&1; then
  printf '[learning-gate] G4 understanding gate is not recorded in %s\n' "$CONTRACT" >&2
  printf '[learning-gate] run: learning-gate diff   (or record: Understanding gate (G4): N/A — <reason>)\n' >&2
fi

exit 0
