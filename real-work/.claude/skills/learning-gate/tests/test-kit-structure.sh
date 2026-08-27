#!/usr/bin/env bash
# Structural consistency checks for the learning-gate wiring.
#
# Contract under test:
#   1. Both skill mirrors exist and are byte-identical
#   2. Scripts exist only under .claude (single copy, both runtimes)
#   3. templates/UNDERSTANDING.md defines all four gate ids
#   4. AGENTS.md registers the skill and the blocking rules
#   5. AI-WORKFLOW.md flow contains the G1 step and the G4 gate
#   6. AI-SETUP.md lists the new paths; README-FIRST.md (kit-only) is conditionally tested
#   7. docs/understanding/ exists
#   8. AI-WORKFLOW-SOURCES.md keeps source URLs on their correct bullets (defect guard)

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
KIT="$(cd "$TEST_DIR/../../../.." && pwd -P)"   # -> real-work/
ROOT="$(cd "$KIT/.." && pwd -P)"                # -> kit root

pass=0; fail=0; skip=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    pass=$((pass+1)); printf '  PASS  %s\n' "$name"
  else
    fail=$((fail+1)); printf '  FAIL  %s\n        expected: %s\n        actual:   %s\n' "$name" "$expected" "$actual"
  fi
}
skipcheck() {
  skip=$((skip+1)); printf '  SKIP  %s (%s)\n' "$1" "$2"
}
has() { grep -qF -- "$2" "$1" 2>/dev/null && printf 'yes' || printf 'no'; }
exists() { [ -e "$1" ] && printf 'yes' || printf 'no'; }

C="$KIT/.claude/skills/learning-gate"
A="$KIT/.agents/skills/learning-gate"

check "claude SKILL.md exists" "yes" "$(exists "$C/SKILL.md")"
check "agents SKILL.md exists" "yes" "$(exists "$A/SKILL.md")"
check "claude EVALS.md exists" "yes" "$(exists "$C/EVALS.md")"
check "agents EVALS.md exists" "yes" "$(exists "$A/EVALS.md")"

check "SKILL.md mirrors identical" "yes" "$(cmp -s "$C/SKILL.md" "$A/SKILL.md" && printf yes || printf no)"
check "EVALS.md mirrors identical" "yes" "$(cmp -s "$C/EVALS.md" "$A/EVALS.md" && printf yes || printf no)"

check "checker script present" "yes" "$(exists "$C/scripts/check-understanding.sh")"
check "checker not mirrored to .agents" "no" "$(exists "$A/scripts/check-understanding.sh")"
check "docs/understanding exists" "yes" "$(exists "$KIT/docs/understanding")"

T="$KIT/templates/UNDERSTANDING.md"
check "template exists" "yes" "$(exists "$T")"
for g in G1 G3 G4 G5; do
  check "template mentions $g" "yes" "$(has "$T" "$g")"
done
check "template states record grammar" "yes" "$(has "$T" "Understanding gate (G1):")"

G="$KIT/AGENTS.md"
check "AGENTS registers learning-gate" "yes" "$(has "$G" '`learning-gate` ships in this repository')"
check "AGENTS names the checker" "yes" "$(has "$G" "check-understanding.sh")"
check "AGENTS points at the template" "yes" "$(has "$G" "templates/UNDERSTANDING.md")"
check "AGENTS drops the stale prose" "no" "$(has "$G" "quiz yourself against the change")"

W="$KIT/docs/engineering/AI-WORKFLOW.md"
check "flow has G1 step" "yes" "$(has "$W" "G1 understanding gate: learning-gate acceptance")"
check "workflow names G4 command" "yes" "$(has "$W" "learning-gate diff")"
check "workflow keeps N/A escape" "yes" "$(has "$W" "Understanding gate (G4): N/A")"
check "workflow drops the stale prose" "no" "$(has "$W" "add an understanding gate before merge: have the agent explain")"

S="$KIT/docs/engineering/AI-SETUP.md"
check "setup lists learning-gate" "yes" "$(has "$S" "learning-gate/")"
check "setup lists UNDERSTANDING.md" "yes" "$(has "$S" "UNDERSTANDING.md")"

R="$ROOT/README-FIRST.md"
if [ -f "$R" ]; then
  check "README-FIRST lists learning-gate" "yes" "$(has "$R" "learning-gate/")"
  check "README-FIRST lists UNDERSTANDING.md" "yes" "$(has "$R" "UNDERSTANDING.md")"
else
  skipcheck "README-FIRST lists learning-gate" "kit-only check: no README-FIRST.md at repo root"
  skipcheck "README-FIRST lists UNDERSTANDING.md" "kit-only check: no README-FIRST.md at repo root"
fi

SRC="$KIT/docs/engineering/AI-WORKFLOW-SOURCES.md"
if [ -f "$SRC" ]; then
  check "sources record ce-explain" "yes" "$(has "$SRC" "ce-explain")"
  check "sources record eli5" "yes" "$(has "$SRC" "eli5")"
  littnext() {
    awk '/^- Geoffrey Litt/{f=1;next} f{print; exit}' "$1" 2>/dev/null
  }
  check "sources: Litt bullet keeps its own first URL" "  - https://youtu.be/iv60GIHpijE" "$(littnext "$SRC")"
else
  skipcheck "sources record ce-explain" "kit-only check: no AI-WORKFLOW-SOURCES.md in this absorption"
  skipcheck "sources record eli5" "kit-only check: no AI-WORKFLOW-SOURCES.md in this absorption"
  skipcheck "sources: Litt bullet keeps its own first URL" "kit-only check: no AI-WORKFLOW-SOURCES.md in this absorption"
fi

printf '\nPASS %d / FAIL %d / SKIP %d\n' "$pass" "$fail" "$skip"
[ "$fail" -eq 0 ]
