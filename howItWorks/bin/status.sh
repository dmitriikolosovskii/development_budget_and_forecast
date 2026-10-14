#!/bin/bash
# Print the live board: per-block status lines, flags, locks, last events.
. "$(dirname "$0")/lib.sh"
echo "== blocks =="
while IFS='|' read -r id slug gates base mafter owned; do
  case "$id" in ''|\#*) continue;; esac
  if [ -f "$STATE/$id.status" ]; then cat "$STATE/$id.status"
  else
    g="waiting for:$(missing_flags "$gates")"; all_flags "$gates" && g="gate open"
    echo "$id | $slug | not started | - | - | $g"
  fi
done < "$CONF"
echo "== flags =="
ls "$STATE" 2>/dev/null | grep '\.flag$' | sed 's/\.flag$//' | tr '\n' ' '; echo
echo "== locks =="
ls "$LOCK_ROOT" 2>/dev/null | tr '\n' ' '; echo
echo "== last events =="
tail -n "${1:-15}" "$STATE/events.log" 2>/dev/null
