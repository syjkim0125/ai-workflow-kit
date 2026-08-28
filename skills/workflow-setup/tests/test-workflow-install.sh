#!/usr/bin/env bash
# Tests for workflow-install.sh — the idempotent repo-local installer.
#
# Contract under test:
#   1. Fresh repo: writes block, bin/, VERSION, templates/, docs/
#   2. Block is written to BOTH AGENTS.md and CLAUDE.md
#   3. No AGENTS.md at all -> creates it
#   4. Existing AGENTS.md -> content outside the markers is byte-identical after
#   5. Idempotent: running twice leaves exactly one block
#   6. Version bump: an older block is replaced, not duplicated
#   7. Unbalanced markers -> exit 3, nothing written
#   8. --dry-run writes nothing and exits 0
#   9. --remove strips the block and .ai-workflow/, leaves everything else
#  10. Missing --references -> exit 2
#  11. Copied bin/ scripts are executable
#  12. VERSION records the installed version
#  13. An END marker before a BEGIN -> exit 3, nothing written (order, not just count)
#  14. Unreadable/empty block file -> exit 2, target left byte-identical (no silent wipe)
#  15. Target file mode is preserved across a write; a fresh file gets 644, not mktemp's 600
#  16. Markers quoted inside a fenced code example are not treated as the live block

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT="$TEST_DIR/../scripts/workflow-install.sh"

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

# --- a minimal references/ tree, standing in for what Task 4 ships ---
REF="$TMP/references"
mkdir -p "$REF/bin" "$REF/templates" "$REF/engineering"
cat > "$REF/agents-block.md" <<'BLOCK'
<!-- BEGIN ai-workflow-kit vTEST — managed; edits inside are overwritten -->
## Engineering lifecycle (ai-workflow-kit)

- Understanding gates are part of approval, not a courtesy.
<!-- END ai-workflow-kit -->
BLOCK
printf '#!/usr/bin/env bash\necho checker\n' > "$REF/bin/check-understanding.sh"
printf '#!/usr/bin/env bash\necho guard\n'   > "$REF/bin/gate-guard.sh"
printf '# T\n' > "$REF/templates/UNDERSTANDING.md"
printf '# W\n' > "$REF/engineering/AI-WORKFLOW.md"

mkrepo() { rm -rf "$1"; mkdir -p "$1"; git -C "$1" init -q; }
run() { bash "$SCRIPT" --references "$REF" --repo-root "$1" --version vTEST "${@:2}" >/dev/null 2>&1; printf '%s' "$?"; }
blocks() {
  # NOTE: `grep -c PAT file || printf 0` double-fires: grep -c prints "0" on zero
  # matches but still exits 1, so the || runs too, yielding "0\n0". Capture first.
  local n
  n="$(grep -c '<!-- BEGIN ai-workflow-kit' "$1" 2>/dev/null)"
  printf '%s' "${n:-0}"
}

# 1 fresh repo
R="$TMP/r1"; mkrepo "$R"
check "fresh install exits 0"        "0"   "$(run "$R")"
check "AGENTS.md has one block"      "1"   "$(blocks "$R/AGENTS.md")"
check "bin/ checker copied"          "yes" "$([ -f "$R/.ai-workflow/bin/check-understanding.sh" ] && echo yes || echo no)"
check "bin/ checker executable"      "yes" "$([ -x "$R/.ai-workflow/bin/check-understanding.sh" ] && echo yes || echo no)"
check "VERSION recorded"             "vTEST" "$(cat "$R/.ai-workflow/VERSION" 2>/dev/null)"
check "template copied"              "yes" "$([ -f "$R/templates/UNDERSTANDING.md" ] && echo yes || echo no)"
check "engineering doc copied"       "yes" "$([ -f "$R/docs/engineering/AI-WORKFLOW.md" ] && echo yes || echo no)"
check "gate artifact dir created"    "yes" "$([ -f "$R/docs/understanding/.gitkeep" ] && echo yes || echo no)"

