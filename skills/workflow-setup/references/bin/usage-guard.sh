#!/usr/bin/env bash
# PostToolUse hook: warn once per rate-limit window when subscription usage
# crosses the threshold, so work can be handed off before the quota runs out.
#
# Design constraints:
#   - Zero network I/O on the hot path. Reads a cache file only; a detached
#     refresher fetches the live numbers at most once per REFRESH_SECS.
#   - The quiet path prints NOTHING. Non-JSON stdout from a hook can be injected
#     into Claude's context, so silence must be exact, not approximate.
#   - Fires once per (session, window). Injecting on every tool call would pile
#     up tokens in context permanently.
#   - Never blocks work: every failure path exits 0 silently.

CACHE="${USAGE_GUARD_CACHE:-$HOME/.claude/usage-cache.json}"
MARKER_DIR="${USAGE_GUARD_MARKER_DIR:-$HOME/.claude/usage-markers}"
THRESHOLD="${USAGE_GUARD_THRESHOLD:-90}"
REFRESH_SECS="${USAGE_GUARD_REFRESH_SECS:-300}"
REFRESHER="${USAGE_GUARD_REFRESHER:-$HOME/.claude/hooks/usage-refresh.py}"
LOCK="${USAGE_GUARD_LOCK:-$HOME/.claude/usage-refresh.lock}"

exec 2>/dev/null

input="$(cat)"
session_id="$(printf '%s' "$input" | jq -r '.session_id // "unknown"' 2>/dev/null)"
[ -z "$session_id" ] && session_id="unknown"

now="$(date +%s)"

# One cache read for everything the hook needs — this runs after every tool
# call, so each avoided subprocess is real wall-clock.
# Split on TAB only: labels such as "Weekly (scoped): Fable" contain spaces,
# and word-splitting them shifted every later field (silently reusing one
# window_id for every window, so the second window never warned).
fetched_at=0
percent=""
if [ -f "$CACHE" ]; then
  IFS=$'\t' read -r fetched_at percent label resets resets_local <<< "$(
    jq -r '[(.fetched_at // 0),
            (.max_percent // 0),
            (.worst.label // "usage"),
            (.worst.resets_at // "unknown"),
            (.worst.resets_local // .worst.resets_at // "unknown")]
           | @tsv' "$CACHE" 2>/dev/null
  )"
  case "$fetched_at" in ''|*[!0-9]*) fetched_at=0 ;; esac
fi

# --- refresh the cache in the background if it is stale -----------------------
# Piggybacks on tool use: no tool calls means no refresh, so an idle session
# makes zero API requests. A lock dir keeps concurrent tool calls from spawning
# a pile of refreshers while one is already in flight.
if [ -z "${USAGE_GUARD_NO_REFRESH:-}" ] && [ -f "$REFRESHER" ]; then
  if [ "$((now - fetched_at))" -ge "$REFRESH_SECS" ]; then
    if mkdir "$LOCK" 2>/dev/null; then
      ( trap 'rmdir "$LOCK" 2>/dev/null' EXIT
        python3 "$REFRESHER" >/dev/null 2>&1 ) &
    else
      # Steal a lock left behind by a killed refresher.
      lock_age_ok=$(find "$LOCK" -maxdepth 0 -mmin +2 2>/dev/null | wc -l)
      [ "$lock_age_ok" -gt 0 ] && rmdir "$LOCK" 2>/dev/null
    fi
  fi
fi

# --- threshold check ----------------------------------------------------------

awk -v p="$percent" -v t="$THRESHOLD" 'BEGIN { exit !(p + 0 >= t + 0) }' || exit 0

# One shot per (session, window). A new window has a new resets_at, so the
# next window warns again without any cleanup step.
window_id="$(printf '%s' "$resets" | cksum | cut -d' ' -f1)"
marker="$MARKER_DIR/${session_id}-${window_id}"
[ -f "$marker" ] && exit 0
mkdir -p "$MARKER_DIR" 2>/dev/null || exit 0
: > "$marker" 2>/dev/null || exit 0

jq -n \
  --arg pct "$percent" \
  --arg label "$label" \
  --arg resets "$resets_local" \
  --arg threshold "$THRESHOLD" \
  '{
     hookSpecificOutput: {
       hookEventName: "PostToolUse",
       additionalContext: (
         "[usage-guard] 구독 사용량이 임계값 " + $threshold + "%를 넘었습니다: "
         + $label + " " + $pct + "% (리셋 " + $resets + ").\n"
         + "지금 진행 중인 단계만 안전하게 마무리한 뒤, `usage-handoff` 스킬을 호출해 "
         + "인계 문서를 작성하라. 작성 후 사용자에게 파일 경로를 보고하라. "
         + "작업을 중단하지는 말고, 문서를 남긴 뒤 남은 할당량 안에서 계속 진행하라.\n"
         + "이 알림은 이 한도 창에서 한 번만 표시된다."
       )
     },
     systemMessage: ("사용량 " + $pct + "% (" + $label + ") — 핸드오프 문서를 작성합니다.")
   }'
exit 0
