#!/usr/bin/env bash
# Verify that a learning-gate record line exists and is well formed.
#
# Runtime-neutral: Claude Code, Codex, CI, or a human can all run this.
# The Claude-only hook in this skill is a thin opt-in wrapper around it.
#
# Usage:
#   check-understanding.sh --gate G1|G3|G4|G5 --contract <path> [--repo-root <path>]
#
# Exit codes:
#   0  record line present and valid (artifact exists, or N/A with a reason)
#   1  no record line for that gate
#   2  record line present but malformed
#   3  record line valid but the artifact file it points at is missing
#   4  usage error (bad gate id, unreadable contract)

set -uo pipefail

GATE=""; CONTRACT=""; REPO_ROOT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --gate)      GATE="${2-}"; shift 2 ;;
    --contract)  CONTRACT="${2-}"; shift 2 ;;
    --repo-root) REPO_ROOT="${2-}"; shift 2 ;;
    -h|--help)   sed -n '2,20p' "$0"; exit 0 ;;
    *)           printf 'unknown argument: %s\n' "$1" >&2; exit 4 ;;
  esac
done

case "$GATE" in
  G1|G3|G4|G5) ;;
  *) printf 'invalid gate id: %s (expected G1, G3, G4, or G5)\n' "${GATE:-<empty>}" >&2; exit 4 ;;
esac

[ -n "$CONTRACT" ] && [ -r "$CONTRACT" ] || {
  printf 'contract not readable: %s\n' "${CONTRACT:-<empty>}" >&2; exit 4; }

if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || REPO_ROOT="$PWD"
fi

PREFIX="Understanding gate ($GATE):"

# All lines claiming this gate, however malformed.
LINES="$(grep -F "$PREFIX" "$CONTRACT" 2>/dev/null)"
[ -n "$LINES" ] || {
  printf 'no record line for %s in %s\n' "$GATE" "$CONTRACT" >&2; exit 1; }

VALID_FULL='^Understanding gate \(G[1345]\): [^ ]+\.html · [0-9]{4}-[0-9]{2}-[0-9]{2} · Check-in: (accepted|declined)$'
VALID_NA='^Understanding gate \(G[1345]\): N/A — .*[^[:space:]].*$'

matched=""
while IFS= read -r line; do
  [ -n "$line" ] || continue
  trimmed="${line#"${line%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
  if printf '%s' "$trimmed" | grep -qE "$VALID_NA"; then
    matched="na"; break
  fi
  if printf '%s' "$trimmed" | grep -qE "$VALID_FULL"; then
    matched="$trimmed"; break
  fi
done <<EOF
$LINES
EOF

[ -n "$matched" ] || {
  printf 'malformed record line for %s in %s\n' "$GATE" "$CONTRACT" >&2
  printf 'expected one of:\n  %s <path>.html · YYYY-MM-DD · Check-in: accepted|declined\n  %s N/A — <reason>\n' \
    "$PREFIX" "$PREFIX" >&2
  exit 2; }

[ "$matched" != "na" ] || { printf '%s recorded as N/A\n' "$GATE"; exit 0; }

# Second field is the artifact path.
ARTIFACT="$(printf '%s' "$matched" | sed -E 's/^Understanding gate \(G[1345]\): ([^ ]+\.html) · .*$/\1/')"
case "$ARTIFACT" in
  /*) ABS="$ARTIFACT" ;;
  *)  ABS="$REPO_ROOT/$ARTIFACT" ;;
esac

[ -f "$ABS" ] || {
  printf 'artifact missing for %s: %s\n' "$GATE" "$ABS" >&2; exit 3; }

printf '%s ok: %s\n' "$GATE" "$ARTIFACT"
exit 0
