#!/bin/bash
# SessionStart (matcher: startup): every new session starts in fast mode.
rm -f "${CLAUDE_PROJECT_DIR:-.}/.interview-mode"
exit 0
