#!/bin/bash
# Self-service integration of a finished block into main (no separate integrator needed).
# Usage: merge-block.sh <id>     (run with run_in_background: it may wait for merge-after flags)
# 1) wait for merge-after flags  2) merge main into the branch  3) check.sh  4) under the git lock:
#    main must be an ancestor of the branch (else repeat) -> merge --no-ff into main -> flags.
# Exit: 0 merged, 1 error, 4 worktree dirty, 5 merge conflict (resolve in the worktree, re-run).
. "$(dirname "$0")/lib.sh"
load_block "$1"
[ -e "$WT/.git" ] || die "worktree missing"
has_flag "$ID.merged" && { log "already merged"; exit 0; }
[ -z "$(git -C "$WT" status --porcelain)" ] || die "worktree has uncommitted changes: commit first" 4

if ! all_flags "$MERGE_AFTER"; then
  set_status "$ID" waiting-merge "merge-after:$(missing_flags "$MERGE_AFTER")"
  "$BIN/wait-for.sh" "$MERGE_AFTER" || exit 1
fi

for attempt in 1 2 3 4 5; do
  while has_flag main.broken; do log "main.broken is set: waiting"; sleep 20; done
  before=$(git -C "$WT" rev-parse HEAD)
  if ! git -C "$WT" merge main --no-edit; then
    set_status "$ID" conflict "merge main conflicted"
    die "conflict merging main into $BRANCH. Resolve ONLY your own files in $WT, commit, re-run. If the conflict is in another block's file: git -C $WT merge --abort and report." 5
  fi
  if ! git -C "$WT" diff --quiet "$before" HEAD -- package-lock.json; then
    [ -n "$KAIRON_SKIP_HEAVY" ] || "$BIN/heavy.sh" "$WT" npm ci --prefer-offline --no-audit --no-fund || die "npm ci failed"
  fi
  if ! git -C "$WT" diff --quiet "$before" HEAD -- apps/api/prisma/migrations; then
    { [ -n "$KAIRON_SKIP_HEAVY" ] || (cd "$WT/apps/api" && npx prisma migrate deploy); } || die "migrate deploy failed"
  fi
  "$BIN/check.sh" "$ID" || { set_status "$ID" check-failed "after merging main"; die "check.sh failed after merging main: fix in the worktree, commit, re-run"; }

  acquire git
  if ! git -C "$MAIN" merge-base --is-ancestor main "$BRANCH"; then
    release git; log "main moved during checks: repeating (attempt $attempt)"; continue
  fi
  DIRTY=$(git -C "$MAIN" status --porcelain -- . ':(exclude)howItWorks')
  if [ -n "$DIRTY" ]; then
    release git; set_status "$ID" main-dirty "$(echo "$DIRTY" | awk '{print $NF}' | tr '\n' ' ')"
    die "main tree has uncommitted changes outside howItWorks/: $DIRTY"
  fi
  if ! git -C "$MAIN" merge --no-ff "$BRANCH" -m "merge: $SLUG" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"; then
    git -C "$MAIN" merge --abort 2>/dev/null; release git; die "merge into main failed unexpectedly"
  fi
  set_flag "$ID.merged" "$(git -C "$MAIN" rev-parse --short HEAD)"
  if [ "$ID" = "02" ] && has_flag 01.merged && ! has_flag w0-frozen; then
    git -C "$MAIN" tag -f w0-frozen && set_flag w0-frozen "$(git -C "$MAIN" rev-parse --short HEAD)"
  fi
  release git
  set_status "$ID" merged "into main $(git -C "$MAIN" rev-parse --short HEAD)"
  # keep the main tree runnable for the owner / integrator
  if ! git -C "$MAIN" diff --quiet HEAD~1 HEAD -- package-lock.json; then
    [ -n "$KAIRON_SKIP_HEAVY" ] || "$BIN/heavy.sh" "$MAIN" npm ci --prefer-offline --no-audit --no-fund
  fi
  if ! git -C "$MAIN" diff --quiet HEAD~1 HEAD -- apps/api/prisma/migrations; then
    { [ -n "$KAIRON_SKIP_HEAVY" ] || (cd "$MAIN/apps/api" && npx prisma migrate deploy); }
  fi
  log "MERGED $SLUG"
  exit 0
done
die "main kept moving; re-run merge-block.sh $ID"
