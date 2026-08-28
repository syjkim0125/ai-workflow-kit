#!/usr/bin/env bash
# Tests for enable-hook.sh — the per-person opt-in installer for the usage
# warning hook, for Claude Code and Codex.
#
# Contract under test:
#   1. Default installs into BOTH runtimes
#   2. Claude Code target is .claude/settings.local.json; Codex is .codex/hooks.json
#   3. Existing keys in those files survive (merge, never clobber)
#   4. Idempotent: running twice leaves exactly one entry
#   5. --threshold N is carried as USAGE_GUARD_THRESHOLD=N on the command
#   6. Re-running with a new threshold UPDATES the existing entry
#   7. .codex/hooks.json is added to .git/info/exclude (it holds personal paths)
#   8. --claude / --codex install only that runtime
#   9. Output JSON is valid and the command resolves the repo at run time

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
_find() {
  for c in "$TEST_DIR/../scripts/$1" "$TEST_DIR/../$1" \
           "$HOME/.claude/skills/usage-handoff/scripts/$1"; do
    [ -f "$c" ] && { printf '%s\n' "$c"; return 0; }
  done
  printf '%s\n' "$1"
}
SCRIPT="$(_find enable-hook.sh)"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
TMP="$(cd "$TMP" && pwd -P)"

pass=0; fail=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then pass=$((pass+1)); printf '  PASS  %s\n' "$name"
  else fail=$((fail+1)); printf '  FAIL  %s\n        expected: %s\n        actual:   %s\n' "$name" "$expected" "$actual"; fi
}
mkrepo() { mkdir -p "$1"; git -C "$1" init -q; }
ccmd() { jq -r '[.hooks.PostToolUse[]|select(.matcher=="*")|.hooks[]|select(.command|test("usage-guard"))|.command]|join("|")' "$1" 2>/dev/null; }
ccount() { jq -r '[.hooks.PostToolUse[]|select(.matcher=="*")|.hooks[]|select(.command|test("usage-guard"))]|length' "$1" 2>/dev/null; }

echo "test-enable-hook"
if [ ! -f "$SCRIPT" ]; then echo "  FAIL  script does not exist at $SCRIPT"; echo "0/9 passed"; exit 1; fi

# 1 & 2: default installs both runtimes
r="$TMP/a"; mkrepo "$r"
bash "$SCRIPT" --repo "$r" >/dev/null 2>&1
check "default: claude file created" "yes" "$([ -f "$r/.claude/settings.local.json" ] && echo yes || echo no)"
check "default: codex file created"  "yes" "$([ -f "$r/.codex/hooks.json" ] && echo yes || echo no)"
check "default: command resolves repo at run time" "yes" \
  "$(ccmd "$r/.claude/settings.local.json" | grep -q 'git rev-parse --show-toplevel' && echo yes || echo no)"
check "default: no threshold override at 90" "yes" \
  "$(ccmd "$r/.claude/settings.local.json" | grep -q 'USAGE_GUARD_THRESHOLD' && echo no || echo yes)"

# 7: codex file locally ignored
check "codex hooks.json in .git/info/exclude" "yes" \
  "$(grep -qx '.codex/hooks.json' "$r/.git/info/exclude" 2>/dev/null && echo yes || echo no)"

# 4: idempotent
bash "$SCRIPT" --repo "$r" >/dev/null 2>&1
check "idempotent: one claude entry" "1" "$(ccount "$r/.claude/settings.local.json")"
check "idempotent: one codex entry"  "1" "$(ccount "$r/.codex/hooks.json")"

# 3: merge preserves existing keys
r2="$TMP/b"; mkrepo "$r2"; mkdir -p "$r2/.claude"
printf '{"permissions":{"allow":["Bash(ls)"]}}\n' > "$r2/.claude/settings.local.json"
mkdir -p "$r2/.codex"
printf '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"/usr/bin/true"}]}]}}\n' > "$r2/.codex/hooks.json"
bash "$SCRIPT" --repo "$r2" >/dev/null 2>&1
check "merge: claude permissions preserved" "Bash(ls)" \
  "$(jq -r '.permissions.allow[0]' "$r2/.claude/settings.local.json")"
check "merge: codex PreToolUse preserved" "/usr/bin/true" \
  "$(jq -r '.hooks.PreToolUse[0].hooks[0].command' "$r2/.codex/hooks.json")"

# 5 & 6: threshold, then update in place
r3="$TMP/c"; mkrepo "$r3"
bash "$SCRIPT" --repo "$r3" --threshold 80 >/dev/null 2>&1
check "threshold 80 present" "yes" \
  "$(ccmd "$r3/.claude/settings.local.json" | grep -q 'USAGE_GUARD_THRESHOLD=80' && echo yes || echo no)"
bash "$SCRIPT" --repo "$r3" --threshold 70 >/dev/null 2>&1
check "re-run updates threshold to 70" "yes" \
  "$(ccmd "$r3/.claude/settings.local.json" | grep -q 'USAGE_GUARD_THRESHOLD=70' && echo yes || echo no)"
check "re-run does not duplicate" "1" "$(ccount "$r3/.claude/settings.local.json")"
check "old threshold gone" "yes" \
  "$(ccmd "$r3/.claude/settings.local.json" | grep -q 'THRESHOLD=80' && echo no || echo yes)"

# 8: single-runtime installs
r4="$TMP/d"; mkrepo "$r4"; bash "$SCRIPT" --repo "$r4" --claude >/dev/null 2>&1
check "--claude: no codex file" "yes" "$([ ! -f "$r4/.codex/hooks.json" ] && echo yes || echo no)"
r5="$TMP/e"; mkrepo "$r5"; bash "$SCRIPT" --repo "$r5" --codex >/dev/null 2>&1
check "--codex: no claude file" "yes" "$([ ! -f "$r5/.claude/settings.local.json" ] && echo yes || echo no)"

# 9: JSON validity everywhere
bad=0
for f in "$r/.claude/settings.local.json" "$r/.codex/hooks.json" \
         "$r2/.claude/settings.local.json" "$r2/.codex/hooks.json" \
         "$r3/.claude/settings.local.json"; do
  jq empty "$f" 2>/dev/null || bad=$((bad+1))
done
check "all produced JSON is valid" "0" "$bad"

# invalid threshold is refused rather than written
r6="$TMP/f"; mkrepo "$r6"
bash "$SCRIPT" --repo "$r6" --threshold 150 >/dev/null 2>&1
check "threshold 150 refused" "yes" "$([ ! -f "$r6/.claude/settings.local.json" ] && echo yes || echo no)"

echo "$pass/$((pass+fail)) passed"
[ "$fail" -eq 0 ]
