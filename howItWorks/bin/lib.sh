#!/bin/bash
# Shared helpers for parallel block sessions. Source it: . "$(dirname "$0")/lib.sh"
# macOS bash 3.2 compatible (no associative arrays).

MAIN="${KAIRON_MAIN:-/Users/dmitriyluba/WebstormProjects/Interview/Kairon}"
HIW="$MAIN/howItWorks"
BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="${KAIRON_STATE:-$HIW/state}"
WT_ROOT="${KAIRON_WT_ROOT:-/Users/dmitriyluba/WebstormProjects/Interview/Kairon-wt}"
LOCK_ROOT="${KAIRON_LOCK_ROOT:-/tmp/kairon-locks}"
# KAIRON_SKIP_HEAVY=1 skips npm ci / nx runs (only for testing these scripts in a sandbox)
CONF="$BIN/blocks.conf"
mkdir -p "$STATE" "$LOCK_ROOT" "$WT_ROOT"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit "${2:-1}"; }
event() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$STATE/events.log"; }

has_flag() { [ -e "$STATE/$1.flag" ]; }
set_flag() { : > "$STATE/$1.flag"; event "FLAG $1 ${2:-}"; }

# all_flags "a,b,c" -> 0 if every flag exists (empty list = true)
all_flags() {
  local list="$1" f
  [ -z "$list" ] && return 0
  for f in $(echo "$list" | tr ',' ' '); do has_flag "$f" || return 1; done
  return 0
}
missing_flags() {
  local list="$1" f out=""
  for f in $(echo "$list" | tr ',' ' '); do has_flag "$f" || out="$out $f"; done
  echo "$out"
}

# weakening_lines: reads a unified diff of spec files on stdin, prints the lines that weaken tests
# (a removed expect, an added skip/only/fixme/todo or x-prefixed it/test/describe). Used by check.sh.
weakening_lines() {
  grep -E '^-[^-].*expect\(|^\+.*\.(skip|only|fixme|todo)[[:space:]]*\(|^\+(.*[^A-Za-z0-9_.])?x(it|test|describe)[[:space:]]*\(' || true
}

# load_block <id or slug>  -> sets ID SLUG GATES BASE MERGE_AFTER OWNED WT BRANCH
load_block() {
  local key="${1%%-*}" line
  line=$(grep -E "^${key}\|" "$CONF") || die "unknown block '$1' (see $CONF)"
  IFS='|' read -r ID SLUG GATES BASE MERGE_AFTER OWNED <<< "$line"
  WT="$WT_ROOT/$SLUG"
  BRANCH="feat/$SLUG"
}

# Locks: mkdir is atomic; the holder's pid is recorded; a dead holder's lock is reclaimed.
acquire() {
  local name="$1" p
  while :; do
    if mkdir "$LOCK_ROOT/$name" 2>/dev/null; then echo $$ > "$LOCK_ROOT/$name/pid"; return 0; fi
    p=$(cat "$LOCK_ROOT/$name/pid" 2>/dev/null)
    if [ -n "$p" ] && ! kill -0 "$p" 2>/dev/null; then rm -rf "$LOCK_ROOT/$name"; continue; fi
    sleep 2
  done
}
release() { rm -rf "$LOCK_ROOT/$1"; }

# set_status <id> <state> <note...> -> one-line status file owned by the block
set_status() {
  local id="$1" st="$2"; shift 2
  local sha=""
  load_block "$id"
  [ -e "$WT/.git" ] && sha=$(git -C "$WT" rev-parse --short HEAD 2>/dev/null)
  echo "$id | $SLUG | $st | ${sha:--} | $(date '+%H:%M') | $*" > "$STATE/$id.status"
  event "STATUS $id $st $*"
}
