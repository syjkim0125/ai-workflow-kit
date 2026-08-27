#!/usr/bin/env bash
# Tests for enable-gate-hook.sh — the per-person opt-in installer for the
# understanding-gate warning hook (Claude Code only).
#
# Contract under test:
#   1. Installs a PreToolUse entry into .claude/settings.local.json
#   2. Existing keys in that file survive (merge, never clobber)
#   3. Idempotent: running twice leaves exactly one entry
#   4. --contract PATH is carried as GATE_GUARD_CONTRACT=PATH
#   5. Re-running with a new contract UPDATES the existing entry
#   6. Emitted JSON is valid
#   7. gate-guard.sh warns (exit 0) rather than blocking when the gate is missing
#   8. gate-guard.sh finds its checker via sibling resolution, not $ROOT — so
#      it still warns when cwd's repo has no learning-gate skill installed

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ENABLE="$TEST_DIR/../scripts/enable-gate-hook.sh"
GUARD="$TEST_DIR/../scripts/gate-guard.sh"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
TMP="$(cd "$TMP" && pwd -P)"

pass=0; fail=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    pass=$((pass+1)); printf '  PASS  %s\n' "$name"
  else
    fail=$((fail+1)); printf '  FAIL  %s\n        expected: %s\n        actual:   %s\n' "$name" "$expected" "$actual"
  fi
}

REPO="$TMP/repo"; mkdir -p "$REPO"; git -C "$REPO" init -q
SET="$REPO/.claude/settings.local.json"
count() { jq -r '[.hooks.PreToolUse[]?.hooks[]?|select(.command|test("gate-guard"))]|length' "$1" 2>/dev/null; }
cmdof() { jq -r '[.hooks.PreToolUse[]?.hooks[]?|select(.command|test("gate-guard"))|.command]|join("|")' "$1" 2>/dev/null; }

# 2 preserve existing keys
mkdir -p "$REPO/.claude"; printf '{"env":{"KEEP":"me"}}\n' > "$SET"

( cd "$REPO" && bash "$ENABLE" --contract docs/CONTRACT.md >/dev/null 2>&1 )
check "installs one entry"        "1"    "$(count "$SET")"
check "preserves existing key"    "me"   "$(jq -r '.env.KEEP' "$SET" 2>/dev/null)"
check "carries contract path"     "yes"  "$(cmdof "$SET" | grep -q 'GATE_GUARD_CONTRACT=docs/CONTRACT.md' && printf yes || printf no)"
check "emits valid json"          "yes"  "$(jq -e . "$SET" >/dev/null 2>&1 && printf yes || printf no)"

# 3 idempotent
( cd "$REPO" && bash "$ENABLE" --contract docs/CONTRACT.md >/dev/null 2>&1 )
check "idempotent"                "1"    "$(count "$SET")"

# 5 update on new contract
( cd "$REPO" && bash "$ENABLE" --contract docs/OTHER.md >/dev/null 2>&1 )
check "still one entry"           "1"    "$(count "$SET")"
check "updates contract path"     "yes"  "$(cmdof "$SET" | grep -q 'GATE_GUARD_CONTRACT=docs/OTHER.md' && printf yes || printf no)"

# 7 guard warns, never blocks
# $REPO deliberately has no .claude/skills/learning-gate installed in it — this
# also exercises case 8 below, since $ROOT-relative CHECKER resolution would
# never find the checker here.
printf '# no record line here\n' > "$REPO/docs_contract.md"
out="$( cd "$REPO" && GATE_GUARD_CONTRACT=docs_contract.md bash "$GUARD" 2>&1 )"; rc=$?
check "guard exits 0 (warn only)" "0"    "$rc"
check "guard mentions the gate"   "yes"  "$(printf '%s' "$out" | grep -qi 'understanding gate' && printf yes || printf no)"

# 8 regression pin: sibling resolution, not $ROOT-relative (see gate-guard.sh comment)
check "guard finds its checker even when cwd repo has no skill installed" \
                                   "yes"  "$(printf '%s' "$out" | grep -qi 'understanding gate' && printf yes || printf no)"

printf '\nPASS %d / FAIL %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
