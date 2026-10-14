#!/bin/bash
# Tests e2e.sh guards: main tree only, --exec runs under the e2e lock and releases it. Bash 3.2.
E2E="$(cd "$(dirname "$0")/.." && pwd)/e2e.sh"
T=$(mktemp -d "${TMPDIR:-/tmp}/e2e-test.XXXXXX"); trap 'rm -rf "$T"' EXIT
export KAIRON_MAIN="$T/main" KAIRON_STATE="$T/state" KAIRON_WT_ROOT="$T/wt" KAIRON_LOCK_ROOT="$T/locks"
mkdir -p "$T/main" "$T/other"; git -C "$T/main" init -q; git -C "$T/other" init -q
FAILS=0
is() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 — got '$2', want '$3'"; FAILS=$((FAILS + 1)); fi; }

(cd "$T/other" && bash "$E2E" --exec true >/dev/null 2>&1); is "refuses outside the main tree" $? 2
(cd "$T/main" && bash "$E2E" --exec sh -c '[ -d "$KAIRON_LOCK_ROOT/e2e" ]'); is "--exec runs under the e2e lock" $? 0
[ -d "$T/locks/e2e" ]; is "lock released afterwards" $? 1
(cd "$T/main" && bash "$E2E" --exec false); is "--exec passes the exit code" $? 1
(cd "$T/main" && bash "$E2E" --bogus >/dev/null 2>&1); is "unknown argument" $? 2

# --- run records in docs/test-runs (fake Playwright via KAIRON_E2E_CMD) ---
git -C "$T/main" checkout -q -b main 2>/dev/null; git -C "$T/main" config user.email t@example.com; git -C "$T/main" config user.name t
mkdir -p "$T/main/howItWorks/01-x" "$T/main/apps/web-e2e/src"
echo "- AC-01.1 (e2e) journey works." >"$T/main/howItWorks/01-x/BLOCK.md"
echo "test('should work [AC-01.1]', async () => { expect(1).toBe(1); });" >"$T/main/apps/web-e2e/src/a.spec.ts"
git -C "$T/main" add -A && git -C "$T/main" commit -qm init
cat >"$T/pass.json" <<'J'
{"suites":[{"title":"a.spec.ts","specs":[{"title":"should work [AC-01.1]","ok":true,"tests":[{"status":"expected"}]}]}]}
J
cat >"$T/fail.json" <<'J'
{"suites":[{"title":"a.spec.ts","specs":[{"title":"should work [AC-01.1]","ok":false,"tests":[{"status":"unexpected"}]}]}]}
J
RUNS="$T/main/docs/test-runs"; BASE="$RUNS/ledger-baseline.txt"
fake() { export KAIRON_E2E_CMD="cp '$1' \"\$PLAYWRIGHT_JSON_OUTPUT_NAME\"; exit $2"; }
commits() { git -C "$T/main" rev-list --count HEAD; }
export KAIRON_E2E_REPORT="$T/report.json"

fake "$T/fail.json" 1; cn=$(commits)
(cd "$T/main" && bash "$E2E" --grep 'AC-01' >/dev/null 2>&1); is "red run before any baseline exits 1" $? 1
is "red run before any baseline: record committed" "$(commits)" "$((cn + 1))"
is "red run before any baseline: main stays clean" "$(git -C "$T/main" status --porcelain | wc -l | tr -d ' ')" 0
git -C "$T/main" rm -rq docs && git -C "$T/main" commit -qm "reset runs"

sleep 1; fake "$T/pass.json" 0; c0=$(commits)
(cd "$T/main" && bash "$E2E" >/dev/null 2>&1); is "green run exits 0" $? 0
is "green run: one record" "$(ls "$RUNS"/*-e2e.md 2>/dev/null | wc -l | tr -d ' ')" 1
grep -q '^# e2e run .* — PASS' "$RUNS"/*-e2e.md; is "record says PASS" $? 0
grep -qx 'AC-01.1 e2e' "$BASE" 2>/dev/null; is "green run grows the baseline" $? 0
is "record + baseline committed" "$(commits)" "$((c0 + 1))"
git -C "$T/main" log -1 --format=%s | grep -q '^test(run): e2e .* PASS'; is "commit subject" $? 0

sleep 1; fake "$T/fail.json" 1; cp "$BASE" "$T/base.before"
(cd "$T/main" && bash "$E2E" >/dev/null 2>&1); is "red run exits 1" $? 1
ls -t "$RUNS"/*-e2e.md | head -1 | xargs grep -q '— FAIL'; is "red run recorded as FAIL" $? 0
ls -t "$RUNS"/*-e2e.md | head -1 | xargs grep -qE 'REGRESSED +AC-01.1'; is "record shows the regression" $? 0
cmp -s "$BASE" "$T/base.before"; is "red run leaves the baseline alone" $? 0

sleep 1; fake "$T/pass.json" 0; c1=$(commits)
(cd "$T/main" && bash "$E2E" --grep 'AC-01' >/dev/null 2>&1); is "partial run exits 0" $? 0
ls -t "$RUNS"/*-e2e.md | head -1 | xargs grep -q 'partial run'; is "partial run is marked" $? 0

sleep 1; c2=$(commits)
(cd "$T/main" && KAIRON_E2E_NO_COMMIT=1 bash "$E2E" >/dev/null 2>&1)
is "KAIRON_E2E_NO_COMMIT keeps the record uncommitted" "$(commits)" "$c2"

# --- the real command must bypass the Nx cache (a cached e2e target replays old output and writes no JSON) ---
mkdir -p "$T/bin"; printf '#!/bin/sh\necho "$@" > "%s/npx.args"\n' "$T" >"$T/bin/npx"; chmod +x "$T/bin/npx"
(cd "$T/main" && unset KAIRON_E2E_CMD && PATH="$T/bin:$PATH" KAIRON_E2E_NO_COMMIT=1 bash "$E2E" >/dev/null 2>&1)
grep -q -- '--skip-nx-cache' "$T/npx.args" 2>/dev/null; is "nx e2e runs with --skip-nx-cache" $? 0

[ "$FAILS" = 0 ] && { echo "e2e tests: PASS"; exit 0; }
echo "e2e tests: $FAILS FAILED"; exit 1
