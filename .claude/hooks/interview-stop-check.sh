#!/bin/bash
# Stop: advisory only (never blocks). Active only in "process" mode.
FLAG="${CLAUDE_PROJECT_DIR:-.}/.interview-mode"
[ "$(cat "$FLAG" 2>/dev/null)" = "process" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
CHANGED=$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u)
[ -z "$CHANGED" ] && exit 0
MSG="[mode: process] Before calling it done: npx nx affected -t lint test typecheck --base=HEAD"
if echo "$CHANGED" | grep -qE 'apps/web/src/|\.controller\.ts$'; then
  MSG="$MSG ; UI or API behaviour changed: also run bash howItWorks/bin/e2e.sh"
fi
jq -n --arg m "$MSG" '{systemMessage: $m}'
exit 0
