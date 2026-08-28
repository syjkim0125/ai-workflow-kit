#!/usr/bin/env python3
"""Refresh the subscription-usage cache that usage-guard.sh reads.

Runs detached from the hook so no network latency lands on the tool-call path.
Writes the cache atomically; the guard therefore never sees a half-written file.
Records fetched_at even on failure, so a broken token cannot turn into a request
storm — one failed attempt per REFRESH_SECS, not one per tool call.
"""
import json
import os
import sys
import time
from datetime import datetime

CACHE = os.environ.get("USAGE_GUARD_CACHE", os.path.expanduser("~/.claude/usage-cache.json"))

# usage.py sits next to this file in the in-repo layout, and in the check-usage
# skill in the home layout. Search both so one file serves both.
for _candidate in (
    os.path.dirname(os.path.abspath(__file__)),
    os.path.expanduser("~/.claude/skills/check-usage/scripts"),
):
    if os.path.exists(os.path.join(_candidate, "usage.py")):
        sys.path.insert(0, _candidate)
        break


def local_reset(iso: str | None) -> str:
    if not iso:
        return "no reset scheduled"
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone()
    except ValueError:
        return iso
    return f"{t:%Y-%m-%d %H:%M %Z}"


KIND_LABEL = {
    "session": "5-hour session",
    "weekly_all": "Weekly (all models)",
    "weekly_scoped": "Weekly (scoped)",
}


def label_for(lim: dict) -> str:
    label = KIND_LABEL.get(lim.get("kind"), lim.get("kind") or "usage")
    model = (lim.get("scope") or {}).get("model") or {}
    if model.get("display_name"):
        label = f"{label}: {model['display_name']}"
    return label


def write_cache(payload: dict) -> None:
    payload["fetched_at"] = int(time.time())
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    tmp = f"{CACHE}.tmp.{os.getpid()}"
    with open(tmp, "w") as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(tmp, CACHE)


def main() -> None:
    try:
        import usage  # the check-usage skill's script
        token = usage.read_token()
        data = usage.get(usage.USAGE_URL, token)
    except SystemExit as e:
        write_cache({"error": str(e), "max_percent": 0})
        return
    except Exception as e:  # noqa: BLE001 - a refresher must never crash loudly
        write_cache({"error": f"{type(e).__name__}: {e}", "max_percent": 0})
        return

    windows = []
    for lim in data.get("limits") or []:
        windows.append({
            "kind": lim.get("kind"),
            "label": label_for(lim),
            "percent": float(lim.get("percent") or 0),
            "resets_at": lim.get("resets_at"),
            "resets_local": local_reset(lim.get("resets_at")),
            "severity": lim.get("severity"),
            "is_active": bool(lim.get("is_active")),
        })

    if not windows:
        write_cache({"error": "no limit windows reported", "max_percent": 0})
        return

    # Threshold is judged on the highest window: the first one to run out is the
    # one that stops the work, regardless of which the API flags as binding.
    worst = max(windows, key=lambda w: w["percent"])
    write_cache({"max_percent": worst["percent"], "worst": worst, "windows": windows})


if __name__ == "__main__":
    main()
