#!/bin/bash
# The only way to run e2e (or anything that needs the app on 3454/4274/4300): main tree only, one runner
# on the machine (mkdir lock "e2e" from lib.sh, held for the whole run), heavy-slot semaphore.
# Usage: e2e.sh [--grep RE]      run Playwright (list + JSON report), then ac-ledger.sh --e2e-report
#        e2e.sh --exec CMD...    run CMD under the same lock (exploratory scripts, a manual serve check)
# Report: $KAIRON_E2E_REPORT (default /tmp/kairon-e2e/report.json, raw, overwritten). Every run also leaves a record
# docs/test-runs/<stamp>-e2e.md (verdict, commit, ledger rows that are not OK, failed tests) and, after a fully green
# FULL run, grows docs/test-runs/ledger-baseline.txt (the regression ratchet read by ac-ledger.sh). Both are committed
# at once via main-commit.sh so the main tree stays clean for merge-block.sh (KAIRON_E2E_NO_COMMIT=1 skips that).
# A --grep run is partial: the ledger is informational and the baseline is not touched.
# Exit: the worst of Playwright and ledger (ledger ignored for --grep); 2 = usage / not the main tree.
# KAIRON_E2E_CMD replaces the Playwright command (tests only; it must write $PLAYWRIGHT_JSON_OUTPUT_NAME).
. "$(dirname "$0")/lib.sh"

GREP="" EXEC=""
case "${1:-}" in
  --grep) GREP="${2:-}"; [ -n "$GREP" ] || die "--grep wants a pattern" 2 ;;
  --exec) EXEC=1; shift; [ $# -gt 0 ] || die "--exec wants a command" 2 ;;
  "") ;;
  *) die "unknown argument: $1 (usage: e2e.sh [--grep RE] | --exec CMD...)" 2 ;;
esac

TOP=$(git rev-parse --show-toplevel 2>/dev/null) || die "not in a git repo" 2
[ "$(cd "$TOP" && pwd -P)" = "$(cd "$MAIN" && pwd -P)" ] || die "e2e runs only in the main tree ($MAIN), not in $TOP (PROTOCOL §7)" 2
cd "$MAIN" || exit 2

[ -s "${KAIRON_APP_DIR:-/tmp/kairon-app}/pids" ] && log "the app from app.sh holds the lock: run bash howItWorks/bin/app.sh down"
log "waiting for the e2e lock"
acquire e2e
trap 'release e2e' EXIT
log "e2e lock taken"

if [ -n "$EXEC" ]; then "$@"; exit $?; fi

REPORT="${KAIRON_E2E_REPORT:-/tmp/kairon-e2e/report.json}"
RUNS="$MAIN/docs/test-runs"; BASE="$RUNS/ledger-baseline.txt"
STAMP=$(date '+%Y-%m-%d-%H%M%S'); REC="$RUNS/$STAMP-e2e.md"
mkdir -p "$(dirname "$REPORT")" "$RUNS"; rm -f "$REPORT"
if [ -n "${KAIRON_E2E_CMD:-}" ]; then
  set -- sh -c "$KAIRON_E2E_CMD"
else
  # --skip-nx-cache: a cached e2e target replays old output and never writes the JSON report
  set -- npx nx e2e web-e2e --outputStyle=static --skip-nx-cache -- --reporter=list,json
  [ -n "$GREP" ] && set -- "$@" --grep "$GREP"
fi
PLAYWRIGHT_JSON_OUTPUT_NAME="$REPORT" "$BIN/heavy.sh" "$MAIN" "$@"
PW=$?
row() { printf '%-22s exit %s\n' "$1" "$2"; }
row "playwright" $PW
if [ -s "$REPORT" ]; then
  LEDGER=$(bash "$BIN/ac-ledger.sh" --root "$MAIN" --e2e-report "$REPORT"); LG=$?
  FAILED=$(node "$BIN/pw-report.js" "$REPORT" | awk -F'\t' '$1 != "passed" { print "- " $1 ": " $2 }')
else
  LEDGER="no JSON report at $REPORT (Playwright did not start: infrastructure)"; LG=1; FAILED=""
fi
echo "$LEDGER" | grep -vE '^(OK|MANUAL) '
row "ac-ledger --e2e-report" $LG

if [ -n "$GREP" ]; then
  SCOPE="partial run (--grep '$GREP'): the ledger is informational, the baseline is untouched"
  [ $PW = 0 ] && VERDICT=PASS || VERDICT=FAIL
else
  SCOPE="full suite"
  [ $PW = 0 ] && [ $LG = 0 ] && VERDICT=PASS || VERDICT=FAIL
fi
BASENOTE="unchanged (the run is not a green full run)"
if [ -z "$GREP" ] && [ "$VERDICT" = PASS ]; then
  bash "$BIN/ac-ledger.sh" --root "$MAIN" --e2e-report "$REPORT" --write-baseline "$BASE" >/dev/null
  BASENOTE="grown to $(grep -c '^AC-' "$BASE") proven ACs"
fi
DIRTY=$(git status --porcelain -- . ':(exclude)docs/test-runs' | wc -l | tr -d ' ')
{
  echo "# e2e run $(date '+%Y-%m-%d %H:%M:%S') — $VERDICT"
  echo
  echo "- main: $(git rev-parse --short HEAD) (uncommitted files outside docs/test-runs: $DIRTY)"
  echo "- scope: $SCOPE"
  echo "- playwright exit $PW · ac-ledger exit $LG"
  echo "- baseline: $BASENOTE"
  echo
  echo "## Ledger (rows that are not OK/MANUAL, then SUMMARY)"
  echo
  echo '```'
  echo "$LEDGER" | grep -vE '^(OK|MANUAL) '
  echo '```'
  echo
  echo "## e2e tests that did not pass"
  echo
  [ -n "$FAILED" ] && echo "$FAILED" || echo "none"
} >"$REC"
echo "record: ${REC#$MAIN/}"
if [ -z "${KAIRON_E2E_NO_COMMIT:-}" ]; then
  # the baseline exists only after the first green full run; git add fails on a missing path
  COMMIT_PATHS=("$REC"); [ -e "$BASE" ] && COMMIT_PATHS+=("$BASE")
  "$BIN/main-commit.sh" "test(run): e2e $STAMP $VERDICT" "${COMMIT_PATHS[@]}" >/dev/null 2>&1 \
    || echo "WARNING: could not commit ${REC#$MAIN/}: commit it with bin/main-commit.sh (the main tree must stay clean for merges)"
fi
echo "E2E: $VERDICT"
[ "$VERDICT" = PASS ]
