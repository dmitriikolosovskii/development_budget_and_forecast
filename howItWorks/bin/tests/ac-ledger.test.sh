#!/bin/bash
# Fixture tests for ac-ledger.sh. Usage: ac-ledger.test.sh   (LEDGER=<path> tests another copy, e.g. a mutant)
# Builds a throw-away registry + repo in a temp dir; never touches the real tree. Bash 3.2.
LEDGER="${LEDGER:-$(cd "$(dirname "$0")/.." && pwd)/ac-ledger.sh}"
T=$(mktemp -d "${TMPDIR:-/tmp}/ac-ledger-test.XXXXXX")
trap 'rm -rf "$T"' EXIT
FAILS=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; FAILS=$((FAILS + 1)); }

export KAIRON_MAIN="$T/main" KAIRON_STATE="$T/state" KAIRON_WT_ROOT="$T/wt" KAIRON_LOCK_ROOT="$T/locks"
REG="$T/main/howItWorks"
R="$T/repo"
mkdir -p "$REG/01-foundation" "$R/libs/engine/src" "$R/apps/web-e2e/src" "$T/state"

cat >"$REG/01-foundation/BLOCK.md" <<'EOF'
## Acceptance criteria (Jest unless marked otherwise)
- AC-01.1 only AC-01.10 is tagged, so this one is uncovered.
- AC-01.2 it.skip → skipped.
- AC-01.3 multi-tag, first.
- AC-01.4 multi-tag, second.
- AC-01.5 (check) lint passes.
- AC-01.6 (e2e, integrator) tagged in e2e spec.
- AC-01.7 (e2e) tagged only in a unit spec.
- AC-01.8 xdescribe → skipped.
- AC-01.9 tag only in a comment.
- AC-01.10 tagged.
- AC-01.11 prettier-wrapped title.
- AC-01.12 (e2e) fails in the report.
- AC-01.13 test.fixme → skipped.
- AC-01.14 it.todo → skipped.
Prose with a range AC-01.1–01.9 is not a registry line.
EOF

cat >"$R/libs/engine/src/money.spec.ts" <<'EOF'
describe('money', () => {
  it('should round [AC-01.10]', () => { expect(1).toBe(1); });
  it.skip('should skip [AC-01.2]', () => { expect(1).toBe(1); });
  it('should cover two [AC-01.3][AC-01.4]', () => { expect(1).toBe(1); });
  it('should be e2e but is unit [AC-01.7]', () => { expect(1).toBe(1); });
  // [AC-01.9] mentioned in a comment only
  it(
    'should keep a long prettier-wrapped title tagged [AC-01.11]',
    () => { expect(1).toBe(1); },
  );
  test.fixme('should fixme [AC-01.13]', () => { expect(1).toBe(1); });
  it.todo('should todo [AC-01.14]');
});
xdescribe('skipped block [AC-01.8]', () => { it('x', () => { expect(1).toBe(1); }); });
EOF

cat >"$R/apps/web-e2e/src/journey.spec.ts" <<'EOF'
import { test, expect } from '@playwright/test';
test.describe('journey', () => {
  test('should open the project [AC-01.6]', async ({ page }) => { await expect(page).toHaveTitle(/x/); });
  test('should fail in report [AC-01.12]', async ({ page }) => { await expect(page).toHaveTitle(/x/); });
});
EOF

cat >"$T/report.json" <<'EOF'
{"suites":[{"title":"journey.spec.ts","specs":[],"suites":[{"title":"journey","specs":[
 {"title":"should open the project [AC-01.6]","ok":true,"tests":[{"status":"expected"}]},
 {"title":"should fail in report [AC-01.12]","ok":false,"tests":[{"status":"unexpected"}]}
]}]}]}
EOF

run() { OUT=$(bash "$LEDGER" --root "$R" "$@" 2>&1); CODE=$?; }
has() { printf '%s\n' "$OUT" | grep -qE "$1"; }
check() { if has "$2"; then ok "$1"; else bad "$1 — expected /$2/ in:"; printf '%s\n' "$OUT" | sed 's/^/     /'; fi; }
code() { if [ "$CODE" = "$2" ]; then ok "$1 (exit $CODE)"; else bad "$1 — exit $CODE, want $2"; fi; }

# R1: nothing merged → report only
run
code "R1 unmerged block never fails" 0
check "R1 summary exact" '^SUMMARY OK=4 UNCOVERED=3 SKIPPED=4 UNRUN=2 FAILED=0 MANUAL=1 ORPHAN=0 DUPLICATE=0 REGRESSED=0$'
check "R1 prefix safety: [AC-01.10] does not cover AC-01.1" '^UNCOVERED +AC-01\.1 '
check "R1 AC-01.10 OK" '^OK +AC-01\.10 '
check "R1 multi-tag covers both" '^OK +AC-01\.4 '
check "R1 it.skip" '^SKIPPED +AC-01\.2 '
check "R1 xdescribe" '^SKIPPED +AC-01\.8 '
check "R1 test.fixme" '^SKIPPED +AC-01\.13 '
check "R1 it.todo" '^SKIPPED +AC-01\.14 '
check "R1 manual marker" '^MANUAL +AC-01\.5 '
check "R1 e2e routing: unit-only tag" '^UNCOVERED +AC-01\.7 .*only in a unit spec'
check "R1 comment tag ignored" '^UNCOVERED +AC-01\.9 '
check "R1 prettier-wrapped title" '^OK +AC-01\.11 '
check "R1 e2e without report" '^UNRUN +AC-01\.6 '

