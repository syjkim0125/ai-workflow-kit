#!/usr/bin/env python3
"""Report Claude subscription rate-limit usage via the OAuth usage endpoint.

Reads the Claude Code OAuth access token from the macOS Keychain (or
~/.claude/.credentials.json on Linux) and queries the same endpoint the
in-app /usage command uses. Token is never printed.
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
PROFILE_URL = "https://api.anthropic.com/api/oauth/profile"


def read_token() -> str:
    cred_file = os.path.expanduser("~/.claude/.credentials.json")
    if os.path.exists(cred_file):
        with open(cred_file) as f:
            return json.load(f)["claudeAiOauth"]["accessToken"]
    out = subprocess.run(
        ["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        sys.exit("No OAuth credentials found (keychain + ~/.claude/.credentials.json both empty). "
                 "Run `claude auth login`, or you may be on an API-key/Bedrock/Vertex setup, "
                 "which has no subscription limits to report.")
    return json.loads(out.stdout)["claudeAiOauth"]["accessToken"]


def get(url: str, token: str) -> dict:
    """Fetch via curl — Python's cert store can be unusable behind TLS-inspecting
    proxies, while curl uses the system store."""
    out = subprocess.run(
        ["curl", "-sS", "--max-time", "20", "-w", "\\n%{http_code}",
         "-H", f"Authorization: Bearer {token}",
         "-H", "anthropic-beta: oauth-2025-04-20",
         url],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        sys.exit(f"curl failed ({out.returncode}): {out.stderr.strip()[:300]}")
    body, _, code = out.stdout.rpartition("\n")
    code = code.strip()
    if code in ("401", "403"):
        sys.exit(f"HTTP {code}: token rejected or expired. Start a Claude Code session "
                 "(it refreshes the token) or run `claude auth login`, then retry.")
    if code != "200":
        sys.exit(f"HTTP {code} from {url}: {body[:300]}")
    return json.loads(body)


def fmt_reset(iso: str | None) -> str:
    if not iso:
        return "no reset scheduled"
    t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    local = t.astimezone()
    delta = t - datetime.now(timezone.utc)
    mins = int(delta.total_seconds() // 60)
    if mins < 0:
        rel = "already elapsed — refresh pending"
    elif mins < 60:
        rel = f"in {mins}m"
    else:
        rel = f"in {mins // 60}h {mins % 60}m"
    return f"{local:%Y-%m-%d %H:%M %Z} ({rel})"


def bar(pct: float, width: int = 24) -> str:
    filled = min(width, max(0, round(pct / 100 * width)))
    return "█" * filled + "░" * (width - filled)


KIND_LABEL = {
    "session": "5-hour session",
    "weekly_all": "Weekly (all models)",
    "weekly_scoped": "Weekly (scoped)",
}


def main() -> None:
    as_json = "--json" in sys.argv
    token = read_token()
    usage = get(USAGE_URL, token)
    if as_json:
        print(json.dumps(usage, indent=2, ensure_ascii=False))
        return

    profile = get(PROFILE_URL, token)
    org = profile.get("organization") or {}
    acct = profile.get("account") or {}
    print(f"Account : {acct.get('email', '?')}")
    print(f"Plan    : {org.get('rate_limit_tier', '?')}"
          + (f" / {org.get('name')}" if org.get("name") else ""))
    print()

    limits = usage.get("limits") or []
    if not limits:
        print("No rate-limit windows reported (API-key or enterprise billing?).")
    for lim in limits:
        label = KIND_LABEL.get(lim.get("kind"), lim.get("kind", "?"))
        scope = (lim.get("scope") or {}).get("model") or {}
        if scope.get("display_name"):
            label = f"{label}: {scope['display_name']}"
        pct = float(lim.get("percent") or 0)
        flag = "" if lim.get("severity") == "normal" else f"  [{lim.get('severity')}]"
        active = "  ← binding" if lim.get("is_active") else ""
        print(f"{label:<28} {bar(pct)} {pct:5.1f}%{flag}{active}")
        print(f"{'':<28} resets {fmt_reset(lim.get('resets_at'))}")

    spend = usage.get("spend") or {}
    if spend.get("enabled"):
        used, cap = spend.get("used") or {}, spend.get("limit") or {}
        def money(m):
            if not m:
                return "?"
            return f"{m.get('amount_minor', 0) / (10 ** m.get('exponent', 2)):.2f} {m.get('currency', '')}".strip()
        print()
        print(f"Extra usage credits: {money(used)} used of {money(cap)} "
              f"({spend.get('percent', 0)}%)")


if __name__ == "__main__":
    main()
