#!/usr/bin/env bash
# Install, update, or remove the ai-workflow-kit repo-local footprint.
#
# A plugin cannot write into a target repository, and the kit's enforcement
# lives in files that must be there: the always-on rules an agent reads at the
# repo root, the gate artifacts, and the checker that CI or a teammate without
# the plugin still has to be able to run. This script writes exactly those.
#
# Usage:
#   workflow-install.sh --references <dir> [--repo-root <dir>] [--version <v>]
#                       [--dry-run] [--remove]
#
# Exit codes:
#   0  done
#   2  usage error
#   3  refused — the target's markers are unbalanced; not guessing

set -uo pipefail

BEGIN_PAT='<!-- BEGIN ai-workflow-kit'
END_PAT='<!-- END ai-workflow-kit -->'

REFS=""; ROOT=""; VERSION="v2.6"; DRY=0; REMOVE=0

need_value() { [ $# -ge 2 ] || { printf 'missing value for %s\n' "$1" >&2; exit 2; }; }

while [ $# -gt 0 ]; do
  case "$1" in
    --references) need_value "$@"; REFS="$2"; shift 2 ;;
    --repo-root)  need_value "$@"; ROOT="$2"; shift 2 ;;
    --version)    need_value "$@"; VERSION="$2"; shift 2 ;;
    --dry-run)    DRY=1; shift ;;
    --remove)     REMOVE=1; shift ;;
    -h|--help)    sed -n '2,18p' "$0"; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

if [ -z "$ROOT" ]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="$PWD"
fi
[ -d "$ROOT" ] || { printf 'repo root not a directory: %s\n' "$ROOT" >&2; exit 2; }

if [ "$REMOVE" -eq 0 ]; then
  [ -n "$REFS" ] && [ -d "$REFS" ] || {
    printf 'references directory required and must exist (--references)\n' >&2; exit 2; }
  [ -f "$REFS/agents-block.md" ] || {
    printf 'references missing agents-block.md: %s\n' "$REFS" >&2; exit 2; }
fi

INSTR_FILES="AGENTS.md CLAUDE.md"

# Refuse before writing anything if any target's markers are unbalanced.
for name in $INSTR_FILES; do
  f="$ROOT/$name"
  [ -f "$f" ] || continue
  b=$(grep -c "$BEGIN_PAT" "$f" 2>/dev/null || true); b=${b:-0}
  e=$(grep -c "$END_PAT" "$f" 2>/dev/null || true);   e=${e:-0}
  if [ "$b" != "$e" ] || [ "$b" -gt 1 ]; then
    printf 'refusing: %s has %s BEGIN and %s END markers (expected 0/0 or 1/1)\n' "$name" "$b" "$e" >&2
    exit 3
  fi
done

say() { [ "$DRY" -eq 1 ] && printf '[dry-run] %s\n' "$*" || printf '%s\n' "$*"; }

strip_block() {  # $1=file -> stdout without the managed block
  awk -v bp="$BEGIN_PAT" -v ep="$END_PAT" '
    index($0, bp) { inb=1; next }
    inb && index($0, ep) { inb=0; next }
    inb { next }
    { print }
  ' "$1"
}

apply_block() {  # $1=file  $2=blockfile
  local f="$1" bf="$2" tmp
  tmp="$(mktemp)"
  if [ -f "$f" ] && grep -q "$BEGIN_PAT" "$f" 2>/dev/null; then
    awk -v bp="$BEGIN_PAT" -v ep="$END_PAT" -v bfile="$bf" '
      BEGIN { while ((getline l < bfile) > 0) blk = blk l "\n" }
      index($0, bp) { inb=1; printf "%s", blk; next }
      inb && index($0, ep) { inb=0; next }
      inb { next }
      { print }
    ' "$f" > "$tmp"
  elif [ -f "$f" ]; then
    { cat "$f"; printf '\n'; cat "$bf"; } > "$tmp"
  else
    cat "$bf" > "$tmp"
  fi
  if [ "$DRY" -eq 1 ]; then
    printf '[dry-run] would write %s:\n' "$f"
    diff -u "${f:-/dev/null}" "$tmp" 2>/dev/null | sed 's/^/    /' || true
    rm -f "$tmp"
  else
    mv "$tmp" "$f"
  fi
}

if [ "$REMOVE" -eq 1 ]; then
  for name in $INSTR_FILES; do
    f="$ROOT/$name"
    [ -f "$f" ] || continue
    grep -q "$BEGIN_PAT" "$f" 2>/dev/null || continue
    if [ "$DRY" -eq 1 ]; then say "would strip block from $name"; else
      tmp="$(mktemp)"; strip_block "$f" > "$tmp"; mv "$tmp" "$f"; say "stripped block from $name"
    fi
  done
  if [ "$DRY" -eq 1 ]; then say "would remove .ai-workflow/"; else
    rm -rf "$ROOT/.ai-workflow"; say "removed .ai-workflow/"
  fi
  say "templates/, docs/engineering/, and docs/understanding/ were left in place"
  exit 0
fi

# 1. managed block in both instruction files
for name in $INSTR_FILES; do
  apply_block "$ROOT/$name" "$REFS/agents-block.md"
  say "block applied to $name"
done

# 2. hook-invoked scripts + the enforcement checker
if [ "$DRY" -eq 0 ]; then
  mkdir -p "$ROOT/.ai-workflow/bin"
  if [ -d "$REFS/bin" ]; then
    cp "$REFS"/bin/* "$ROOT/.ai-workflow/bin/" 2>/dev/null || true
    chmod +x "$ROOT"/.ai-workflow/bin/*.sh 2>/dev/null || true
  fi
  printf '%s\n' "$VERSION" > "$ROOT/.ai-workflow/VERSION"
fi
say ".ai-workflow/bin populated, VERSION=$VERSION"

# 3-5. templates, engineering docs, gate artifact dir
if [ "$DRY" -eq 0 ]; then
  [ -d "$REFS/templates" ] && { mkdir -p "$ROOT/templates"; cp "$REFS"/templates/*.md "$ROOT/templates/" 2>/dev/null || true; }
  [ -d "$REFS/engineering" ] && { mkdir -p "$ROOT/docs/engineering"; cp "$REFS"/engineering/*.md "$ROOT/docs/engineering/" 2>/dev/null || true; }
  mkdir -p "$ROOT/docs/understanding"; : > "$ROOT/docs/understanding/.gitkeep"
fi
say "templates/, docs/engineering/, docs/understanding/ ready"

exit 0
