#!/usr/bin/env bash
# Tests for usage-guard.sh — the PostToolUse hook that watches subscription usage.
#
# Contract under test:
#   1. Below threshold           -> ZERO bytes on stdout, exit 0
#   2. At/above, no marker yet   -> hookSpecificOutput.additionalContext, marker written
#   3. Same window, second call  -> silent (fires once per window)
#   4. New window (new resets_at)-> fires again
#   5. Missing/corrupt cache     -> silent, exit 0 (never blocks work)
#
# Silence matters beyond tidiness: non-JSON stdout from a hook can be injected
# into Claude's context, so the quiet path must emit nothing at all.

set -uo pipefail

# Resolve the script under test relative to this test file, so the suite runs
# both from ~/.claude and from a repository copy.
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
_find() {  # $1 = basename
  for c in "$TEST_DIR/../../workflow-setup/references/bin/$1" "$TEST_DIR/../$1" "$HOME/.claude/hooks/$1" \
           "$HOME/.claude/skills/usage-handoff/scripts/$1"; do
    [ -f "$c" ] && { printf '%s\n' "$c"; return 0; }
  done
  printf '%s\n' "$1"
}
GUARD="$(_find usage-guard.sh)"
# Guard against silently falling back to a stale copy outside this repo (e.g.
# ~/.claude/hooks/usage-guard.sh) when the intended candidate above is
# missing — that would pass this suite against the wrong script instead of
# failing loudly.
REPO_ROOT="$(cd "$TEST_DIR" && git rev-parse --show-toplevel 2>/dev/null)"
in_repo() { case "$1" in "$REPO_ROOT"/*) return 0 ;; *) return 1 ;; esac; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    pass=$((pass + 1)); printf '  PASS  %s\n' "$name"
  else
    fail=$((fail + 1))
    printf '  FAIL  %s\n        expected: %s\n        actual:   %s\n' "$name" "$expected" "$actual"
  fi
}

write_cache() {  # $1=percent  $2=resets_at
  cat > "$TMP/cache.json" <<JSON
{
  "fetched_at": $(date +%s),
  "max_percent": $1,
  "worst": {
    "kind": "weekly_scoped",
    "label": "Weekly (scoped): Fable",
    "percent": $1,
    "resets_at": "$2"
  }
}
JSON
}

run_guard() {  # stdin JSON -> stdout; env-isolated
  printf '{"session_id":"test-session","hook_event_name":"PostToolUse","tool_name":"Bash"}' \
  | USAGE_GUARD_CACHE="$TMP/cache.json" \
    USAGE_GUARD_MARKER_DIR="$TMP/markers" \
    USAGE_GUARD_THRESHOLD=90 \
    USAGE_GUARD_NO_REFRESH=1 \
    bash "$GUARD"
}

echo "test-usage-guard"

if [ ! -x "$GUARD" ] && [ ! -f "$GUARD" ]; then
  echo "  FAIL  guard script does not exist at $GUARD"
  echo "0/5 passed"
  exit 1
fi

check "script resolves inside this repo (not a stale \$HOME copy)" "yes" \
  "$(in_repo "$GUARD" && printf yes || printf no)"

# 1. Below threshold -> absolute silence
write_cache 74.0 "2026-08-20T14:59:59+00:00"
out="$(run_guard)"; rc=$?
check "below threshold: no stdout" "" "$out"
check "below threshold: exit 0" "0" "$rc"

# 2. At/above threshold, first time -> injects context
write_cache 91.0 "2026-08-20T14:59:59+00:00"
out="$(run_guard)"
got_ctx="$(printf '%s' "$out" | jq -r '.hookSpecificOutput.additionalContext // empty' 2>/dev/null)"
if [ -n "$got_ctx" ]; then check "threshold: injects additionalContext" "yes" "yes"
else check "threshold: injects additionalContext" "yes" "no (stdout=$out)"; fi
check "threshold: names the skill to invoke" "yes" \
  "$(printf '%s' "$got_ctx" | grep -q 'usage-handoff' && echo yes || echo no)"
check "threshold: reports the percent" "yes" \
  "$(printf '%s' "$got_ctx" | grep -q '91' && echo yes || echo no)"
check "threshold: names the window" "yes" \
  "$(printf '%s' "$got_ctx" | grep -q 'Weekly (scoped): Fable' && echo yes || echo no)"
check "threshold: hookEventName is PostToolUse" "PostToolUse" \
  "$(printf '%s' "$out" | jq -r '.hookSpecificOutput.hookEventName // empty' 2>/dev/null)"

# 3. Same window again -> silent (no nagging every tool call)
out2="$(run_guard)"
check "same window: silent on second call" "" "$out2"

# 4. New window -> fires again
write_cache 93.0 "2026-08-27T14:59:59+00:00"
out3="$(run_guard)"
got3="$(printf '%s' "$out3" | jq -r '.hookSpecificOutput.additionalContext // empty' 2>/dev/null)"
check "new window: fires again" "yes" "$([ -n "$got3" ] && echo yes || echo no)"

# 5. Missing cache -> silent, exit 0
rm -f "$TMP/cache.json"
out4="$(run_guard)"; rc4=$?
check "missing cache: no stdout" "" "$out4"
check "missing cache: exit 0" "0" "$rc4"

# 6. Corrupt cache -> silent, exit 0
printf 'not json at all' > "$TMP/cache.json"
out5="$(run_guard)"; rc5=$?
check "corrupt cache: no stdout" "" "$out5"
check "corrupt cache: exit 0" "0" "$rc5"

echo "$pass/$((pass + fail)) passed"
[ "$fail" -eq 0 ]
