#!/bin/bash
# The block's definition-of-done gate (replaces /done-check inside a worktree). Judged by exit codes.
# Usage: check.sh <id> [--quick]   (--quick = skip build)
# Steps: ownership, no howItWorks edits, format, affected lint/test/typecheck(/build), test-weakening.
. "$(dirname "$0")/lib.sh"
load_block "$1"
QUICK="$2"
[ -e "$WT/.git" ] || die "worktree missing: run bootstrap.sh $ID"
cd "$WT" || exit 1
MB=$(git merge-base main HEAD)
FAIL=0
row() { printf '%-28s exit %s\n' "$1" "$2"; [ "$2" = 0 ] || FAIL=1; }

# Files THIS block changed: its own non-merge commits since the base (commits that came from other
# feat/* branches, e.g. 02 merging feat/01, are excluded) + uncommitted + untracked.
OTHERS=$(git for-each-ref --format='%(refname)' refs/heads/feat/ | grep -v "refs/heads/$BRANCH\$")
OWN_COMMITTED=$(git log --no-merges --name-only --pretty=format: "$MB..HEAD" --not $OTHERS | sort -u)
CHANGED=$( { echo "$OWN_COMMITTED"; git diff --name-only HEAD; git ls-files --others --exclude-standard; } | grep -v '^$' | sort -u)

# 1. ownership: every changed path must match an owned glob; howItWorks/ is never edited in a worktree
BAD=""
set -f   # OWNED holds patterns: never let the shell expand them against real files
for f in $CHANGED; do
  ok=""
  for g in $OWNED; do [[ "$f" == $g ]] && ok=1 && break; done
  case "$f" in howItWorks/*) ok="";; esac
  [ -z "$ok" ] && BAD="$BAD $f"
done
set +f
if [ -n "$BAD" ]; then echo "Files outside block $ID ownership (revert, or write a CR for the integrator):"; for f in $BAD; do echo "  $f"; done; row ownership 1; else row ownership 0; fi

# 2. format: the formatter must not leave changes behind
before=$(git status --porcelain | md5)
fmt=0
[ -z "$KAIRON_SKIP_HEAVY" ] && { NX_DAEMON=false npx nx format:write --uncommitted >/dev/null 2>&1; fmt=$?; }
after=$(git status --porcelain | md5)
if [ $fmt = 0 ] && [ "$before" != "$after" ]; then echo "Formatter changed files: review, commit, re-run."; fmt=1; fi
row format $fmt

# 3. affected lint/test/typecheck(/build) against the merge base with main
T="lint,test,typecheck"; [ "$QUICK" = "--quick" ] || T="lint,test,typecheck,build"
if [ -z "$KAIRON_SKIP_HEAVY" ]; then "$BIN/heavy.sh" "$WT" npx nx affected -t "$T" --base="$MB" --outputStyle=static; row "affected $T" $?; else row "affected (skipped)" 0; fi

# 4. test-weakening in this block's own spec files (removed expect, skip/only/fixme/todo, x-prefixed)
SPECS=$(echo "$CHANGED" | grep -E '\.spec\.tsx?$' || true)
# deliberate rewrites approved in the block's BLOCK.md are listed (one path per line) in state/<id>.spec-rewrite
if [ -f "$STATE/$ID.spec-rewrite" ]; then SPECS=$(echo "$SPECS" | grep -vxF -f "$STATE/$ID.spec-rewrite" || true); fi
W=""
[ -n "$SPECS" ] && W=$(git diff "$MB" -- $SPECS | weakening_lines)
if [ -n "$W" ]; then echo "Possible test weakening (fix it, or justify a deliberate rewrite in the commit message and tell the owner):"; echo "$W" | head -20; row test-weakening 1; else row test-weakening 0; fi

[ $FAIL = 0 ] && { set_status "$ID" checked "check.sh green"; echo "CHECK: PASS"; exit 0; }
echo "CHECK: FAIL"; exit 1
