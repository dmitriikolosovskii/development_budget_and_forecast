#!/bin/bash
# Run a heavy command (npm ci, nx test/lint/typecheck/build, prisma generate) under a machine-wide
# semaphore so parallel sessions don't freeze the 24 GB MacBook.
# Usage: heavy.sh <dir> <command...>      e.g. heavy.sh "$WT" npx nx test web
# Slots: KAIRON_HEAVY_SLOTS (default 3). Waits while ~/.claude/emu/pressure-critical exists.
. "$(dirname "$0")/lib.sh"
DIR="$1"; shift
[ -d "$DIR" ] || die "no such dir: $DIR"
[ $# -gt 0 ] || die "usage: heavy.sh <dir> <command...>"
SLOTS="${KAIRON_HEAVY_SLOTS:-3}"
SLOT=""
said=""
while [ -z "$SLOT" ]; do
  if [ -e "$HOME/.claude/emu/pressure-critical" ]; then
    [ -z "$said" ] && log "memory pressure-critical flag present: waiting" && said=1
    sleep 15; continue
  fi
  i=1
  while [ $i -le "$SLOTS" ]; do
    if mkdir "$LOCK_ROOT/heavy-$i" 2>/dev/null; then
      echo $$ > "$LOCK_ROOT/heavy-$i/pid"; SLOT=$i; break
    fi
    p=$(cat "$LOCK_ROOT/heavy-$i/pid" 2>/dev/null)
    if [ -n "$p" ] && ! kill -0 "$p" 2>/dev/null; then rm -rf "$LOCK_ROOT/heavy-$i"; continue; fi
    i=$((i + 1))
  done
  if [ -z "$SLOT" ]; then
    [ -z "$said" ] && log "all $SLOTS heavy slots busy: waiting" && said=1
    sleep 3
  fi
done
trap 'rm -rf "$LOCK_ROOT/heavy-$SLOT"' EXIT INT TERM
export NX_DAEMON=false NX_TUI=false NX_NO_CLOUD=true
cd "$DIR" || exit 1
"$@"
