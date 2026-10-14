# 00 — Integrator: handoff (kept current during the run)

## For the blocks
- A CR goes to `shared/change-requests/CR-NN-<slug>.md`. The integrator sees it within about 30 s (the watcher), and the answer comes through `note.sh --read NN`.
  - Before `w0-frozen` the frozen files belong to 01/02, so a CR is passed to them.
  - After `w0-frozen` the integrator applies it in its own worktree and merges it as block `00`. Your next `merge-block.sh` picks it up automatically.
- `merge-block.sh` now writes the status `main-dirty <paths>` when it refuses a dirty main, so the board shows who is blocking.
- Block `00` appears on the board (`status.sh`). Its merges `merge: 00-integrator` move main like any other block's.

## Tools (howItWorks/bin)
| Script | What |
|---|---|
| `integrator-watch.sh` | in the background: exits with events `MERGED NN` / `FLAG w0-frozen\|main.broken` / `STATUS NN conflict\|check-failed\|main-dirty` / `CR <file>` / `DIRTY <paths>`; `--once` (exit 3 = quiet); `--ack` after acting |
| `tests/integrator-watch.test.sh` | sandbox test of the watcher and of the `main-dirty` status in `merge-block.sh` (AC-00.5–00.13) |

## Log
- 2026-10-14 11:05: design `DESIGN.md` (A2); watcher + tests green; row `00` in `blocks.conf` (gate `w0-frozen`).
- 11:45: CR-11 (portfolio extension) accepted; queued for the first block-00 batch after `w0-frozen`. Row 00 now also owns `apps/api/.env.example` (no other owner).
- 11:47: CR-12 applied (docs only, CONTRACTS §5/§6). Item 2 (query-keys.ts) resolved as a block-private key, no code change.
- 11:50: CR-05 (engine `addDays`) accepted, batched with CR-11. Row 00 now also owns `budget-engine/src/lib/schedule.ts` + spec.
- 11:47: 01 merged (fdac8d8). CONTRACTS updated with 01's as-built points (ids, DELETE line → 409, optional approvedByCategory, module order, seed runner).
- 11:47: CR-11 + CR-05 applied (main 1e0fe11, CONTRACT_VERSION 2); 03 merged (c067c47).
- 11:48: main DB migrated + seeded twice: Project=4 BudgetLine=172 CostItem=745 Organization=14 Delivery=7 … identical counts (AC-03.5 ✓).
- 11:52: 07 merged (5879e73). 13's search limitation (ASCII-only SQL contains → JS fold) is in the SOLUTION draft.
- 11:52: 13 merged (148400d).

## Finish TODO (collected from block notes)
- docs/architecture (blocks cannot write `docs/**`):
  - 07 → move `howItWorks/07-land/land.md`;
  - 05 → `construction-tab.md` from its DESIGN "As built" section;
  - 13 → `search.md` from DESIGN/HANDOFF;
  - the others as they arrive;
  - plus `integration-flow.md` and the index rows.
- After `08.merged`: the Land tab switches `apps/web/src/features/land/plot-diagram.tsx` to `<SitePlan projectId/>` (07 HANDOFF). That is a file of the merged block 07, so the integrator does it (adding the path to row 00) or block 08 does it with a CR.
- e2e to run in main: AC-04.8, AC-05.7 (construction), AC-07.11 (`--grep AC-07`), AC-13.12 (search), plus cfo-journey AC-00.2.
- 12:10: **core e2e green** (`e2e.sh --grep "AC-00.2|AC-04.8|AC-05.7|AC-06.7"` → 6 passed, E2E: PASS; record docs/test-runs/2026-10-14-120943-e2e.md). On the way:
  - owner's decision: the demo quantity edit uses a PLANNED row (MAT-ELE-008), because the NYM-J cable rows are DONE (forecast = actual);
  - tabs are `role="tab"`, not links;
  - textContent vs innerText;
  - whole-euro amounts;
  - a hanging `blur()`.
  The integrator now owns materials/profitability/construction e2e specs (row 00, `state/00.spec-rewrite`).
- 12:26: **finish.**
  - Final `merge: 00-integrator` is `e20cf83`; `00.merged` is kept.
  - AC-00.1: `run-many -t lint test typecheck build` exit 0 (5 projects).
  - AC-00.2: full `e2e.sh` 20/20 passed, ledger OK=138 / UNCOVERED 0 / FAILED 0 (`docs/test-runs/2026-10-14-122531-e2e.md`); `ac-ledger --block 00 --e2e-report` exit 0.
  - AC-00.3: SOLUTION.md has all 6 sections.
  - AC-00.4: a `merge: <slug>` for all 14 rows, 55 merge commits, no squash/force.
  - Docs: `docs/architecture/` (15 docs + index), README quick start, SOLUTION.md at the root.
