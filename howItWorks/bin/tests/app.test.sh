#!/bin/bash
# Tests app.sh: main tree only, up/down/status with fake servers, the e2e lock lives as long as the app.
APP="$(cd "$(dirname "$0")/.." && pwd)/app.sh"
T=$(mktemp -d "${TMPDIR:-/tmp}/app-test.XXXXXX")
P1=$((20000 + RANDOM % 20000)); P2=$((P1 + 1))
cleanup() { pkill -f "http.server $P1" 2>/dev/null; pkill -f "http.server $P2" 2>/dev/null; rm -rf "$T"; }
trap cleanup EXIT
export KAIRON_MAIN="$T/main" KAIRON_STATE="$T/state" KAIRON_WT_ROOT="$T/wt" KAIRON_LOCK_ROOT="$T/locks" KAIRON_SKIP_HEAVY=1
export KAIRON_APP_DIR="$T/app" KAIRON_APP_SKIP_DB=1 KAIRON_APP_TIMEOUT=20
export KAIRON_APP_API_CMD="python3 -m http.server $P1" KAIRON_APP_API_URL="http://localhost:$P1/"
export KAIRON_APP_WEB_CMD="python3 -m http.server $P2" KAIRON_APP_WEB_URL="http://localhost:$P2/"
mkdir -p "$T/main" "$T/other"; git -C "$T/main" init -q; git -C "$T/other" init -q
FAILS=0
is() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 — got '$2', want '$3'"; FAILS=$((FAILS + 1)); fi; }
up() { curl -s -o /dev/null "$1"; }

(cd "$T/other" && bash "$APP" up >/dev/null 2>&1); is "refuses outside the main tree" $? 2
(cd "$T/main" && bash "$APP" status >/dev/null 2>&1); is "status when down" $? 3
(cd "$T/main" && bash "$APP" bogus >/dev/null 2>&1); is "unknown command" $? 2

(cd "$T/main" && bash "$APP" up >/dev/null 2>&1); is "up exits 0" $? 0
up "$KAIRON_APP_API_URL"; is "api answers" $? 0
up "$KAIRON_APP_WEB_URL"; is "web answers" $? 0
(cd "$T/main" && bash "$APP" status >/dev/null 2>&1); is "status when up" $? 0
mkdir "$T/locks/e2e" 2>/dev/null; is "e2e lock is held while the app runs" $? 1
kill -0 "$(cat "$T/locks/e2e/pid")" 2>/dev/null; is "lock pid is a live server, not the exited app.sh" $? 0
(cd "$T/main" && bash "$APP" up >/dev/null 2>&1); is "second up is a no-op" $? 0

(cd "$T/main" && bash "$APP" down >/dev/null 2>&1); is "down exits 0" $? 0
sleep 1; up "$KAIRON_APP_API_URL"; [ $? = 0 ]; is "api stopped" $? 1
[ -d "$T/locks/e2e" ]; is "lock released" $? 1

export KAIRON_APP_API_CMD="sleep 30" KAIRON_APP_API_URL="http://localhost:$P1/" KAIRON_APP_TIMEOUT=3
(cd "$T/main" && bash "$APP" up >/dev/null 2>&1); is "up fails when health never comes" $? 1
[ -d "$T/locks/e2e" ]; is "failed up releases the lock" $? 1
pgrep -f "^sleep 30$" >/dev/null; is "failed up kills what it started" $? 1

[ "$FAILS" = 0 ] && { echo "app tests: PASS"; exit 0; }
echo "app tests: $FAILS FAILED"; exit 1
