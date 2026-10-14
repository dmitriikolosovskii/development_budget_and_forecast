#!/bin/bash
# UserPromptSubmit: read-only. In "process" mode inject the process checklist; otherwise stay silent.
# The flag is written only by the /mode-process and /mode-fast skills.
FLAG="${CLAUDE_PROJECT_DIR:-.}/.interview-mode"
[ -f "$FLAG" ] || exit 0
[ "$(cat "$FLAG" 2>/dev/null)" = "process" ] || exit 0
cat <<'MSG'
[mode: process] Work visibly, in this order:
1. Restate the task and ask the interviewer about any business ambiguity.
2. Plan in at most 5 steps before editing code.
3. Write a failing test first, then the code that makes it pass.
4. Run /done-check before saying "done"; report exit codes, not impressions.
MSG
exit 0
