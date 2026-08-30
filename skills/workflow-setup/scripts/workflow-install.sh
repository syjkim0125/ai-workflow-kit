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
#   3  refused — the target's markers are unbalanced, out of order, or the
#      block content to install is missing/empty; not guessing

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
    -h|--help)    sed -n '2,17p' "$0"; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

if [ -z "$ROOT" ]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || ROOT="$PWD"
fi
[ -d "$ROOT" ] || { printf 'repo root not a directory: %s\n' "$ROOT" >&2; exit 2; }

# Count BEGIN/END markers in $1. Fence tracking (``` toggles fence state)
# applies ONLY outside a managed block — a doc example that quotes our own
# markers must not be mistaken for a live block. Once a live BEGIN is seen,
# everything up to its closing END is block content, fences included: fences
# inside the block must never suppress recognition of that closing END, or
# the block's own fenced content leaks past the boundary on rewrite. Prints
# "B E OK" where OK is 1 unless exactly one BEGIN/END pair exists and the END
# appears before the BEGIN.
count_markers() {
  awk -v bp="$BEGIN_PAT" -v ep="$END_PAT" '
    function is_fence(l) { return l ~ /^[ \t]*```/ }
    {
      if (inb) {
        if (index($0, ep)) { e++; if (eline == 0) eline = NR; inb = 0 }
        next
      }
      if (is_fence($0)) { fence = !fence; next }
      if (fence) next
      if (index($0, bp)) { b++; if (bline == 0) bline = NR; inb = 1 }
    }
    END {
      ok = 1
      if (b == 1 && e == 1 && eline < bline) ok = 0
      printf "%d %d %d\n", b, e, ok
    }
  ' "$1"
}

if [ "$REMOVE" -eq 0 ]; then
  [ -n "$REFS" ] && [ -d "$REFS" ] || {
    printf 'references directory required and must exist (--references)\n' >&2; exit 2; }
  [ -f "$REFS/agents-block.md" ] || {
    printf 'references missing agents-block.md: %s\n' "$REFS" >&2; exit 2; }
  [ -r "$REFS/agents-block.md" ] || {
    printf 'references block file not readable: %s\n' "$REFS/agents-block.md" >&2; exit 2; }
  [ -s "$REFS/agents-block.md" ] || {
    printf 'references block file is empty: %s\n' "$REFS/agents-block.md" >&2; exit 2; }
  # Non-empty is not a strong enough test: the block file's one job is to BE a
  # well-formed block. Whitespace-only content passes -s but installs nothing,
  # silently leaving the target permanently non-idempotent (every future run
  # sees no markers and appends again). Require exactly one BEGIN/END pair,
  # BEGIN first, before any branch runs.
  read -r rb re rok < <(count_markers "$REFS/agents-block.md")
  if [ "$rb" -ne 1 ] || [ "$re" -ne 1 ] || [ "$rok" -eq 0 ]; then
    printf 'refusing: %s is not a well-formed block (need exactly one BEGIN and one END, BEGIN before END)\n' "$REFS/agents-block.md" >&2
    exit 2
  fi
fi

INSTR_FILES="AGENTS.md CLAUDE.md"

# Refuse before writing anything if any target's live markers are unbalanced
# or out of order (fenced doc examples of the markers don't count).
for name in $INSTR_FILES; do
  f="$ROOT/$name"
  [ -f "$f" ] || continue
  read -r b e ok < <(count_markers "$f")
  if [ "$b" != "$e" ] || [ "$b" -gt 1 ] || [ "$ok" -eq 0 ]; then
    printf 'refusing: %s has %s BEGIN and %s END markers outside fenced examples (expected 0/0 or 1/1, BEGIN before END)\n' "$name" "$b" "$e" >&2
    exit 3
  fi
done

say() { [ "$DRY" -eq 1 ] && printf '[dry-run] %s\n' "$*" || printf '%s\n' "$*"; }

# A tmp file for $1's replacement, staged in the SAME directory so the final
# mv is an atomic rename rather than a cross-filesystem copy-and-unlink.
stage_tmp() {
  local dir
  dir="$(dirname "$1")"
  mktemp "$dir/.ai-workflow-kit.tmp.XXXXXX"
}

# The target's current permission bits (octal), or 644 if it doesn't exist yet
# or its mode can't be read — never the umask-derived mode of a mktemp file.
target_mode() {
  local f="$1" m=""
  if [ -f "$f" ]; then
    m="$(perl -e 'printf "%04o", (stat($ARGV[0]))[2] & 07777' "$f" 2>/dev/null)"
  fi
  printf '%s' "${m:-644}"
}

strip_block() {  # $1=file -> stdout without the managed block
  # Fence tracking applies only outside the block: once inside, a fence
  # delimiter is block content like any other line and must not suppress
  # recognition of the closing END (see count_markers for why).
  awk -v bp="$BEGIN_PAT" -v ep="$END_PAT" '
    function is_fence(l) { return l ~ /^[ \t]*```/ }
    {
      if (inb) {
        if (index($0, ep)) inb = 0
        next
      }
      if (is_fence($0)) { fence = !fence; print; next }
      if (fence) { print; next }
      if (index($0, bp)) { inb = 1; next }
      print
    }
  ' "$1"
}

apply_block() {  # $1=file  $2=blockfile
  local f="$1" bf="$2" tmp b e ok mode
  tmp="$(stage_tmp "$f")"
  b=0
  if [ -f "$f" ]; then
    read -r b e ok < <(count_markers "$f")
  fi
  if [ -f "$f" ] && [ "$b" -ge 1 ]; then
    # Fence tracking applies only outside the block: once the live BEGIN is
    # seen, everything up to its closing END is old block content, fences
    # included, and must be discarded wholesale rather than have an internal
    # fence toggle state and start passing lines through again.
    awk -v bp="$BEGIN_PAT" -v ep="$END_PAT" -v bfile="$bf" '
      function is_fence(l) { return l ~ /^[ \t]*```/ }
      BEGIN {
        while ((getline l < bfile) > 0) blk = blk l "\n"
        if (blk == "") { print "refusing: block file produced no content" > "/dev/stderr"; exit 2 }
      }
      {
        if (inb) {
          if (index($0, ep)) inb = 0
          next
        }
        if (is_fence($0)) { fence = !fence; print; next }
        if (fence) { print; next }
        if (index($0, bp)) { inb = 1; printf "%s", blk; next }
        print
      }
    ' "$f" > "$tmp"
    if [ $? -ne 0 ]; then
      rm -f "$tmp"
      printf 'refusing: could not build replacement content for %s\n' "$f" >&2
      exit 2
    fi
  elif [ -f "$f" ]; then
    { cat "$f"; printf '\n'; cat "$bf"; } > "$tmp"
  else
    [ -s "$bf" ] || { rm -f "$tmp"; printf 'refusing: block file produced no content\n' >&2; exit 2; }
    cat "$bf" > "$tmp"
  fi
  mode="$(target_mode "$f")"
  chmod "$mode" "$tmp" 2>/dev/null || true
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
    read -r b e ok < <(count_markers "$f")
    [ "$b" -ge 1 ] || continue
    if [ "$DRY" -eq 1 ]; then say "would strip block from $name"; else
      tmp="$(stage_tmp "$f")"
      strip_block "$f" > "$tmp"
      chmod "$(target_mode "$f")" "$tmp" 2>/dev/null || true
      mv "$tmp" "$f"
      say "stripped block from $name"
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