# 2 both instruction files
check "CLAUDE.md also has the block" "1"   "$(blocks "$R/CLAUDE.md")"

# 4 existing content preserved
# NOTE: awk '!/BEGIN/,/END/' does NOT strip a range — it prints everything, so an
# assertion built on it can never fail. Strip with an explicit state machine.
strip_block() {
  awk -v bp='<!-- BEGIN ai-workflow-kit' -v ep='<!-- END ai-workflow-kit -->' \
    'index($0,bp){inb=1;next} inb&&index($0,ep){inb=0;next} inb{next} {print}' "$1"
}
R="$TMP/r4"; mkrepo "$R"
printf '# My rules\n\n- keep me\n' > "$R/AGENTS.md"
run "$R" >/dev/null
check "first line untouched"          "# My rules" "$(head -1 "$R/AGENTS.md")"
check "user line survives once"       "1"          "$(grep -c 'keep me' "$R/AGENTS.md")"
check "nothing but the block added"   "1"          "$(strip_block "$R/AGENTS.md" | grep -c 'keep me')"
check "no kit text outside the block" "0"          "$(strip_block "$R/AGENTS.md" | grep -c 'ai-workflow-kit')"

# 5 idempotent
check "second run exits 0"           "0"   "$(run "$R")"
check "still exactly one block"      "1"   "$(blocks "$R/AGENTS.md")"

# 6 version bump replaces, does not duplicate
R="$TMP/r6"; mkrepo "$R"
run "$R" >/dev/null
sed -i.bak 's/vTEST/vOLD/' "$R/AGENTS.md" && rm -f "$R/AGENTS.md.bak"
run "$R" >/dev/null
check "old block replaced"           "1"   "$(blocks "$R/AGENTS.md")"
check "new version present"          "1"   "$(grep -c 'vTEST' "$R/AGENTS.md")"
check "old version gone"             "0"   "$(grep -c 'vOLD' "$R/AGENTS.md")"

# 7 unbalanced markers -> refuse, write nothing
R="$TMP/r7"; mkrepo "$R"
printf '# Mine\n<!-- BEGIN ai-workflow-kit vX -->\nstray\n' > "$R/AGENTS.md"
sha_before="$(shasum "$R/AGENTS.md" | cut -d" " -f1)"
check "unbalanced markers exit 3"    "3"   "$(run "$R")"
check "file untouched on refusal"    "$sha_before" "$(shasum "$R/AGENTS.md" | cut -d' ' -f1)"

# 8 dry run
R="$TMP/r8"; mkrepo "$R"
check "--dry-run exits 0"            "0"   "$(run "$R" --dry-run)"
check "--dry-run wrote nothing"      "no"  "$([ -e "$R/AGENTS.md" ] && echo yes || echo no)"

# 9 remove
R="$TMP/r9"; mkrepo "$R"
printf '# Mine\n\n- keep me\n' > "$R/AGENTS.md"
run "$R" >/dev/null
check "--remove exits 0"             "0"   "$(run "$R" --remove)"
check "block gone"                   "0"   "$(blocks "$R/AGENTS.md")"
check "user content kept"            "1"   "$(grep -c 'keep me' "$R/AGENTS.md")"
check ".ai-workflow removed"         "no"  "$([ -d "$R/.ai-workflow" ] && echo yes || echo no)"
check "templates kept on remove"     "yes" "$([ -f "$R/templates/UNDERSTANDING.md" ] && echo yes || echo no)"

# 10 usage error
R="$TMP/r10"; mkrepo "$R"
bash "$SCRIPT" --repo-root "$R" >/dev/null 2>&1
check "missing --references exit 2"  "2"   "$?"

# --- helper: reads a file's permission bits portably (perl works on macOS + Linux) ---
mode_of() { perl -e 'printf "%04o", (stat($ARGV[0]))[2] & 07777' "$1" 2>/dev/null; }

