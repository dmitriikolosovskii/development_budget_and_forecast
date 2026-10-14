#!/bin/bash
# Tests weakening_lines (lib.sh), the diff filter behind check.sh step 4. Bash 3.2.
export KAIRON_MAIN="$(mktemp -d)" KAIRON_STATE="$(mktemp -d)" KAIRON_WT_ROOT="$(mktemp -d)" KAIRON_LOCK_ROOT="$(mktemp -d)"
. "$(cd "$(dirname "$0")/.." && pwd)/lib.sh"
FAILS=0
flag() { if printf '%s\n' "$2" | weakening_lines | grep -q .; then echo "ok   flags: $1"; else echo "FAIL not flagged: $1"; FAILS=$((FAILS + 1)); fi; }
pass() { if printf '%s\n' "$2" | weakening_lines | grep -q .; then echo "FAIL false alarm: $1"; FAILS=$((FAILS + 1)); else echo "ok   clean: $1"; fi; }
flag "removed expect"   "-    expect(total).toBe(500);"
flag "it.skip"          "+  it.skip('should x', () => {"
flag "describe.skip"    "+describe.skip('block', () => {"
flag "test.fixme"       "+  test.fixme('should x', async () => {"
flag "it.todo"          "+  it.todo('should x');"
flag "xdescribe"        "+xdescribe('block', () => {"
flag "xtest"            "+  xtest('should x', () => {"
flag "xit"              "+  xit('should x', () => {"
flag ".only"            "+  it.only('should x', () => {"
pass "added expect"     "+    expect(total).toBe(500);"
pass "diff header"      "--- a/apps/web/src/x.spec.ts"
pass "word containing xit" "+  const exit = onExit();"
pass "test.describe"    "+test.describe('journey', () => {"
[ "$FAILS" = 0 ] && { echo "check-weakening tests: PASS"; exit 0; }
echo "check-weakening tests: $FAILS FAILED"; exit 1
