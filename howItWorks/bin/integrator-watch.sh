#!/bin/bash
# Integrator only: wake the main-tree session when there is something to act on (00-integrator/DESIGN.md).
# Usage: integrator-watch.sh          block until ≥1 event, print the events, exit 0 (run_in_background)
#        integrator-watch.sh --once   one pass: exit 0 with events, 3 without
#        integrator-watch.sh --ack    accept the last printed events (they are repeated until acked)
# Events: MERGED NN <sha> · FLAG w0-frozen|main.broken · STATUS NN conflict|check-failed|main-dirty <note>
#         CR <file> (new or changed, ≥ KAIRON_CR_MIN_AGE s old) · DIRTY <paths> (main outside howItWorks/ became dirty)
# Interval: KAIRON_WATCH_INTERVAL (20 s). State: $STATE/integrator.* (git-ignored). Bash 3.2.
. "$(dirname "$0")/lib.sh"
INTERVAL="${KAIRON_WATCH_INTERVAL:-20}"
MIN_AGE="${KAIRON_CR_MIN_AGE:-10}"
CRD="$HIW/shared/change-requests"
P="$STATE/integrator"
EVLOG="$STATE/events.log"

if [ "${1:-}" = "--ack" ]; then
  [ -f "$P.pending" ] || { log "nothing to ack"; exit 0; }
  sed -n 's/^offset //p' "$P.pending" > "$P.offset"
  sed -n 's/^dirty //p' "$P.pending" > "$P.dirty"
  # CRs reported in this round are acked at their CURRENT mtime: the integrator's own edit (status line)
  # must not wake it again; a CR that appeared after the report is not in the list and stays news
  if [ -f "$P.pending.cr" ]; then
    while IFS="$(printf '\t')" read -r name m; do
      if grep -qxF "rep $name" "$P.pending"; then
        m=$(stat -f %m "$CRD/$name" 2>/dev/null || stat -c %Y "$CRD/$name" 2>/dev/null || echo "$m")
      fi
      printf '%s\t%s\n' "$name" "$m"
    done < "$P.pending.cr" > "$P.cr"
    rm -f "$P.pending.cr"
  fi
  rm -f "$P.pending"
  log "acked"
  exit 0
fi
case "${1:-}" in --once | "") ;; *) echo "usage: integrator-watch.sh [--once | --ack]" >&2; exit 2 ;; esac

# one_pass: prints the events, writes $P.pending (+ .cr); returns 0 when there are events
one_pass() {
  local off size new chunk now name m fp dirt out="" reps=""
  off=$(cat "$P.offset" 2>/dev/null); off=${off:-0}
  size=0; [ -f "$EVLOG" ] && size=$(wc -c < "$EVLOG" | tr -d ' ')
  [ "$size" -lt "$off" ] && off=0   # the log was recreated
  new=$off
  if [ "$size" -gt "$off" ]; then
    # only complete lines count: a line still being written is read next time
    chunk="$P.chunk"
    tail -c +$((off + 1)) "$EVLOG" | head -c $((size - off)) > "$chunk"
    [ "$(tail -c 1 "$chunk" | od -An -c | tr -d ' ')" = '\n' ] || { sed '$d' "$chunk" > "$chunk.tmp"; mv "$chunk.tmp" "$chunk"; }
    new=$((off + $(wc -c < "$chunk" | tr -d ' ')))
    out=$(awk < "$chunk" '
      $3 == "FLAG" && $4 ~ /^[0-9][0-9]\.merged$/ { id = substr($4, 1, 2); if (id != "00") print "MERGED " id " " $5; next }
      $3 == "FLAG" && ($4 == "w0-frozen" || $4 == "main.broken") { $1 = $2 = ""; sub(/^ +/, ""); print; next }
      $3 == "STATUS" && $4 != "00" && ($5 == "conflict" || $5 == "check-failed" || $5 == "main-dirty") { $1 = $2 = ""; sub(/^ +/, ""); print }')
  fi

  # change requests: name + mtime, only files old enough to be complete
  now=$(date +%s); : > "$P.pending.cr"
  for f in "$CRD"/CR-*.md; do
    [ -f "$f" ] || continue
    name=$(basename "$f"); m=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f")
    if [ $((now - m)) -lt "$MIN_AGE" ]; then
      grep "^$name	" "$P.cr" 2>/dev/null >> "$P.pending.cr"   # keep the acked entry, decide next time
      continue
    fi
    printf '%s\t%s\n' "$name" "$m" >> "$P.pending.cr"
    grep -qxF "$(printf '%s\t%s' "$name" "$m")" "$P.cr" 2>/dev/null || { out="$out${out:+$'\n'}CR $name"; reps="$reps${reps:+$'\n'}rep $name"; }
  done

  # main tree dirt outside howItWorks/: reported once per dirty episode (clean -> dirty). Growing dirt in the
  # same episode is quiet; a merge it actually blocks arrives as STATUS NN main-dirty
  dirt=$(git -C "$MAIN" status --porcelain -- . ':(exclude)howItWorks' 2>/dev/null)
  fp=""; [ -n "$dirt" ] && fp=dirty
  [ -z "$fp" ] && : > "$P.dirty"   # clean again: the next dirt is news
  if [ -n "$fp" ] && [ "$fp" != "$(cat "$P.dirty" 2>/dev/null)" ]; then
    out="$out${out:+$'\n'}DIRTY $(printf '%s' "$dirt" | awk '{print $NF}' | tr '\n' ' ')"
  fi

  printf 'offset %s\ndirty %s\n' "$new" "$fp" > "$P.pending"
  [ -n "$reps" ] && echo "$reps" >> "$P.pending"
  [ -n "$out" ] || return 1
  echo "$out"
  return 0
}

if [ "${1:-}" = "--once" ]; then one_pass && exit 0; exit 3; fi
while :; do
  one_pass && exit 0
  sleep "$INTERVAL"
done