# 13 finding 1: an END before a BEGIN must refuse, not swallow everything to EOF
R="$TMP/r13"; mkrepo "$R"
printf 'line1 keep\n<!-- END ai-workflow-kit -->\nline2 keep\n<!-- BEGIN ai-workflow-kit vOLD -->\nline3 SHOULD SURVIVE\nline4 SHOULD SURVIVE\n' > "$R/AGENTS.md"
sha_before="$(shasum "$R/AGENTS.md" | cut -d' ' -f1)"
check "END-before-BEGIN exits 3"       "3"  "$(run "$R")"
check "END-before-BEGIN file untouched" "$sha_before" "$(shasum "$R/AGENTS.md" | cut -d' ' -f1)"
check "SHOULD-SURVIVE lines intact"    "2"  "$(grep -c 'SHOULD SURVIVE' "$R/AGENTS.md")"

# 14 finding 2: an unreadable (or empty) block file must not silently wipe the target
REF_BAD="$TMP/references-unreadable"
mkdir -p "$REF_BAD"
cp "$REF/agents-block.md" "$REF_BAD/agents-block.md"
chmod 000 "$REF_BAD/agents-block.md"
R="$TMP/r14"; mkrepo "$R"
run "$R" >/dev/null   # good install first, so the target already has real content
sha_before="$(shasum "$R/AGENTS.md" | cut -d' ' -f1)"
size_before="$(wc -c < "$R/AGENTS.md" | tr -d ' ')"
bash "$SCRIPT" --references "$REF_BAD" --repo-root "$R" --version vTEST >/dev/null 2>&1
check "unreadable block file exits 2"      "2"           "$?"
check "target untouched (sha)"             "$sha_before" "$(shasum "$R/AGENTS.md" | cut -d' ' -f1)"
check "target not wiped to 0 bytes"        "$size_before" "$(wc -c < "$R/AGENTS.md" | tr -d ' ')"
chmod 644 "$REF_BAD/agents-block.md"  # so the trap can clean up TMP unconditionally

# 15 finding 3: writing must preserve the target's mode, not mktemp's 600
R="$TMP/r15"; mkrepo "$R"
run "$R" >/dev/null
check "fresh AGENTS.md is 0644, not 0600"  "0644" "$(mode_of "$R/AGENTS.md")"
R="$TMP/r15b"; mkrepo "$R"
printf '# Mine\n' > "$R/AGENTS.md"; chmod 640 "$R/AGENTS.md"
run "$R" >/dev/null
check "existing 0640 mode preserved"       "0640" "$(mode_of "$R/AGENTS.md")"

# 16 finding 5: markers quoted inside a fenced doc example are not the live block
R="$TMP/r16"; mkrepo "$R"
cat > "$R/AGENTS.md" <<'EOF'
# My rules

Here is what the managed block looks like, as documentation:

```
<!-- BEGIN ai-workflow-kit vDOC-EXAMPLE -->
example content, not live
<!-- END ai-workflow-kit -->
```

- keep me
EOF
check "fenced example: install exits 0"     "0"   "$(run "$R")"
check "fenced example left untouched"       "1"   "$(grep -c 'vDOC-EXAMPLE' "$R/AGENTS.md")"
check "fenced example content intact"       "1"   "$(grep -c 'example content, not live' "$R/AGENTS.md")"
check "live block was actually installed"   "1"   "$(grep -c 'vTEST' "$R/AGENTS.md")"
check "user content survives"               "1"   "$(grep -c 'keep me' "$R/AGENTS.md")"
# second run must update the live block in place, still ignoring the fenced example
run "$R" >/dev/null
check "fenced example survives second run"  "1"   "$(grep -c 'vDOC-EXAMPLE' "$R/AGENTS.md")"
check "still exactly one live block"        "1"   "$(grep -c '<!-- BEGIN ai-workflow-kit vTEST' "$R/AGENTS.md")"

printf '\nPASS %d / FAIL %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
