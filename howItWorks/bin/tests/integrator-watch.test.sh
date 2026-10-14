#!/bin/bash
# Tests integrator-watch.sh in a sandbox (AC-00.5..00.13 of 00-integrator/DESIGN.md). Bash 3.2.
BIN="$(cd "$(dirname "$0")/.." && pwd)"
W="$BIN/integrator-watch.sh"
T=$(mktemp -d "${TMPDIR:-/tmp}/watch-test.XXXXXX"); trap 'rm -rf "$T"' EXIT
export KAIRON_MAIN="$T/main" KAIRON_STATE="$T/state" KAIRON_WT_ROOT="$T/wt" KAIRON_LOCK_ROOT="$T/locks"
export KAIRON_SKIP_HEAVY=1 KAIRON_WATCH_INTERVAL=1
M="$T/main"; S="$T/state"; CRD="$M/howItWorks/shared/change-requests"
mkdir -p "$CRD" "$S"
git -C "$M" init -q; git -C "$M" config user.email t@t; git -C "$M" config user.name t
echo readme > "$CRD/README.md"; touch -t 202601010000 "$CRD/README.md"
git -C "$M" add -A; git -C "$M" commit -qm init
FAILS=0
is() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 — got '$2', want '$3'"; FAILS=$((FAILS + 1)); fi; }
has() { case "$2" in *"$3"*) echo "ok   $1";; *) echo "FAIL $1 — '$3' not in: $2"; FAILS=$((FAILS + 1));; esac; }
once() { OUT=$(bash "$W" --once 2>&1); RC=$?; }
ev() { echo "2026-10-14 11:00:00 $*" >> "$S/events.log"; }

# AC-00.5 idle
once; is "AC-00.5 idle --once exits 3" $RC 3; is "AC-00.5 idle prints nothing" "$OUT" ""

# AC-00.6 change requests
echo cr > "$CRD/CR-04-x.md"
once; is "AC-00.6 a fresh CR (<10 s) is ignored" $RC 3
touch -t 202601010000 "$CRD/CR-04-x.md"
once; is "AC-00.6 an aged CR is reported" $RC 0; has "AC-00.6 prints CR <file>" "$OUT" "CR CR-04-x.md"
bash "$W" --ack >/dev/null; once; is "AC-00.6 acked CR is quiet" $RC 3
echo cr2 > "$CRD/CR-05-y.md"; touch -t 202601010000 "$CRD/CR-05-y.md"
once; has "AC-00.6 second CR reported" "$OUT" "CR CR-05-y.md"
echo "- Status: accepted" >> "$CRD/CR-05-y.md"; touch -t 202601010100 "$CRD/CR-05-y.md"   # integrator edits it before acking
echo cr3 > "$CRD/CR-06-z.md"; touch -t 202601010000 "$CRD/CR-06-z.md"                    # a new CR arrives before the ack
bash "$W" --ack >/dev/null; once
case "$OUT" in *CR-05-y*) is "AC-00.6 own edit of a reported CR is acked" reported quiet;; *) is "AC-00.6 own edit of a reported CR is acked" quiet quiet;; esac
has "AC-00.6 a CR that arrived before the ack is still reported" "$OUT" "CR CR-06-z.md"
bash "$W" --ack >/dev/null

# AC-00.7 merges, own events ignored
ev "FLAG 00.merged abc"; ev "STATUS 00 merged into main"
once; is "AC-00.7 own 00 events are ignored" $RC 3
ev "FLAG 04.merged 1a2b3c"
once; has "AC-00.7 MERGED NN" "$OUT" "MERGED 04 1a2b3c"; bash "$W" --ack >/dev/null

# AC-00.8 statuses
ev "STATUS 05 in-progress table done"; ev "STATUS 05 waiting-merge merge-after: 03.merged"
once; is "AC-00.8 routine statuses are quiet" $RC 3
ev "STATUS 05 conflict merge main conflicted"; ev "STATUS 06 check-failed after merging main"; ev "STATUS 07 main-dirty .claude/x"
once; has "AC-00.8 conflict" "$OUT" "STATUS 05 conflict merge main conflicted"
has "AC-00.8 check-failed" "$OUT" "STATUS 06 check-failed"; has "AC-00.8 main-dirty" "$OUT" "STATUS 07 main-dirty"

# AC-00.11 no ack -> the same events again (survives a killed run); ack -> quiet
once; has "AC-00.11 unacked events repeat" "$OUT" "STATUS 05 conflict"
bash "$W" --ack >/dev/null; once; is "AC-00.11 acked events are quiet" $RC 3

# AC-00.9 main.broken, w0-frozen
ev "FLAG main.broken red after merge"; ev "FLAG w0-frozen 9f9f9f"
once; has "AC-00.9 main.broken" "$OUT" "FLAG main.broken"; has "AC-00.9 w0-frozen" "$OUT" "FLAG w0-frozen"
bash "$W" --ack >/dev/null

# AC-00.10 dirt outside howItWorks only, by fingerprint
echo x > "$M/howItWorks/notes.md"
once; is "AC-00.10 dirt inside howItWorks is quiet" $RC 3
echo x > "$M/SOLUTION.md"
once; is "AC-00.10 dirt outside howItWorks exits 0" $RC 0; has "AC-00.10 DIRTY lists the path" "$OUT" "DIRTY"; has "AC-00.10 path" "$OUT" "SOLUTION.md"
bash "$W" --ack >/dev/null; once; is "AC-00.10 the same dirt after ack is quiet" $RC 3
echo y > "$M/other.txt"
once; is "AC-00.10 more dirt in the same dirty episode is quiet (blocked merges come as STATUS main-dirty)" $RC 3
rm -f "$M/SOLUTION.md" "$M/other.txt"; once; is "AC-00.10 clean main is quiet" $RC 3
echo z > "$M/again.txt"
once; is "AC-00.10 dirt after a clean main is reported again" $RC 0; has "AC-00.10 the new episode lists its path" "$OUT" "again.txt"
bash "$W" --ack >/dev/null; rm -f "$M/again.txt"; once

# AC-00.12 blocking mode, usage
( sleep 2; ev "FLAG 08.merged 0808" ) &
OUT=$(bash "$W" 2>&1); RC=$?; wait
is "AC-00.12 blocking mode exits 0 on an event" $RC 0; has "AC-00.12 blocking mode prints it" "$OUT" "MERGED 08"
bash "$W" --bogus >/dev/null 2>&1; is "AC-00.12 unknown argument exits 2" $? 2
/bin/bash -n "$W" 2>/dev/null; RCB=$?; is "AC-00.12 parses under /bin/bash 3.2" $RCB 0

# AC-00.13 merge-block.sh records main-dirty before refusing (check.sh passes: no changes, heavy steps skipped)
git -C "$M" checkout -qb main 2>/dev/null || git -C "$M" checkout -q main
git -C "$M" add -A; git -C "$M" commit -qm dirt-committed
git -C "$M" worktree add -q -b feat/04-building-materials "$T/wt/04-building-materials" main
echo dirty > "$M/dirty.txt"
bash "$BIN/merge-block.sh" 04 >/dev/null 2>&1; RCM=$?
is "AC-00.13 merge-block refuses a dirty main" $RCM 1
has "AC-00.13 status says main-dirty" "$(cat "$S/04.status" 2>/dev/null)" "main-dirty"

[ "$FAILS" = 0 ] && { echo "integrator-watch tests: PASS"; exit 0; }
echo "integrator-watch tests: $FAILS FAILED"; exit 1
