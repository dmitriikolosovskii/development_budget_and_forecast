# docs/test-runs — test results and the regression ratchet

Kept in git on purpose: the history of runs is part of the result (TASK.md).

| File | Written by | What it is |
|---|---|---|
| `<YYYY-MM-DD-HHMMSS>-e2e.md` | `howItWorks/bin/e2e.sh` (every run, committed at once) | One run: verdict, main commit, scope (full or `--grep`), exit codes, ledger rows that are not OK/MANUAL, e2e tests that did not pass |
| `<YYYY-MM-DD-HHMMSS>-explore.md` | `/explore-app` (committed at once) | Browser walkthrough through the Playwright MCP: journey table, console/network findings, exploratory defects and hypotheses |
| `ledger-baseline.txt` | `e2e.sh` after a **green full** run (`ac-ledger.sh --write-baseline`) | Every `AC-NN.M` proven OK at least once. `ac-ledger.sh` reads it on every run and fails with `REGRESSED` if one of them is no longer OK, in any block, merged or not |

Rules:
- Records are never edited after the fact. A red run stays in the history next to the green one that fixed it.
- The baseline only grows. Deleting a line to make a run green is the same as weakening a test. An AC the owner removed from BLOCK.md shows as `RETIRED`; only then may its line go.
- Unit results (Jest/Vitest) are proven by `check.sh` at every block merge (merge commit = green). Red-proof of each AC lives in the block's `howItWorks/NN-*/HANDOFF.md`, section `## Red-proof`.
- Raw Playwright JSON stays in `/tmp/kairon-e2e/report.json` (overwritten each run, not committed).

Commands: `bash howItWorks/bin/e2e.sh` (full, main tree), `bash howItWorks/bin/ac-ledger.sh [--block NN]` (any tree).
