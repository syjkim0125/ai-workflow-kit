#!/usr/bin/env bash
# Structural checks for the plugin and for what workflow-install.sh produces.
#
# The kit's known failure mode is a target repo that ends up half-installed or
# drifted. This suite installs into a throwaway repo and inspects the result.
#
# Contract under test:
#   1. Plugin manifests exist and are valid JSON
#   2. The Codex manifest points at the same skills/ directory (no mirror)
#   3. No .agents/skills mirror exists anywhere
#   4. Every shipped skill has a SKILL.md with frontmatter
#   5. references/ carries agents-block.md, bin/, templates/, engineering/
#   6. A fresh install produces all five artifacts
#   7. The install is idempotent
#   8. The copied checker actually runs in the target repo
#   9. --remove strips the block and .ai-workflow/ and keeps the rest
#  10. No bare (non-$HOME) .claude/skills/ path remains — that would mean
#      leftover pre-move repo-layout code. $HOME/${HOME}/~-prefixed paths are
#      legitimate user-level install fallbacks and don't count as stale.

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd "$TEST_DIR/../../.." && pwd -P)"     # repo root == plugin root

pass=0; fail=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    pass=$((pass+1)); printf '  PASS  %s\n' "$name"
  else
    fail=$((fail+1)); printf '  FAIL  %s\n        expected: %s\n        actual:   %s\n' "$name" "$expected" "$actual"
  fi
}
exists() { [ -e "$1" ] && printf yes || printf no; }
validjson() { jq -e . "$1" >/dev/null 2>&1 && printf yes || printf no; }
# NOTE: `grep -c PAT file || printf 0` double-fires — grep -c prints "0" on zero
# matches but still exits 1, so the || runs too and you get "0\n0". Capture first.
count() { local c; c="$(grep -c "$1" "$2" 2>/dev/null)"; printf '%s' "${c:-0}"; }

# 1-2 manifests
for m in .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .agents/plugins/marketplace.json; do
  check "manifest present: $m" "yes" "$(exists "$ROOT/$m")"
  check "manifest valid json: $m" "yes" "$(validjson "$ROOT/$m")"
done
check "codex points at shared skills dir" "./skills/" "$(jq -r '.skills' "$ROOT/.codex-plugin/plugin.json" 2>/dev/null)"
check "marketplace source is repo root"   "./"        "$(jq -r '.plugins[0].source' "$ROOT/.claude-plugin/marketplace.json" 2>/dev/null)"

# 3 no mirror
check "no .agents/skills mirror" "no" "$(exists "$ROOT/.agents/skills")"
check "real-work is gone"        "no" "$(exists "$ROOT/real-work")"

# 4 skills
for s in learning-gate story-breakdown usage-handoff workflow-setup; do
  check "skill present: $s" "yes" "$(exists "$ROOT/skills/$s/SKILL.md")"
  check "skill frontmatter: $s" "---" "$(head -1 "$ROOT/skills/$s/SKILL.md" 2>/dev/null)"
done

# 5 references
REF="$ROOT/skills/workflow-setup/references"
for r in agents-block.md bin templates engineering; do
  check "references has $r" "yes" "$(exists "$REF/$r")"
done
check "references bin has the checker" "yes" "$(exists "$REF/bin/check-understanding.sh")"

# 6-9 install into a throwaway repo
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
git -C "$T" init -q
printf '# House rules\n\n- do not touch me\n' > "$T/AGENTS.md"
bash "$ROOT/skills/workflow-setup/scripts/workflow-install.sh" \
  --references "$REF" --repo-root "$T" --version vTEST >/dev/null 2>&1
check "install exit 0" "0" "$?"
check "block in AGENTS.md"      "1"   "$(count '<!-- BEGIN ai-workflow-kit' "$T/AGENTS.md")"
check "block in CLAUDE.md"      "1"   "$(count '<!-- BEGIN ai-workflow-kit' "$T/CLAUDE.md")"
check "user content preserved"  "1"   "$(count 'do not touch me' "$T/AGENTS.md")"
check "bin installed"           "yes" "$(exists "$T/.ai-workflow/bin/check-understanding.sh")"
check "VERSION written"         "vTEST" "$(cat "$T/.ai-workflow/VERSION" 2>/dev/null)"
check "templates installed"     "yes" "$(exists "$T/templates/UNDERSTANDING.md")"
check "gate artifact dir"       "yes" "$(exists "$T/docs/understanding/.gitkeep")"

bash "$ROOT/skills/workflow-setup/scripts/workflow-install.sh" \
  --references "$REF" --repo-root "$T" --version vTEST >/dev/null 2>&1
check "idempotent: one block"   "1"   "$(count '<!-- BEGIN ai-workflow-kit' "$T/AGENTS.md")"

bash "$T/.ai-workflow/bin/check-understanding.sh" --gate G1 --contract "$T/AGENTS.md" --repo-root "$T" >/dev/null 2>&1
check "copied checker runs (1=no record line)" "1" "$?"

bash "$ROOT/skills/workflow-setup/scripts/workflow-install.sh" \
  --references "$REF" --repo-root "$T" --remove >/dev/null 2>&1
check "remove: block gone"      "0"   "$(count '<!-- BEGIN ai-workflow-kit' "$T/AGENTS.md")"
check "remove: user content kept" "1" "$(count 'do not touch me' "$T/AGENTS.md")"
check "remove: .ai-workflow gone" "no" "$(exists "$T/.ai-workflow")"
check "remove: templates kept"    "yes" "$(exists "$T/templates/UNDERSTANDING.md")"

# 10 no bare (pre-move) .claude/skills/ paths — exclude legitimate $HOME/
# ${HOME}/~-prefixed user-level install fallbacks, and this suite's own file
# (it necessarily mentions the pattern it's checking for).
SELF="$TEST_DIR/$(basename "${BASH_SOURCE[0]}")"
stale=$(grep -rnE '\.claude/skills/' "$ROOT/skills" 2>/dev/null \
  | grep -vE '(\$HOME|\$\{HOME\}|~)/\.claude/skills/' \
  | grep -vF "$SELF" \
  | cut -d: -f1 | sort -u | wc -l | tr -d ' ')
check "no stale .claude/skills paths in skills/" "0" "$stale"

printf '\nPASS %d / FAIL %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