# R2: the block is merged → gaps fail
: >"$T/state/01.merged.flag"
run
code "R2 merged block with gaps fails" 1
rm -f "$T/state/01.merged.flag"

# R3: --block gates that block and filters the output
run --block 01
code "R3 --block 01 fails on gaps" 1
run --block 02
code "R3 --block 02 (no ACs) passes" 0
check "R3 --block 02 prints no 01 rows" '^SUMMARY OK=0 UNCOVERED=0 '

# R4: Playwright JSON report decides e2e
run --e2e-report "$T/report.json"
code "R4 report mode, unmerged" 0
check "R4 passed in report → OK" '^OK +AC-01\.6 '
check "R4 failed in report → FAILED" '^FAILED +AC-01\.12 '
check "R4 summary" '^SUMMARY OK=5 UNCOVERED=3 SKIPPED=4 UNRUN=0 FAILED=1 '

# R5: orphan tag fails everywhere
echo "it('should orphan [AC-09.9]', () => { expect(1).toBe(1); });" >"$R/libs/engine/src/orphan.spec.ts"
run
code "R5 orphan fails" 1
check "R5 orphan row" '^ORPHAN +AC-09\.9 +libs/engine/src/orphan\.spec\.ts'
rm -f "$R/libs/engine/src/orphan.spec.ts"

# R6: duplicate registry id fails everywhere
echo "- AC-01.3 duplicated id." >>"$REG/01-foundation/BLOCK.md"
run
code "R6 duplicate fails" 1
check "R6 duplicate row" '^DUPLICATE +AC-01\.3 '
sed -i.bak '/duplicated id\./d' "$REG/01-foundation/BLOCK.md"

# R7: usage errors
run --bogus
code "R7 unknown argument" 2

# R8: --write-baseline stores the proven ACs (unit OK now; e2e only when proven by a report)
B="$T/base.txt"
run --write-baseline "$B"
code "R8 write baseline" 0
if grep -qx 'AC-01.10 unit' "$B" && grep -qx 'AC-01.3 unit' "$B" && ! grep -q 'AC-01.6' "$B" && ! grep -q 'AC-01.1 ' "$B"; then ok "R8 baseline has unit OK ids only"; else bad "R8 baseline content:"; cat "$B"; fi
run --e2e-report "$T/report.json" --write-baseline "$B"
if grep -qx 'AC-01.6 e2e' "$B" && grep -qx 'AC-01.10 unit' "$B" && ! grep -q 'AC-01.12' "$B"; then ok "R8 baseline is a union and gains the e2e id proven by the report"; else bad "R8 union:"; cat "$B"; fi

# R9: an AC proven before and not OK now is REGRESSED — fails even in an unmerged block
sed -i.bak 's/\[AC-01.10\]/[AC-01.15]/' "$R/libs/engine/src/money.spec.ts"
echo "- AC-01.15 renamed tag target." >>"$REG/01-foundation/BLOCK.md"
run --baseline "$B"
code "R9 regression fails the run" 1
check "R9 regressed row" '^REGRESSED +AC-01\.10 +was OK in the baseline, now UNCOVERED'
check "R9 summary counts it" 'REGRESSED=1$'
mv "$R/libs/engine/src/money.spec.ts.bak" "$R/libs/engine/src/money.spec.ts"

# R10: e2e ids in the baseline are judged only with a report
run --baseline "$B"
code "R10 no report: e2e baseline id not judged" 0
echo 'AC-01.12 e2e' >>"$B"
run --baseline "$B" --e2e-report "$T/report.json"
check "R10 failed e2e that was proven → REGRESSED" '^REGRESSED +AC-01\.12 '
code "R10 exit" 1
sed -i.bak '/AC-01.12/d' "$B"

# R11: --block judges only that block's baseline ids; a retired id (gone from BLOCK.md) is reported, not failed
printf 'AC-99.1 unit\n' >>"$B"
sed -i.bak 's/\[AC-01.10\]/[AC-01.15]/' "$R/libs/engine/src/money.spec.ts"   # AC-01.10 regresses again
run --baseline "$B" --block 02
code "R11 --block 02 ignores block 01's regression" 0
run --baseline "$B" --block 01
check "R11 --block 01 reports it" '^REGRESSED +AC-01\.10 '
mv "$R/libs/engine/src/money.spec.ts.bak" "$R/libs/engine/src/money.spec.ts"
run --baseline "$B"
check "R11 retired id reported" '^RETIRED +AC-99\.1 '
if printf '%s\n' "$OUT" | grep -q '^REGRESSED'; then bad "R11 retired id must not count as regressed"; else ok "R11 retired id is not a regression"; fi

# R12: the default baseline is $MAIN/docs/test-runs/ledger-baseline.txt; --no-baseline turns it off
mkdir -p "$T/main/docs/test-runs"; echo 'AC-01.1 unit' >"$T/main/docs/test-runs/ledger-baseline.txt"
run
code "R12 default baseline is used" 1
run --no-baseline
code "R12 --no-baseline" 0
rm -rf "$T/main/docs"

echo "---"
[ "$FAILS" = 0 ] && { echo "ac-ledger tests: PASS"; exit 0; }
echo "ac-ledger tests: $FAILS FAILED"; exit 1
