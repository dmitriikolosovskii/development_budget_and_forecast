#!/bin/bash
# Run ONCE by the owner (or with the owner's explicit permission): commit the current kit + plan to main
# and open the start gate for blocks 01 and 02.
. "$(dirname "$0")/lib.sh"
has_flag baseline && { log "baseline already done"; exit 0; }
[ "$(git -C "$MAIN" symbolic-ref --short HEAD)" = main ] || die "main tree is not on branch main"
acquire git
git -C "$MAIN" add -A
if ! git -C "$MAIN" diff --cached --quiet; then
  git -C "$MAIN" commit -m "chore: baseline kit and parallel implementation plan" \
    -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" || { release git; die "commit failed"; }
fi
release git
set_flag baseline "$(git -C "$MAIN" rev-parse --short HEAD)"
log "baseline committed: $(git -C "$MAIN" rev-parse --short HEAD). Blocks 01 and 02 may start."
