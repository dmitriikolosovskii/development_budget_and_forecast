#!/bin/bash
# PostToolUse/Write|Edit: warn about console.* in NestJS production code (apps/api only).
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE" ] && exit 0
echo "$FILE" | grep -qE 'apps/api/src/.*\.ts$' || exit 0
echo "$FILE" | grep -qE '\.(spec|test)\.ts$' && exit 0
[ -f "$FILE" ] || exit 0

FOUND=$(grep -n 'console\.\(log\|warn\|error\|debug\|info\)(' "$FILE" 2>/dev/null | grep -v '// allowed' | head -3 | tr '\n' ' ')
if [ -n "$FOUND" ]; then
  jq -n --arg m "console.* in $(basename "$FILE"): use Nest Logger in production code. Found: $FOUND" '{systemMessage: $m}'
fi
exit 0
