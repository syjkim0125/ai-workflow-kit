#!/usr/bin/env bash
# Tests for new-handoff.sh — creates the handoff skeleton in any repository.
#
# Contract under test:
#   1. Writes to <repo-root>/hand-off/HANDOFF-<TASK-KEY>-hhmmss.md
#   2. TASK-KEY comes from the branch (task/PROJ-123-slug, story/PROJ-9-slug)
#   3. Any repo works: run from a subdirectory, still lands at the root
#   4. No git repo -> falls back to cwd instead of failing
#   5. Branch without a Jira key -> NO-TICKET, never an empty key
#   6. Never overwrites an existing file (the name has no date, so same
#      ticket + same second on another day would collide)
#   7. hand-off/ is ignored locally via .git/info/exclude, leaving the repo's
#      tracked .gitignore untouched
#   8. Repo-local templates/JIRA-TASK.md wins over the bundled copy

set -uo pipefail

# Resolve the script under test relative to this test file, so the suite runs
# both from ~/.claude and from a repository copy.
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
_find() {  # $1 = basename
  for c in "$TEST_DIR/../scripts/$1" "$TEST_DIR/../$1" "$HOME/.claude/hooks/$1" \
           "$HOME/.claude/skills/usage-handoff/scripts/$1"; do
    [ -f "$c" ] && { printf '%s\n' "$c"; return 0; }
  done
  printf '%s\n' "$1"
}
SCRIPT="$(_find new-handoff.sh)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# macOS resolves /var -> /private/var, and git reports the resolved path.
# Compare like with like, or every path assertion fails for the wrong reason.
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

mkrepo() {  # $1=dir $2=branch
  mkdir -p "$1" && git -C "$1" init -q 2>/dev/null
  git -C "$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  git -C "$1" checkout -q -b "$2"
}

echo "test-new-handoff"
if [ ! -f "$SCRIPT" ]; then
  echo "  FAIL  script does not exist at $SCRIPT"; echo "0/8 passed"; exit 1
fi

# 1 & 2: path shape and TASK-KEY from a task branch
repo="$TMP/repo-a"; mkrepo "$repo" "task/PROJ-123-add-widget"
out="$(cd "$repo" && bash "$SCRIPT")"
check "task branch: file under <root>/hand-off/" "yes" \
  "$(printf '%s' "$out" | grep -q "^$repo/hand-off/" && echo yes || echo no)"
check "task branch: HANDOFF-PROJ-123-hhmmss.md" "yes" \
  "$(basename "$out" | grep -Eq '^HANDOFF-PROJ-123-[0-9]{6}\.md$' && echo yes || echo no)"
check "task branch: file exists and is non-empty" "yes" \
  "$([ -s "$out" ] && echo yes || echo no)"
check "task branch: state header carries the branch" "yes" \
  "$(grep -q 'task/PROJ-123-add-widget' "$out" && echo yes || echo no)"

# 7: local ignore, tracked .gitignore untouched
check "hand-off/ in .git/info/exclude" "yes" \
  "$(grep -q '^hand-off/$' "$repo/.git/info/exclude" && echo yes || echo no)"
check "tracked .gitignore not created" "yes" \
  "$([ ! -f "$repo/.gitignore" ] && echo yes || echo no)"

# 7b: linked worktrees share the main repository's info/exclude. Their .git is
# a file, so the script must resolve the common Git directory rather than skip it.
repo_w="$TMP/repo-w"; mkrepo "$repo_w" "base-worktree"
git -C "$repo_w" branch "task/WORK-12-linked"
worktree="$TMP/worktree-w"
git -C "$repo_w" worktree add -q "$worktree" "task/WORK-12-linked"
out_w="$(cd "$worktree" && bash "$SCRIPT")"
check "linked worktree: hand-off is ignored" "yes" \
  "$(git -C "$worktree" status --porcelain | grep -q '^?? hand-off/' && echo no || echo yes)"
check "linked worktree: common exclude updated" "yes" \
  "$(grep -q '^hand-off/$' "$repo_w/.git/info/exclude" && echo yes || echo no)"

# 2b: story branch
repo_s="$TMP/repo-s"; mkrepo "$repo_s" "story/SHOP-9-checkout"
out_s="$(cd "$repo_s" && bash "$SCRIPT")"
check "story branch: key is SHOP-9" "yes" \
  "$(basename "$out_s" | grep -q '^HANDOFF-SHOP-9-' && echo yes || echo no)"

# 3: run from a subdirectory, still lands at repo root
repo_b="$TMP/repo-b"; mkrepo "$repo_b" "task/API-7-thing"; mkdir -p "$repo_b/src/deep"
out_b="$(cd "$repo_b/src/deep" && bash "$SCRIPT")"
check "subdirectory: lands at repo root" "yes" \
  "$([ "$(dirname "$out_b")" = "$repo_b/hand-off" ] && echo yes || echo no)"

# 4: no git repo -> cwd
plain="$TMP/plain"; mkdir -p "$plain"
out_p="$(cd "$plain" && bash "$SCRIPT")"
check "non-git dir: falls back to cwd" "yes" \
  "$([ "$(dirname "$out_p")" = "$plain/hand-off" ] && echo yes || echo no)"

# 5: branch with no Jira key
repo_c="$TMP/repo-c"; mkrepo "$repo_c" "compact-pure"
out_c="$(cd "$repo_c" && bash "$SCRIPT")"
check "no jira key: uses NO-TICKET" "yes" \
  "$(basename "$out_c" | grep -q '^HANDOFF-NO-TICKET-' && echo yes || echo no)"

# 6: never overwrites
repo_d="$TMP/repo-d"; mkrepo "$repo_d" "task/DUP-1-x"
first="$(cd "$repo_d" && bash "$SCRIPT")"
printf 'ORIGINAL CONTENT' > "$first"
second="$(cd "$repo_d" && USAGE_HANDOFF_FORCE_TIME="$(basename "$first" | sed -E 's/.*-([0-9]{6})\.md/\1/')" bash "$SCRIPT")"
check "collision: does not overwrite" "ORIGINAL CONTENT" "$(cat "$first")"
check "collision: creates a distinct file" "yes" \
  "$([ "$first" != "$second" ] && [ -s "$second" ] && echo yes || echo no)"

# 8: repo-local template preferred
repo_e="$TMP/repo-e"; mkrepo "$repo_e" "task/TPL-1-y"
mkdir -p "$repo_e/templates"
printf '# REPO LOCAL TEMPLATE MARKER\n\n### Goal\n- G1. <x>\n' > "$repo_e/templates/JIRA-TASK.md"
out_e="$(cd "$repo_e" && bash "$SCRIPT")"
check "repo-local templates/JIRA-TASK.md wins" "yes" \
  "$(grep -q 'REPO LOCAL TEMPLATE MARKER' "$out_e" && echo yes || echo no)"

# bilingual: both language sections present when using the bundled template
check "bundled template: bilingual sections" "yes" \
  "$(grep -q '## 한국어' "$out" && grep -q '## English' "$out" && echo yes || echo no)"

echo "$pass/$((pass+fail)) passed"
[ "$fail" -eq 0 ]
