# HANDOFF — 05-construction-works

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
done. Branch `feat/05-construction-works`: `c2064fc` (feature), `388ecdd` (merge main), `af38a15` (CR-05 swap). `check.sh 05` → CHECK: PASS (ownership / format / affected lint,test,typecheck,build / test-weakening all exit 0; web 103/103 tests). `ac-ledger.sh --block 05` → exit 0: 12 OK, AC-05.7 UNRUN in the block. Merged by `merge-block.sh 05` → main `73dc74d`.
**AC-05.7 e2e: PASS in main `29bbc5b`** (integrator run, e2e 6/6 for AC-00.2/04.8/05.7/06.7). The integrator fixed two lines of `construction.spec.ts` after the merge: the tab is `getByRole('tab', {name: 'Construction'})` (02's Tabs render `role=tab`), and the hanging `input.blur()` after Enter was removed. Row 00 now owns that spec (`state/00.spec-rewrite`).

## Ready for neighbours (exports / components / endpoints, with examples)
Paths are under `apps/web/src/features/construction/`. Other features reach this tab **by URL only**:
- `/projects/:id/construction/<section>?highlight=<workId>`: opens the section and flashes the work row (02's EditableTable).
- `/projects/:id/construction` (no section): goes to `useUiStore.lastSection.construction` if that line exists, otherwise to the first CONSTRUCTION line (`construction-page.tsx:101`).

Links from 05 into other tabs: a material chip and "Open material" → `/projects/:id/materials/<the material's own section>?highlight=<materialId>` (`lineHref` from 02).

Writes 05 makes, all through 02's hooks, so 04/06/11 see them at once from the shared cache:
| Action | Request |
|---|---|
| edit name / volume / rate / committed / actual / status / contractor / start / end | `useEditItem` → PATCH `/projects/:id/items/<workId>` (400 ms queue) |
| "Shift work start to <d Mon>" | **one** PATCH `{startDate, endDate}` on the work; duration kept; target = latest delivery among its blocking materials |
| link / unlink a material (dialog from the 🔗 button in the Materials column) | PATCH **on the material** `{requiredForWorkId: <workId> \| null}`; verified live on the API (200, stored `null`) |
| add / delete a work row | `useCreateItem` (code `WRK-<prefix>-NNN`, next free) / `useDeleteItem` (inline confirm) |

Feature-internal pure helpers (`construction-model.ts`; copy the idea, don't import across features): `buildScheduleAlerts` :131, `shiftWorkToDate` :74, `shiftTargetForWork` :87, `conflictCountBySection` :187, `buildGanttModel` :265, `contingencyUsage` :373, `workDurationDays` :52 (inclusive), `formatDayMonth` :46 (`2 Nov`, fixed month names: ICU's en-GB prints `Sept`).

Test fixture for anyone writing a cross-tab test: `construction-fixture.ts` (`constructionSnapshot()`, `patchItem()`; GERMANY-DATA §7 dates, today 2026-10-14).

## How to check
- `bash $BIN/check.sh 05`; `bash $BIN/ac-ledger.sh --block 05` (from the worktree).
- Unit: `cd apps/web && npx vitest run src/features/construction` (28 tests: model 15, page 12, re-render 1).
- e2e (integrator, needs the seed): `bash howItWorks/bin/e2e.sh --grep construction`. It duplicates `taucha-stadtvilla`, checks the "9 days" alert, follows "Open material", edits `Edit MAT-WIN-001 delivery date` (04's label) to 2026-10-18, comes back: row `Ready`, alert gone; the second test shifts the work and reloads.
- Red-proof done: 12 mutations of the product code (shift ignores duration, sort reversed, first blocker as target, no date validation, contingency 0, badge without INVALID, unstable columns, unlink `undefined`, ignore lastSection, chip without highlight, late ◆ not red, readiness always Ready) each turn the matching AC red.

## Gaps, CRs, deviations from CONTRACTS
- CR-05-add-days: applied by 00 (`1e0fe11`); 05 uses `addDays` from the engine.
- The kit has no AlertBanner or WORK readiness cell: local `ScheduleAlerts` (`schedule-alerts.tsx`) and `ReadinessCell` (`work-cells.tsx:83`) built from Badge and tokens.
- Row tint for conflicts: EditableTable owns `<tr>`, so the readiness cell carries `data-conflict` and the table wrapper tints `tr:has([data-conflict]) td` (`construction-page.tsx`, Tailwind arbitrary variant). jsdom does not evaluate it; tests assert `data-conflict` and the ⚠ icon.
- Material UNSCHEDULED (no date): no ◆ in the Gantt (nothing to place it at); its chip shows `unscheduled`.
- The alert keeps the BLOCK's literal verb: "<material> arrive <date>" (also for a single item).
- Not done: a cascade re-plan of later works after a shift (non-goal).
