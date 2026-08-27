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
#      it still warns when run from a copy that shares no repo with the caller
#   9. the installed command falls back to the install-time repo root when
#      $CLAUDE_PROJECT_DIR is unset, instead of silently resolving to nothing
#  10. a repo root containing a literal double quote is refused at install
#      time (exit 2) rather than emitted into an unparsable hook command,
#      and the settings file is left untouched

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
check "falls back to install-time root" "yes" "$(cmdof "$SET" | grep -qF '${CLAUDE_PROJECT_DIR:-'"$REPO"'}' && printf yes || printf no)"

# 3 idempotent
( cd "$REPO" && bash "$ENABLE" --contract docs/CONTRACT.md >/dev/null 2>&1 )
check "idempotent"                "1"    "$(count "$SET")"

# 5 update on new contract
( cd "$REPO" && bash "$ENABLE" --contract docs/OTHER.md >/dev/null 2>&1 )
check "still one entry"           "1"    "$(count "$SET")"
check "updates contract path"     "yes"  "$(cmdof "$SET" | grep -q 'GATE_GUARD_CONTRACT=docs/OTHER.md' && printf yes || printf no)"

# 7 guard warns, never blocks
# $REPO deliberately has no .claude/skills/learning-gate installed in it.
printf '# no record line here\n' > "$REPO/docs_contract.md"
out="$( cd "$REPO" && GATE_GUARD_CONTRACT=docs_contract.md bash "$GUARD" 2>&1 )"; rc=$?
check "guard exits 0 (warn only)" "0"    "$rc"
check "guard mentions the gate"   "yes"  "$(printf '%s' "$out" | grep -qi 'understanding gate' && printf yes || printf no)"

# 8 regression pin: sibling resolution, not $ROOT-relative (see gate-guard.sh
# comment). Independent of case 7's fixture on purpose: copy the guard and
# checker into a directory that shares no git repo with anything else in this
# test, then invoke the copy from a third, unrelated cwd. Under the old
# $ROOT-relative CHECKER lookup this fails to find the checker and prints
# nothing; under sibling resolution it still finds it and warns.
ISO="$TMP/iso"; mkdir -p "$ISO"
cp "$GUARD" "$ISO/gate-guard.sh"
cp "$TEST_DIR/../scripts/check-understanding.sh" "$ISO/check-understanding.sh"
CONTRACT_ISO="$TMP/iso-contract.md"; printf '# no record line here\n' > "$CONTRACT_ISO"
CWD3="$TMP/elsewhere"; mkdir -p "$CWD3"
out8="$( cd "$CWD3" && GATE_GUARD_CONTRACT="$CONTRACT_ISO" bash "$ISO/gate-guard.sh" 2>&1 )"; rc8=$?
check "iso guard exits 0 (warn only)" "0"   "$rc8"
check "guard finds its checker via a copy sharing no repo with the caller" \
                                   "yes"  "$(printf '%s' "$out8" | grep -qi 'understanding gate' && printf yes || printf no)"

# 10 refuse to install when the repo root can't be safely embedded in CMD
REPOQ="$TMP/quotetest/repo\"weird"; mkdir -p "$REPOQ"; git -C "$REPOQ" init -q
SETQ="$REPOQ/.claude/settings.local.json"
( cd "$REPOQ" && bash "$ENABLE" --contract docs/CONTRACT.md >/dev/null 2>&1 ); rcq=$?
check "refuses unsafe repo root"              "2"   "$rcq"
check "settings file not created for unsafe root" "no" "$( [ -e "$SETQ" ] && printf yes || printf no )"

printf '\nPASS %d / FAIL %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
