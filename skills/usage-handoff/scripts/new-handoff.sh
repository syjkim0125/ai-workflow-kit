#!/usr/bin/env bash
# Create a handoff skeleton at <repo-root>/hand-off/HANDOFF-<TASK-KEY>-hhmmss.md
# and print its path.
#
# Prefills the machine-knowable state (branch, base, commits, dirty files, usage
# snapshot) so the agent spends its remaining quota on judgment, not on running
# git commands. Section skeleton comes from the ai-workflow-kit JIRA-TASK
# template — the repo's own copy when it has one, so a repo's local edits win.

set -uo pipefail

# Resolve the bundled template relative to this script, so the same file works
# whether the skill lives in ~/.claude or inside a repository.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BUNDLED_TEMPLATE="$SCRIPT_DIR/../templates/JIRA-TASK.md"
[ -f "$BUNDLED_TEMPLATE" ] || BUNDLED_TEMPLATE="${HOME}/.claude/skills/usage-handoff/templates/JIRA-TASK.md"
USAGE_CACHE="${USAGE_GUARD_CACHE:-$HOME/.claude/usage-cache.json}"

root="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$root" ] && root="$PWD"
is_git=0
[ -n "$(git rev-parse --show-toplevel 2>/dev/null)" ] && is_git=1

branch="$(git branch --show-current 2>/dev/null)"
[ -z "$branch" ] && branch="(no branch)"

# Jira key from the kit's branch convention: task/<KEY>-<slug>, story/<KEY>-<slug>.
# Falls back to any KEY-123 elsewhere in the branch name, then to NO-TICKET —
# never to an empty key, which would produce HANDOFF--123456.md.
rest="$branch"
case "$branch" in task/*|story/*) rest="${branch#*/}" ;; esac
key="$(printf '%s' "$rest" | grep -oE '^[A-Z][A-Z0-9]+-[0-9]+' | head -1)"
[ -z "$key" ] && key="$(printf '%s' "$branch" | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' | head -1)"
[ -z "$key" ] && key="NO-TICKET"

ts="${USAGE_HANDOFF_FORCE_TIME:-$(date +%H%M%S)}"
dir="$root/hand-off"
mkdir -p "$dir" || { echo "cannot create $dir" >&2; exit 1; }

# The filename carries no date by design, so the same ticket at the same second
# on a different day would collide. Never clobber: suffix instead.
file="$dir/HANDOFF-$key-$ts.md"
n=2
while [ -e "$file" ]; do
  file="$dir/HANDOFF-$key-$ts-$n.md"
  n=$((n + 1))
done

# Local ignore only — never touch the repo's tracked .gitignore. Linked
# worktrees store `.git` as a file, so resolve the shared Git directory instead
# of assuming `<worktree>/.git` is a directory.
common_git_dir="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
if [ "$is_git" -eq 1 ] && [ -n "$common_git_dir" ] && [ -d "$common_git_dir" ]; then
  exclude="$common_git_dir/info/exclude"
  mkdir -p "$(dirname "$exclude")" 2>/dev/null
  grep -qx 'hand-off/' "$exclude" 2>/dev/null || printf 'hand-off/\n' >> "$exclude"
fi

template="$BUNDLED_TEMPLATE"
[ -f "$root/templates/JIRA-TASK.md" ] && template="$root/templates/JIRA-TASK.md"

# --- machine-knowable state ---------------------------------------------------
head_sha="$(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
upstream="$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || echo 'N/A — no upstream')"
base_sha="N/A"
if [ "$is_git" -eq 1 ]; then
  for candidate in main master develop; do
    if git rev-parse --verify -q "$candidate" >/dev/null 2>&1; then
      merge_base="$(git merge-base HEAD "$candidate" 2>/dev/null)"
      [ -n "$merge_base" ] && base_sha="$candidate@$(git rev-parse --short "$merge_base")"
      break
    fi
  done
fi
commits="$(git log --oneline -10 --no-decorate 2>/dev/null | sed 's/^/  - /')"
[ -z "$commits" ] && commits="  - (none)"
dirty="$(git status --porcelain 2>/dev/null | sed 's/^/  - /')"
[ -z "$dirty" ] && dirty="  - (clean)"

usage_line="N/A — no usage cache"
if [ -f "$USAGE_CACHE" ]; then
  cached="$(jq -r 'if .worst then (.worst.label + " " + (.worst.percent|tostring) + "% (resets " + (.worst.resets_local // .worst.resets_at // "?") + ")") else empty end' "$USAGE_CACHE" 2>/dev/null)"
  [ -n "$cached" ] && usage_line="$cached"
fi

# --- write --------------------------------------------------------------------
{
  cat <<HEADER
# 작업 인계 / Work handoff — $key

**작성 시각 / Written at:** $(date '+%Y-%m-%d %H:%M %Z')
**인계 이유 / Reason:** 구독 사용량 임계 초과 / subscription usage threshold crossed
**인계 시점 사용량 / Usage at handoff:** $usage_line
**Template source:** $template

## 인계 상태 / Handoff state

**저장소 / Repository:** \`$root\`
**브랜치 / Branch:** \`$branch\`
**HEAD:** \`$head_sha\`
**분기 기준 / Base ref:** \`$base_sha\`
**Upstream:** \`$upstream\`

### 커밋된 작업 / Committed work
$commits

### 미커밋 변경 / Uncommitted changes
$dirty

### 진행 상태 / Progress
<!-- 완료 조건 ID별로 상태와 증거를 적는다. Record status and evidence per Done-when ID.
     예 / e.g.: D1 [x] 테스트 12/12 통과 / tests 12/12 pass -->
- D1 [ ] <상태와 증거 / status and evidence>

### 시도했으나 버린 접근 / Approaches tried and abandoned
<!-- 수령자가 같은 벽에 다시 부딪히지 않도록 이유까지 적는다.
     State the reason, so the recipient does not hit the same wall again. -->
- <접근 / approach>: <버린 이유 / why abandoned>

### 다음 한 걸음 / Next single step
<!-- 수령 AI가 읽고 바로 시작할 수 있는 하나의 구체적 행동.
     One concrete action the receiving agent can start immediately. -->
- <행동 / action>

### 검증 방법 / How to verify
<!-- 정확한 명령과 기대 출력. Exact commands and expected output. -->
\`\`\`
<command>
\`\`\`

---

<!-- 아래는 ai-workflow-kit JIRA-TASK 골격이다. 현재 사실로 채우고, 해당 없는 항목은
     \`N/A — 이유\`로 남긴다. 추측으로 채우지 않는다.
     Below is the ai-workflow-kit JIRA-TASK skeleton. Fill it with current facts and
     leave \`N/A — reason\` where a section does not apply. Never fill it by guessing. -->

HEADER
  cat "$template"
} > "$file"

printf '%s\n' "$file"
