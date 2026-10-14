#!/bin/bash
# Block until every flag exists. Run it with run_in_background: you are re-invoked when it exits.
# Usage: wait-for.sh <flag[,flag...]> [timeout-seconds]     e.g. wait-for.sh w0-frozen
#        exit 0 = all present, exit 3 = timeout
. "$(dirname "$0")/lib.sh"
FLAGS="$1"; TIMEOUT="${2:-0}"
[ -n "$FLAGS" ] || die "usage: wait-for.sh <flag[,flag...]> [timeout]"
start=$(date +%s); last=0
until all_flags "$FLAGS"; do
  now=$(date +%s)
  if [ "$TIMEOUT" -gt 0 ] && [ $((now - start)) -ge "$TIMEOUT" ]; then
    log "timeout; still missing:$(missing_flags "$FLAGS")"; exit 3
  fi
  if [ $((now - last)) -ge 120 ]; then log "waiting for:$(missing_flags "$FLAGS")"; last=$now; fi
  sleep 15
done
log "ready: $FLAGS"
