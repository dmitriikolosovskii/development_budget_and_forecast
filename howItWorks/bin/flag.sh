#!/bin/bash
# Publish a milestone flag for neighbours, and optionally update your status line.
# Usage: flag.sh <flag> [note...]            e.g. flag.sh 01.contracts-ready "types+engine at abc123"
#        flag.sh --status <id> <state> [note...]   e.g. flag.sh --status 04 in-progress "table done"
. "$(dirname "$0")/lib.sh"
if [ "$1" = "--status" ]; then shift; set_status "$@"; exit 0; fi
[ -n "$1" ] || die "usage: flag.sh <flag> [note]"
f="$1"; shift
set_flag "$f" "$*"
log "flag set: $f"
