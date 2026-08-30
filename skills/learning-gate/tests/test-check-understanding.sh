#!/usr/bin/env bash
# Tests for check-understanding.sh — the runtime-neutral record-line checker.
#
# Contract under test:
#   1. Valid record line with an existing artifact -> exit 0
#   2. Missing record line for the requested gate   -> exit 1
#   3. Malformed record line                        -> exit 2
#   4. Valid line whose artifact file is absent     -> exit 3
#   5. Invalid gate id / missing contract file      -> exit 4
#   6. N/A form with a reason                       -> exit 0
#   7. N/A form with an empty reason                -> exit 2
#   8. Gates are matched independently (G1 present, G4 absent)
#   9. G2 and G6 are rejected as invalid gate ids
#  10. Artifact path is resolved against --repo-root, not the cwd
#  11. A flag with no value following it (e.g. `--gate` as the last arg)
#      exits 4 instead of hanging (bash 3.2's `shift 2` no-ops on 1 arg left)
#  12. Same, for a flag missing its value mid-invocation (`--contract` last)
#  13. An artifact path containing spaces is accepted end-to-end
#  14. A record-line-shaped substring appearing mid-line (e.g. quoted in
#      prose) is not mistaken for a real record line
#  15. Absolute artifact paths are supported

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT="$TEST_DIR/../../workflow-setup/references/bin/check-understanding.sh"

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

run() { bash "$SCRIPT" "$@" >/dev/null 2>&1; printf '%s' "$?"; }

# Like run(), but guards against a parser hang (e.g. a regression of finding
# 1: `shift 2` spinning forever when a flag's value is missing) with a
# wall-clock alarm. macOS bash 3.2 ships no `timeout` binary, so use perl's
# alarm to send SIGALRM into the exec'd process if it runs too long. A
# process killed by that alarm reports as 124 (the conventional timeout
# sentinel) rather than as whatever exit code it would have hit — either way
# that is a FAIL against the expected exit-4 codes below, so a hang cannot
# block the suite from finishing.
run_guarded() {
  local rc
  perl -e 'alarm 5; exec @ARGV' bash "$SCRIPT" "$@" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -gt 128 ]; then
    printf '124'
  else
    printf '%s' "$rc"
  fi
}

# fixture repo
mkdir -p "$TMP/repo/docs/understanding"
ART="docs/understanding/2026-08-27-thing.html"
printf '<html></html>\n' > "$TMP/repo/$ART"

mkcontract() { printf '%s\n' "$@" > "$TMP/repo/CONTRACT.md"; }

# 1 valid + artifact present
mkcontract "# Contract" "Understanding gate (G1): $ART · 2026-08-27 · Check-in: accepted"
check "valid G1 with existing artifact" "0" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 2 missing line
mkcontract "# Contract" "nothing here"
check "missing G1 record line" "1" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 3 malformed (wrong separator, ASCII hyphen instead of middle dot)
mkcontract "Understanding gate (G1): $ART - 2026-08-27 - Check-in: accepted"
check "malformed separator" "2" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 3b malformed (bad check-in value)
mkcontract "Understanding gate (G1): $ART · 2026-08-27 · Check-in: maybe"
check "malformed check-in value" "2" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 4 artifact missing
mkcontract "Understanding gate (G1): docs/understanding/2026-01-01-gone.html · 2026-01-01 · Check-in: accepted"
check "artifact file absent" "3" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 5 usage errors
mkcontract "Understanding gate (G1): $ART · 2026-08-27 · Check-in: accepted"
check "invalid gate id G2" "4" "$(run --gate G2 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"
check "invalid gate id G6" "4" "$(run --gate G6 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"
check "contract file missing" "4" "$(run --gate G1 --contract "$TMP/repo/nope.md" --repo-root "$TMP/repo")"

# 6 N/A with reason
mkcontract "Understanding gate (G4): N/A — one-line constant change"
check "N/A with reason" "0" "$(run --gate G4 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 7 N/A without reason
mkcontract "Understanding gate (G4): N/A —"
check "N/A without reason" "2" "$(run --gate G4 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 8 gates matched independently
mkcontract "Understanding gate (G1): $ART · 2026-08-27 · Check-in: declined"
check "G1 present is independent" "0" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"
check "G4 absent is independent" "1" "$(run --gate G4 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 9 G3 and G5 are valid ids
mkcontract "Understanding gate (G3): $ART · 2026-08-27 · Check-in: accepted" \
           "Understanding gate (G5): $ART · 2026-08-27 · Check-in: accepted"
check "G3 accepted as valid id" "0" "$(run --gate G3 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"
check "G5 accepted as valid id" "0" "$(run --gate G5 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 10 repo-root resolution, not cwd
mkcontract "Understanding gate (G1): $ART · 2026-08-27 · Check-in: accepted"
cd "$TMP" || exit 1
check "artifact resolved against --repo-root" "0" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 11 missing value for a flag (last argument) must exit 4, not hang
mkcontract "Understanding gate (G1): $ART · 2026-08-27 · Check-in: accepted"
check "--gate with no value exits 4 without hanging" "4" "$(run_guarded --gate)"

# 12 missing value for a different flag, also as the last argument
check "--contract with no value exits 4 without hanging" "4" "$(run_guarded --gate G1 --contract)"

# 13 artifact path containing a space is accepted
SPACE_ART="docs/understanding/2026-08-27 my thing.html"
printf '<html></html>\n' > "$TMP/repo/$SPACE_ART"
mkcontract "Understanding gate (G1): $SPACE_ART · 2026-08-27 · Check-in: accepted"
check "artifact path with a space is accepted" "0" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 14 a record-line-shaped substring appearing mid-line is not a candidate
mkcontract "For example: Understanding gate (G1): $ART · 2026-01-01 · Check-in: yes"
check "quoted example mid-line is not treated as a record line" "1" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

# 15 absolute artifact paths are supported
ABS_ART="$TMP/repo/$ART"
mkcontract "Understanding gate (G1): $ABS_ART · 2026-08-27 · Check-in: accepted"
check "absolute artifact path is supported" "0" "$(run --gate G1 --contract "$TMP/repo/CONTRACT.md" --repo-root "$TMP/repo")"

printf '\nPASS %d / FAIL %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
