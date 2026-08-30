#!/usr/bin/env bash
# Turn on the usage-threshold warning for yourself, in this repository.
#
# The hook is personal: it reads your quota with your credentials, so it is not
# committed and each person opts in. This script writes the entry into the
# untracked config for one or both runtimes, merging rather than replacing.
#
# Usage: enable-hook.sh [--threshold N] [--claude | --codex | --both] [--repo PATH]
#   --threshold N   warn at N% of the highest limit window (default 90)
#   --claude        Claude Code only (.claude/settings.local.json)
#   --codex         Codex only (.codex/hooks.json)
#   --both          default
#   --repo PATH     target repository (default: the repo containing the cwd)

set -euo pipefail

threshold=90
target=both
repo=""

while [ $# -gt 0 ]; do
  case "$1" in
    --threshold) threshold="${2:?--threshold needs a number}"; shift 2 ;;
    --threshold=*) threshold="${1#*=}"; shift ;;
    --claude) target=claude; shift ;;
    --codex)  target=codex;  shift ;;
    --both)   target=both;   shift ;;
    --repo) repo="${2:?--repo needs a path}"; shift 2 ;;
    --repo=*) repo="${1#*=}"; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$threshold" in
  ''|*[!0-9]*) echo "threshold must be a whole number 1-99: $threshold" >&2; exit 2 ;;
esac
if [ "$threshold" -lt 1 ] || [ "$threshold" -gt 99 ]; then
  echo "threshold must be between 1 and 99 (got $threshold). 100 would warn only" >&2
  echo "after the quota is already gone, which defeats the purpose." >&2
  exit 2
fi

if [ -z "$repo" ]; then
  repo="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$repo" ] || { echo "not inside a git repository; pass --repo PATH" >&2; exit 1; }
fi
repo="$(cd "$repo" && pwd -P)"
[ -d "$repo/.git" ] || { echo "not a git repository: $repo" >&2; exit 1; }

# Resolved at hook run time, not now: the path must work on every teammate's
# machine, so it can hold no absolute prefix.
guard='bash "$(git rev-parse --show-toplevel)/.ai-workflow/bin/usage-guard.sh"'
if [ "$threshold" -ne 90 ]; then
  cmd="USAGE_GUARD_THRESHOLD=$threshold $guard"
else
  cmd="$guard"
fi

REPO="$repo" CMD="$cmd" TARGET="$target" python3 <<'PY'
import json, os, pathlib

repo = pathlib.Path(os.environ["REPO"])
cmd = os.environ["CMD"]
target = os.environ["TARGET"]


def install(path: pathlib.Path, extra: dict) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.loads(path.read_text()) if path.exists() else {}
    post = data.setdefault("hooks", {}).setdefault("PostToolUse", [])
    group = next((g for g in post if g.get("matcher") == "*"), None)
    if group is None:
        group = {"matcher": "*", "hooks": []}
        post.append(group)
    inner = group.setdefault("hooks", [])
    existing = [h for h in inner if "usage-guard.sh" in (h.get("command") or "")]
    entry = {"type": "command", "command": cmd, **extra}
    if existing:
        # Update in place so re-running with a new threshold changes the
        # threshold instead of stacking a second warning on every tool call.
        was = existing[0].get("command")
        existing[0].clear()
        existing[0].update(entry)
        for dup in existing[1:]:
            inner.remove(dup)
        action = "unchanged" if was == cmd else "updated"
    else:
        inner.append(entry)
        action = "added"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return action


if target in ("claude", "both"):
    p = repo / ".claude" / "settings.local.json"
    print(f"  Claude Code  {install(p, {'shell': 'bash', 'timeout': 10})}: {p}")
    # .claude/settings.local.json is personal (it embeds this hook's own
    # config) and this script's own header says it is not committed. Keep it
    # out of git locally, same as .codex/hooks.json below.
    exclude = repo / ".git" / "info" / "exclude"
    exclude.parent.mkdir(parents=True, exist_ok=True)
    lines = exclude.read_text().splitlines() if exclude.exists() else []
    if ".claude/settings.local.json" not in lines:
        with exclude.open("a") as f:
            f.write(".claude/settings.local.json\n")
        print("  ignored locally: .claude/settings.local.json (.git/info/exclude)")

if target in ("codex", "both"):
    p = repo / ".codex" / "hooks.json"
    print(f"  Codex        {install(p, {'timeout': 10})}: {p}")
    # .codex/hooks.json is not gitignored by default in these repos, and it can
    # hold machine-specific paths from other tools. Keep it out of git locally.
    exclude = repo / ".git" / "info" / "exclude"
    exclude.parent.mkdir(parents=True, exist_ok=True)
    lines = exclude.read_text().splitlines() if exclude.exists() else []
    if ".codex/hooks.json" not in lines:
        with exclude.open("a") as f:
            f.write(".codex/hooks.json\n")
        print("  ignored locally: .codex/hooks.json (.git/info/exclude)")
PY

echo
echo "Warns once per limit window at ${threshold}% of the highest window"
echo "(5-hour, weekly all-models, weekly per-model). Below that it prints nothing"
echo "and costs no tokens."
if [ "$target" != "claude" ]; then
  echo "Codex asks you to trust a new hook once — run /hooks there to approve it."
fi
