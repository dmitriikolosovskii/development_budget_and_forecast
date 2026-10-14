#!/bin/bash
# Run the whole app in the MAIN tree for a browser walkthrough (Playwright MCP `playwright-kairon`, /explore-app).
# Usage: app.sh up [--seed] | down | status
#   up      waits for the machine-wide `e2e` lock (the same one e2e.sh takes: both need ports 3454/4274), runs
#           `prisma migrate deploy` (+ `prisma db seed` with --seed; the seed never deletes), starts api :3454 and
#           web :4274 in their own process groups (logs in $APP_DIR), waits for both health URLs. The lock then
#           belongs to the api server's pid, so it lives exactly as long as the app.
#   down    stops both process groups, then `pkill -f "$MAIN/node_modules"` and `nx daemon --stop` (CLAUDE.md order),
#           releases the lock.
#   status  exit 0 = up, 3 = down.
# Exit: 0 ok · 1 failed to start (everything it started is stopped, lock released) · 2 usage / not the main tree.
# Env (tests): KAIRON_APP_DIR [/tmp/kairon-app], KAIRON_APP_{API,WEB}_CMD, KAIRON_APP_{API,WEB}_URL,
#              KAIRON_APP_TIMEOUT [180], KAIRON_APP_SKIP_DB=1.
. "$(dirname "$0")/lib.sh"

DIR="${KAIRON_APP_DIR:-/tmp/kairon-app}"
API_CMD="${KAIRON_APP_API_CMD:-npx nx serve api}"
WEB_CMD="${KAIRON_APP_WEB_CMD:-npx nx serve web}"
API_URL="${KAIRON_APP_API_URL:-http://localhost:3454/api/health}"
WEB_URL="${KAIRON_APP_WEB_URL:-http://localhost:4274/}"
TIMEOUT="${KAIRON_APP_TIMEOUT:-180}"
CMD="${1:-}"; SEED="${2:-}"
case "$CMD" in up | down | status) ;; *) die "usage: app.sh up [--seed] | down | status" 2 ;; esac

TOP=$(git rev-parse --show-toplevel 2>/dev/null) || die "not in a git repo" 2
[ "$(cd "$TOP" && pwd -P)" = "$(cd "$MAIN" && pwd -P)" ] || die "the app runs only in the main tree ($MAIN), not in $TOP (PROTOCOL §6)" 2
cd "$MAIN" || exit 2
mkdir -p "$DIR"

alive() { [ -f "$DIR/pids" ] && while read -r p; do kill -0 "$p" 2>/dev/null || return 1; done <"$DIR/pids"; }
ok_url() { curl -s -o /dev/null --max-time 2 "$1"; }
stop_all() {
  if [ -f "$DIR/pids" ]; then
    while read -r p; do kill -TERM -- "-$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null; done <"$DIR/pids"
    sleep 1
    while read -r p; do kill -KILL -- "-$p" 2>/dev/null; done <"$DIR/pids"
    rm -f "$DIR/pids"
  fi
  if [ -z "${KAIRON_SKIP_HEAVY:-}" ]; then
    pkill -f "$MAIN/node_modules" 2>/dev/null
    npx nx daemon --stop >/dev/null 2>&1
  fi
  release e2e
}

case "$CMD" in
  status)
    if alive && ok_url "$API_URL" && ok_url "$WEB_URL"; then echo "app: up — web $WEB_URL · api $API_URL"; exit 0; fi
    echo "app: down"; exit 3 ;;
  down)
    stop_all; log "app stopped"; exit 0 ;;
esac

# up
if alive; then log "app already up (pids $(tr '\n' ' ' <"$DIR/pids"))"; exit 0; fi
rm -f "$DIR/pids"
[ -e "$HOME/.claude/emu/pressure-critical" ] && die "memory pressure-critical flag is set: not starting the app" 1
log "waiting for the e2e lock (no e2e run or other app may hold the ports)"
acquire e2e
if [ -z "${KAIRON_APP_SKIP_DB:-}" ]; then
  (cd apps/api && npx prisma migrate deploy) >"$DIR/db.log" 2>&1 || { release e2e; die "prisma migrate deploy failed: $DIR/db.log" 1; }
  if [ "$SEED" = "--seed" ]; then
    (cd apps/api && npx prisma db seed) >>"$DIR/db.log" 2>&1 || { release e2e; die "prisma db seed failed: $DIR/db.log" 1; }
  fi
fi
set -m
nohup sh -c "$API_CMD" >"$DIR/api.log" 2>&1 &
echo $! >"$DIR/pids"
nohup sh -c "$WEB_CMD" >"$DIR/web.log" 2>&1 &
echo $! >>"$DIR/pids"
set +m
head -1 "$DIR/pids" >"$LOCK_ROOT/e2e/pid"

waited=0
until ok_url "$API_URL" && ok_url "$WEB_URL"; do
  if [ "$waited" -ge "$TIMEOUT" ] || ! alive; then
    echo "app did not become healthy in ${waited}s — logs: $DIR/api.log, $DIR/web.log" >&2
    tail -5 "$DIR/api.log" "$DIR/web.log" >&2 2>/dev/null
    stop_all; exit 1
  fi
  sleep 2; waited=$((waited + 2))
done
log "app up in ${waited}s — web $WEB_URL · api $API_URL · logs $DIR · stop with: bash howItWorks/bin/app.sh down"
