#!/bin/bash
# ac-ledger — reconciles the acceptance registry (the `- AC-NN.M` lines in $MAIN/howItWorks/NN-*/BLOCK.md)
# against tests tagged `[AC-NN.M]` in it/test/describe titles. grep proves a tag exists; for e2e ACs only
# a Playwright JSON report proves a run. Jest/Vitest runs are proven by check.sh / nx test.
#
# Registry kind = the marker right after the id: `(… manual …)` / `(check)` → MANUAL (not test-guarded),
# `(e2e …)` → must be tagged under apps/*-e2e/, anything else or no marker → unit (Jest/Vitest elsewhere).
#
# Output, one row per AC, then SUMMARY:
#   OK         tagged by a live test (e2e: also passed in --e2e-report)
#   UNCOVERED  no live tag (or tagged only in the wrong kind of spec)
#   SKIPPED    tagged only by skip/fixme/todo/x-prefixed tests
#   UNRUN      e2e AC tagged, but no report given or not in the report
#   FAILED     e2e AC failed in the report
#   MANUAL     checked by a command or by hand, not by a test
#   ORPHAN     tag without a registry line
#   DUPLICATE  the same id twice in the registry
#   REGRESSED  the AC is in the baseline (it was proven OK once) and is not OK now — fails in ANY block
#   RETIRED    a baseline id that is no longer in the registry (the owner dropped the AC) — info only
#
# Baseline (regression ratchet): $MAIN/docs/test-runs/ledger-baseline.txt, lines "AC-NN.M unit|e2e".
# Only grows: --write-baseline FILE adds the ACs that are OK in this run (e2e ones only when a report proved
# them). e2e baseline ids are judged only when --e2e-report is given; with --block only that block's ids.
#
# Exit: 1 on any ORPHAN/DUPLICATE/REGRESSED, or on UNCOVERED/SKIPPED/FAILED (and UNRUN with --e2e-report) in a gated
#       block — gated = merged ($STATE/NN.merged.flag), or the block given with --block. 0 otherwise, 2 usage.
#       Unmerged (incl. stretch) blocks are reported but never fail the run.
#
# Usage: ac-ledger.sh [--root DIR] [--block NN] [--e2e-report FILE] [--baseline FILE | --no-baseline]
#                    [--write-baseline FILE]         DIR = repo/worktree to scan (default: git root)
#        ac-ledger.sh --self-test
# Bash 3.2 compatible (macOS /bin/bash).
. "$(dirname "$0")/lib.sh"

ROOT="" BLOCK="" REPORT="" BASE="$MAIN/docs/test-runs/ledger-baseline.txt" WRITE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="${2:-}"; shift 2 ;;
    --block) BLOCK="${2:-}"; shift 2 ;;
    --e2e-report) REPORT="${2:-}"; shift 2 ;;
    --baseline) BASE="${2:-}"; [ -f "$BASE" ] || { echo "ac-ledger: no such baseline: $BASE" >&2; exit 2; }; shift 2 ;;
    --no-baseline) BASE=""; shift ;;
    --write-baseline) WRITE="${2:-}"; [ -n "$WRITE" ] || { echo "ac-ledger: --write-baseline wants a file" >&2; exit 2; }; shift 2 ;;
    --self-test) exec bash "$BIN/tests/ac-ledger.test.sh" ;;
    -h | --help) sed -n '2,35p' "$0"; exit 0 ;;
    *) echo "ac-ledger: unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$ROOT" ] || ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "ac-ledger: not in a git repo; pass --root" >&2; exit 2; }
[ -d "$ROOT" ] || { echo "ac-ledger: no such dir: $ROOT" >&2; exit 2; }
[ -z "$BLOCK" ] || printf '%s' "$BLOCK" | grep -qE '^[0-9]{2}$' || { echo "ac-ledger: --block wants NN" >&2; exit 2; }
[ -z "$REPORT" ] || [ -f "$REPORT" ] || { echo "ac-ledger: no such report: $REPORT" >&2; exit 2; }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/ac-ledger.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

# 1. registry → "id \t block \t kind"
echo "#REG" >"$TMP/reg"
for f in "$HIW"/[0-9][0-9]-*/BLOCK.md; do
  [ -f "$f" ] || continue
  awk '
    /^- AC-[0-9][0-9]\.[0-9]+([ \t]|$)/ {
      id = $2; blk = substr(id, 4, 2); rest = substr($0, index($0, id) + length(id))
      sub(/^[ \t]+/, "", rest); kind = "unit"
      if (substr(rest, 1, 1) == "(") {
        m = tolower(substr(rest, 2, index(rest, ")") - 2))
        if (m ~ /manual|check/) kind = "manual"; else if (m ~ /e2e/) kind = "e2e"
      }
      print id "\t" blk "\t" kind
    }' "$f" >>"$TMP/reg"
