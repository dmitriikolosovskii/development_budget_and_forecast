#!/bin/bash
# Leave a note for another block's session (appends atomically; read with: note.sh --read <your-id>).
# Usage: note.sh <to-id> <from-id> <message...>     e.g. note.sh 04 05 "useSchedule returns delayDays now"
. "$(dirname "$0")/lib.sh"
if [ "$1" = "--read" ]; then cat "$STATE/inbox-$2.log" 2>/dev/null || echo "(inbox $2 empty)"; exit 0; fi
to="$1"; from="$2"; shift 2
[ -n "$to" ] && [ -n "$from" ] && [ -n "$*" ] || die "usage: note.sh <to-id> <from-id> <message>"
echo "$(date '+%H:%M') from $from: $*" >> "$STATE/inbox-$to.log"
event "NOTE $from->$to $*"
