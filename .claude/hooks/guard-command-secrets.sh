#!/bin/bash
# PreToolUse/Bash: guards the text of a shell command.
#   1) inline cloud keys (AWS AKIA...) -> BLOCK (exit 2)
#   2) inline credentials in a URL (https://user:token@host) -> BLOCK (exit 2)
#   3) broad staging (git add -A / . / -u / *) -> advisory note only
# Opt-out for a deliberate exception: put "# command-secrets-ok" in the command.
set -uo pipefail

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$CMD" ] && exit 0
if echo "$CMD" | grep -q 'command-secrets-ok'; then exit 0; fi

if echo "$CMD" | grep -qE '\bAKIA[A-Z0-9]{16}\b'; then
  echo "BLOCKED: the command contains a cloud access key. Pass secrets via env files or profiles, not inline." >&2
  exit 2
fi

if echo "$CMD" | grep -qE 'https?://[A-Za-z0-9._~%+-]+:[^@/[:space:]]{6,}@'; then
  echo "BLOCKED: inline credentials in a URL (https://user:token@host). Use a credential helper or an Authorization header." >&2
  exit 2
fi

if echo "$CMD" | grep -qE '(^|[;&|])[[:space:]]*git[[:space:]]+add[[:space:]]+(-A\b|-u\b|--all\b|\.[[:space:]]*($|[;&|])|\*)'; then
  echo "NOTE: broad 'git add' may stage .env or unrelated files. Prefer staging files by name." >&2
fi

exit 0
