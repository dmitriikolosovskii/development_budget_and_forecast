#!/bin/bash
# Integrator/owner only: commit selected paths to main under the shared git lock (never races a block merge).
# Usage: main-commit.sh "<message>" <path...>     e.g. main-commit.sh "docs: block designs" howItWorks docs
. "$(dirname "$0")/lib.sh"
MSG="$1"; shift
[ -n "$MSG" ] && [ $# -gt 0 ] || die "usage: main-commit.sh <message> <path...>"
acquire git
[ "$(git -C "$MAIN" symbolic-ref --short HEAD)" = main ] || { release git; die "main tree is not on main"; }
git -C "$MAIN" add -- "$@" && git -C "$MAIN" commit -m "$MSG" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
rc=$?; release git; exit $rc