done

# 2. tags in test titles → "id \t file \t live|skipped \t unit|e2e"
echo "#TAG" >"$TMP/tag"
(
  cd "$ROOT" || exit 0
  {
    find apps libs -type f \( -name '*.spec.ts' -o -name '*.spec.tsx' -o -name '*.test.ts' -o -name '*.test.tsx' \) \
      -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.nx/*' 2>/dev/null
    for d in apps/*-e2e/src; do [ -d "$d" ] && find "$d" -type f -name '*.ts' 2>/dev/null; done
  } | sort -u >"$TMP/files"
  [ -s "$TMP/files" ] || exit 0
  # shellcheck disable=SC2046
  awk '
    function trim(s) { sub(/^[ \t]+/, "", s); return s }
    BEGIN { call = "(^|[^A-Za-z0-9_.])x?(it|test|describe)(\\.[a-z]+)*[ \t]*\\(" }
    FNR == 1 { prev = "" }
    {
      line = $0; t = trim(line); ctx = ""
      if (t !~ /^(\/\/|\*|\/\*)/ && line ~ /\[AC-[0-9][0-9]\.[0-9]+\]/) {
        if (line ~ call) ctx = line
        else if (t ~ /^["\047`]/ && prev ~ (call "[ \t]*$")) ctx = prev
        if (ctx != "") {
          sk = (ctx ~ /\.(skip|fixme|todo)[ \t]*\(/ || ctx ~ /(^|[^A-Za-z0-9_.])x(it|test|describe)[ \t]*\(/) ? "skipped" : "live"
          kind = (FILENAME ~ /-e2e\//) ? "e2e" : "unit"
          s = line
          while (match(s, /\[AC-[0-9][0-9]\.[0-9]+\]/)) {
            print substr(s, RSTART + 1, RLENGTH - 2) "\t" FILENAME "\t" sk "\t" kind
            s = substr(s, RSTART + RLENGTH)
          }
        }
      }
      if (t != "") prev = line
    }' $(cat "$TMP/files")
) >>"$TMP/tag"

# 3. Playwright JSON report → "passed|failed|skipped \t full title"
echo "#REP" >"$TMP/rep"
if [ -n "$REPORT" ]; then
  command -v node >/dev/null 2>&1 || { echo "ac-ledger: node is required for --e2e-report" >&2; exit 2; }
  node "$BIN/pw-report.js" "$REPORT" >>"$TMP/rep" || { echo "ac-ledger: cannot parse $REPORT" >&2; exit 2; }
fi

# 4. baseline → "id \t kind"
echo "#BAS" >"$TMP/bas"
[ -n "$BASE" ] && [ -f "$BASE" ] && grep -E '^AC-[0-9]{2}\.[0-9]+ (unit|e2e)$' "$BASE" | tr ' ' '\t' >>"$TMP/bas"

# 5. classify
MERGED=" "
for f in "$STATE"/[0-9][0-9].merged.flag; do [ -e "$f" ] && MERGED="$MERGED$(basename "$f" | cut -c1-2) "; done

awk -F'\t' -v merged="$MERGED" -v only="$BLOCK" -v hasrep="${REPORT:+1}" -v okf="$TMP/ok" '
  $0 == "#REG" { sec = "reg"; next }
  $0 == "#TAG" { sec = "tag"; next }
  $0 == "#REP" { sec = "rep"; next }
  sec == "reg" { if (!($1 in n)) { ord[++cnt] = $1; blk[$1] = $2; kind[$1] = $3 } n[$1]++; next }
  sec == "tag" {
    k = $4 SUBSEP $3; has[$1, k] = 1; tagged[$1] = 1
    if (index("," files[$1] ",", "," $2 ",") == 0) files[$1] = files[$1] (files[$1] == "" ? "" : ",") $2
    next
  }
  $0 == "#BAS" { sec = "bas"; next }
  sec == "rep" { rs[++rn] = $1; rt[rn] = $2; next }
  sec == "bas" { if (!($1 in bk0)) { bord[++bn] = $1; bk0[$1] = $2 } next }
  function out(b, id, bk, why,   g) {
    c[b]++; cur[id] = b
    if (b == "OK") print id " " (kind[id] == "e2e" ? "e2e" : "unit") > okf
    printf "%-10s %-9s %s\n", b, id, why
    g = (only != "") ? (bk == only) : (index(merged, " " bk " ") > 0)
    if (b == "ORPHAN" || b == "DUPLICATE" || b == "REGRESSED") bad = 1
    else if (g && (b == "UNCOVERED" || b == "SKIPPED" || b == "FAILED" || (b == "UNRUN" && hasrep))) bad = 1
  }
  END {
    for (i = 1; i <= cnt; i++) {
      id = ord[i]; bk = blk[id]; kd = kind[id]
      if (only != "" && bk != only) continue
      f = (id in files) ? files[id] : "-"
      if (n[id] > 1) { out("DUPLICATE", id, bk, "listed " n[id] " times in BLOCK.md"); continue }
      if (kd == "manual") { out("MANUAL", id, bk, "checked by a command or by hand"); continue }
      own = (kd == "e2e") ? "e2e" : "unit"; other = (kd == "e2e") ? "unit" : "e2e"
      if ((id, own SUBSEP "live") in has) {
        if (kd != "e2e") { out("OK", id, bk, f); continue }
        if (!hasrep) { out("UNRUN", id, bk, f " (no --e2e-report)"); continue }
        st = ""
        for (j = 1; j <= rn; j++) if (index(rt[j], "[" id "]")) { if (rs[j] == "failed") st = "failed"; else if (rs[j] == "passed" && st == "") st = "passed" }
        if (st == "passed") out("OK", id, bk, f)
        else if (st == "failed") out("FAILED", id, bk, f)
        else out("UNRUN", id, bk, f " (not in the report)")
      } else if ((id, own SUBSEP "skipped") in has) out("SKIPPED", id, bk, f)
      else if ((id, other SUBSEP "live") in has || (id, other SUBSEP "skipped") in has)
        out("UNCOVERED", id, bk, "tagged only in a" (other == "unit" ? " unit" : "n e2e") " spec: " f)
      else out("UNCOVERED", id, bk, "no tagged test")
    }
    for (i = 1; i <= bn; i++) {
      id = bord[i]; bk = substr(id, 4, 2)
      if (only != "" && bk != only) continue
      if (!(id in n)) { printf "%-10s %-9s %s\n", "RETIRED", id, "in the baseline, no longer in BLOCK.md"; continue }
      if (bk0[id] == "e2e" && !hasrep) continue
      if (cur[id] != "OK") out("REGRESSED", id, bk, "was OK in the baseline, now " cur[id])
    }
    for (id in tagged) if (!(id in n) && (only == "" || substr(id, 4, 2) == only)) out("ORPHAN", id, substr(id, 4, 2), files[id])
    printf "SUMMARY OK=%d UNCOVERED=%d SKIPPED=%d UNRUN=%d FAILED=%d MANUAL=%d ORPHAN=%d DUPLICATE=%d REGRESSED=%d\n", \
      c["OK"], c["UNCOVERED"], c["SKIPPED"], c["UNRUN"], c["FAILED"], c["MANUAL"], c["ORPHAN"], c["DUPLICATE"], c["REGRESSED"]
    exit bad ? 1 : 0
  }' "$TMP/reg" "$TMP/tag" "$TMP/rep" "$TMP/bas"
RC=$?

# 6. grow the baseline (union, never shrinks; e2e ids enter only when a report proved them)
if [ -n "$WRITE" ]; then
  touch "$TMP/ok"; [ -n "$REPORT" ] || grep -v ' e2e$' "$TMP/ok" >"$TMP/ok2" || true
  [ -n "$REPORT" ] && cp "$TMP/ok" "$TMP/ok2"
  mkdir -p "$(dirname "$WRITE")"
  { [ -f "$WRITE" ] && grep -E '^AC-' "$WRITE"; cat "$TMP/ok2"; } | sort -u -t' ' -k1,1 >"$TMP/new"
  { echo "# AC ledger baseline: ACs proven OK at least once. ac-ledger.sh fails (REGRESSED) if one stops being OK."
    echo "# Grown only by e2e.sh after a green run (ac-ledger.sh --write-baseline). Never delete a line to hide a regression;"
    echo "# an AC the owner dropped from BLOCK.md shows as RETIRED and may then be removed here."
    cat "$TMP/new"; } >"$WRITE"
fi
exit $RC
