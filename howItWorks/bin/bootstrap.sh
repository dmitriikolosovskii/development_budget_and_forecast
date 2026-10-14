#!/bin/bash
# Idempotent: wait for the block's start gate, create its worktree + branch, install deps, migrate DB.
# Usage: bootstrap.sh <id>        (run with run_in_background — it may wait a long time for the gate)
# Exit: 0 ready (prints WT path), 1 error. Safe to re-run after a crash / session limit.
. "$(dirname "$0")/lib.sh"
load_block "$1"

if [ ! -e "$WT/.git" ]; then
  if ! all_flags "$GATES"; then
    set_status "$ID" waiting-gate "start gate:$(missing_flags "$GATES")"
    "$BIN/wait-for.sh" "$GATES" || exit 1
  fi
  acquire git
  if [ ! -e "$WT/.git" ]; then
    if git -C "$MAIN" show-ref --verify --quiet "refs/heads/$BRANCH"; then
      git -C "$MAIN" worktree add "$WT" "$BRANCH" || { release git; die "worktree add failed"; }
    else
      git -C "$MAIN" worktree add -b "$BRANCH" "$WT" "$BASE" || { release git; die "worktree add failed"; }
    fi
    event "WORKTREE $ID $WT from $BASE"
  fi
  release git
fi

[ -d "$WT/apps/api" ] && [ ! -f "$WT/apps/api/.env" ] && cp "$MAIN/apps/api/.env" "$WT/apps/api/.env"

# (re)install when node_modules is missing or older than the lock file
if [ ! -d "$WT/node_modules" ] || [ "$WT/package-lock.json" -nt "$WT/node_modules/.package-lock.json" ]; then
  set_status "$ID" installing "npm ci"
  [ -n "$KAIRON_SKIP_HEAVY" ] || "$BIN/heavy.sh" "$WT" npm ci --prefer-offline --no-audit --no-fund || die "npm ci failed"
fi

if [ -d "$WT/apps/api/prisma/migrations" ] && ls "$WT/apps/api/prisma/migrations" | grep -q '_'; then
  { [ -n "$KAIRON_SKIP_HEAVY" ] || (cd "$WT/apps/api" && npx prisma migrate deploy); } || die "prisma migrate deploy failed"
fi

set_status "$ID" in-progress "worktree ready"
log "READY  block=$ID  WT=$WT  branch=$BRANCH"
echo "$WT"
