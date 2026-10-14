---
name: e2e-full
description: Full regression before shipping, MAIN TREE ONLY — runs every lint, unit, typecheck and build target, then the whole Playwright suite under the machine-wide e2e lock, and reconciles the AC registry (howItWorks/NN-*/BLOCK.md) against tagged tests and the JSON report so no merged block silently lost a guard. Use when blocks were merged, before /mr, or when asked "did anything old break?" / "run the full regression". Not inside block worktrees (they use /done-check).
allowed-tools: Read, Grep, Glob, Agent, Bash(npx nx *), Bash(git *), Bash(bash *)
---

Refuse to run in a worktree. Check that `git rev-parse --show-toplevel` is `/Users/dmitriyluba/WebstormProjects/Interview/Kairon`.

1. **Scope.** Run `ls howItWorks/state/*.merged.flag` to see which blocks are merged. Only merged blocks gate the
   result; unmerged and stretch blocks are reported but never fail it.
2. **Static and unit.** Run `bash howItWorks/bin/heavy.sh "$PWD" npx nx run-many -t lint test typecheck build --outputStyle=static`
   and record the exit code of each target.
3. **e2e and the ledger.** `bash howItWorks/bin/e2e.sh`:
   - It waits for the e2e lock and runs Playwright with list and JSON reporters (`/tmp/kairon-e2e/report.json`).
   - It then runs `ac-ledger.sh --e2e-report`. An e2e AC is OK only if it passed in the report.
   - It writes `docs/test-runs/<stamp>-e2e.md`, grows `ledger-baseline.txt` after a green full run, and commits both
     at once (`test(run): …`), so the main tree stays clean for merges.
4. **Read the ledger.**
   - `OK`: guarded.
   - `UNCOVERED`/`SKIPPED` in a merged block: a guard was lost.
   - `FAILED`/`UNRUN`: the e2e test failed or did not run.
   - `ORPHAN`: a tag with no registry line.
   - `DUPLICATE`: the same id twice in the registry.
   - `REGRESSED`: proven OK in an earlier run (`docs/test-runs/ledger-baseline.txt`), not OK now. Always a blocker;
     never delete the baseline line to get green.
   - `MANUAL`: checked by command or by hand. Run the command named in the AC (AC-00.1, 00.3, 00.4, 01.11, 03.5)
     and record its exit code.
5. **Triage failures.**
   - Before any assertion (server or port, no JSON report) = infrastructure: fix it and rerun once.
   - On an assertion = regression: use `/fix-test` and `regression-scout` on the merge diff.
   - At most 3 automatic iterations, then report and ask.
6. **Restore guards.**
   - UNCOVERED → `test-automator` writes the tagged test with red-proof.
   - Or the owner explicitly drops the AC from BLOCK.md.
   - ORPHAN → fix the tag, or add the registry line.
7. **Browser walkthrough (once before shipping).** If everything is green, run `/explore-app`. It starts the app
   (`app.sh`), drives the demo journey through the Playwright MCP `playwright-kairon`, spawns one `exploratory-qa-tester`
   and commits a record to `docs/test-runs/`.
8. **Report.**
   - A table `target | PASS/FAIL/SKIP | reason`.
   - The ledger `SUMMARY`, with the rows that are not OK or MANUAL, and the path of the run record in `docs/test-runs/`.
   - Any test touched, and why.

   Green requires zero FAIL, and zero UNCOVERED/SKIPPED/FAILED/UNRUN in merged blocks.

Never weaken assertions or timeouts, never use `.skip`, never bulk-update snapshots. Never report SKIP, UNRUN or
UNCOVERED as PASS. Never retry an assertion failure "until green" as if it were infrastructure.
