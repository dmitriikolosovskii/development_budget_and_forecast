#!/bin/bash
# PreToolUse/Bash: before `git commit` block staged .env files and obvious secrets.
# Templates (.env.example / .sample / .template) are allowed; their content is still scanned.
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$CMD" ] && exit 0
echo "$CMD" | grep -qE '(^|[;&|])[[:space:]]*git[[:space:]]+commit' || exit 0

ENV_STAGED=$(git diff --cached --name-only 2>/dev/null \
  | grep -E '\.env($|\.)' \
  | grep -vE '\.env(\.[a-z0-9_-]+)?\.(example|sample|template)$|\.env\.(example|sample|template)$')
if [ -n "$ENV_STAGED" ]; then
  echo "BLOCKED: .env files must not be committed: $ENV_STAGED" >&2
  exit 2
fi

SECRETS_FOUND=$(git diff --cached --diff-filter=ACM -U0 2>/dev/null | \
  grep -iE '(api[_-]?key|secret[_-]?key|password|passwd|token|private[_-]?key)\s*[:=]\s*["\x27][a-zA-Z0-9_/+-]{8,}' | \
  grep -viE '(process\.env|ConfigService|getOrThrow|EXAMPLE|placeholder|change_me|YOUR_|TODO|template|mock|test|spec|dummy|\$\{)' | \
  head -5)
if [ -n "$SECRETS_FOUND" ]; then
  echo "BLOCKED: potential secrets in staged files:" >&2
  echo "$SECRETS_FOUND" >&2
  exit 2
fi
exit 0
