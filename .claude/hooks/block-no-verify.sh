#!/bin/bash
# PreToolUse/Bash: blocks --no-verify and --no-gpg-sign flags
# These flags bypass git hooks (pre-commit linters, secrets scanners)
# Exit code 2 = BLOCK the tool execution

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$CMD" ]; then exit 0; fi

if echo "$CMD" | grep -qE -- '--no-verify|--no-gpg-sign'; then
  echo "BLOCKED: --no-verify and --no-gpg-sign are prohibited. Pre-commit hooks are mandatory." >&2
  exit 2
fi
