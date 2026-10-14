# DESIGN — 05 "Construction" tab (block spec, /brainstorm in block mode)

Date: 2026-10-14 · Status: approved by the panel judge (risk **medium**: 02's real API is not merged yet; the logic risk is low) · **Implemented** (see "As built" at the end).

## Goal
Route `/projects/:id/construction/:section?` shows the project's WORK rows per construction section, the schedule conflicts between materials and works (engine `checkSchedule`), a mini Gantt, and the contingency reserve. Everything is derived live from the shared snapshot cache, so an edit in Materials (delivery date) or here (start/end) changes the alerts immediately.

## Non-goals
- No date/status logic of our own: statuses come only from `useSchedule(projectId)` (engine `checkSchedule`).
- No cascade re-planning (shifting a work does not move the works after it).
- No new libraries; no edits outside `apps/web/src/features/construction/**` and `apps/web-e2e/src/construction.spec.ts`.
- No backend changes.

## Chosen approach — A: a pure view model plus thin components
`construction-model.ts` holds pure functions over `(cache, schedule, today)`. Components only render them.
- **Why not B** (inline `useMemo` in each component): the reshaping is spread over banner, Gantt, SubNav and columns, it can be tested only through the DOM, and private date logic creeps in.
- **Why not C** (local zustand store of derived data): it violates CONTRACTS §6 (server data lives only in the TanStack cache) and becomes stale after an edit in tab 04.

### Files (all under `apps/web/src/features/construction/`)
| File | Content |
|---|---|
| `construction-model.ts` (+ `.spec.ts`) | `buildScheduleAlerts`, `shiftTargetForWork`, `shiftWorkToDate`, `validateWorkDates`, `workDurationDays`, `buildGanttModel`, `contingencyUsage`, `conflictCountBySection`, `readinessLabel`, `nextWorkCode`, `formatDayMonth` (UTC, "2 Nov"); `addDays` comes from the engine (CR-05 applied) |
| `construction-page.tsx` | `ConstructionPage` (replaces 02's placeholder body): SubNav of the 15 CONSTRUCTION sections with conflict badges, redirect to `useUiStore.lastSection.construction` or the first section, `ScheduleAlerts`, table or `ContingencyPanel`, `ConstructionGantt`, `BudgetHealthPanel` |
| `construction-columns.tsx` | column config for 02's `EditableTable`: Code · Work item · Volume+unit · Rate · Planned · Committed · Actual · Status · Contractor (OrgCell, CONTRACTOR only) · Start · End · Duration · Materials (chips) · Readiness (rightmost) |
| `readiness-cell.tsx`, `material-chips.tsx` | local cells (the kit's `ScheduleFlagCell` is for MATERIAL results). They receive **primitives** only |
| `schedule-alerts.tsx` | `ScheduleAlerts` (local AlertBanner made from Card/Badge/risk tokens): one line per LATE_FOR_WORK material, sorted by `delayDays` desc, then the INVALID_DATES works ordered by code. Actions: "Open material" (link) and "Shift work start to <date>" |
| `construction-gantt.tsx` | CSS-grid bars per WORK grouped by section, ◆ per linked material at `deliveredDate ?? deliveryDate`, a risk class for LATE_FOR_WORK, a Today line (`useToday()`); a list on mobile |
| `contingency-panel.tsx` | reserve = approved of the `contingency` line; "Used by overruns" = `contingencyUsage(summary)`; remaining; no table |
| `link-materials.tsx` | multi-select over the project's MATERIAL rows; one `useEditItem` per changed material (`requiredForWorkId` = work id / `null`); each option shows "currently: <work>" |
| `construction-fixture.ts` | test fixture built on the engine's `makeSnapshot`/`makeItem` (GERMANY-DATA §7 dates). Imported only by specs |

## Judge constraints (mandatory)
1. Only the engine computes schedule statuses. The model only reshapes `useSchedule` output. Validating a draft date (end < start) counts as input validation and is allowed.
2. Server state lives only in the TanStack cache: edits go through `useEditItem`, create/delete through `useCreateItem`/`useDeleteItem`. zustand holds only `lastSection.construction`.
3. Rows never receive the whole schedule record. Each memoised row gets primitives (status, worstDelayDays, a joined id string), so editing one row does not re-render the others. A test covers this.
4. No edits to 01/02 files. Kit gaps get local components. A missing engine helper gets a local UTC `addDaysUtc` marked `// TODO CR-05-add-days`, plus a CR. Use the engine's `daysBetween` only if the index exports it.
5. Never import `features/materials`. Chips link to `materials/<the material's own section>?highlight=<id>`.
6. All dates are UTC: parse `YYYY-MM-DD` as UTC and format with `timeZone:'UTC'`, giving "2 Nov".
7. Unlink sends `requiredForWorkId: null`. Once 01 merges, verify it with a live curl PATCH. If it fails: a CR to 01, no client workaround.
8. Multi-select linking sends one `useEditItem` per changed material. Each option shows the work it is currently linked to.
9. Tests: fake timers with `findBy*` (`advanceTimers`), reset the autosave singleton in `afterEach`, successful PATCH mocks, and an explicit `today`.
10. Names render as plain text; no `dangerouslySetInnerHTML`.

### Rulings on the disputed points
- **Duration column** = `end − start + 1` calendar days (inclusive: 19–30 Oct = 12 d). **Shift** keeps `end − start` (AC-05.3: 19.10–30.10 → 28.10–08.11).
- **Shift target** = the latest `deliveryDate` among the work's `blockingMaterials`. There is one action per work, and every alert of that work shows the same target, so one click always unblocks the work.
- **Alert text:** `"<material name> (<code>) arrive <d Mon>, <n> days after <work name> starts (<d Mon>)"` (the BLOCK's wording, kept literally). INVALID_DATES: `"<work name> (<code>): end <d Mon> is before start <d Mon>"`.
- **Badge** = BLOCKED + INVALID_DATES works in the section; `contingency` has no badge.
- **◆** at `deliveredDate ?? deliveryDate`. UNSCHEDULED materials have no marker; they appear as an "unscheduled" chip.
- **Contingency used** = Σ `overrunCents` of every `overrunLines` entry except the contingency line (whole project, the AC's literal text).
- **Readiness labels:** READY → `Ready`; BLOCKED → `Blocked: <first blocking material> arrive <n> days late` (worst delay); INVALID_DATES → `Invalid dates`.

## Affected files
Only those listed above + `apps/web-e2e/src/construction.spec.ts`. CR: `shared/change-requests/CR-05-add-days.md` (an `addDays` export in the engine). The integrator commits it.

## Risks
| Risk | Mitigation |
|---|---|
| 02's `EditableTable`/cell/SubNav API differs from DESIGN-SYSTEM §5 | read 02's HANDOFF and code after `w0-frozen` before writing the columns; adapt only `construction-columns.tsx` |
| `useSchedule` returns a new object on every edit → every row re-renders | rows get primitives through `React.memo`; render-counter test (AC-05.13) |
| `requiredForWorkId: null` is rejected by the DTO | a live curl check after 01; otherwise a CR |
| Timezone drift in dates | UTC parse/format, one helper, tested exactly |
| The autosave singleton leaks timers between tests | flush/reset in `afterEach`, `vi.useRealTimers()` |
| Seed data arrives later (03) | fixtures from engine factories with the GERMANY-DATA §7 dates |

## Test strategy (ACs; the registry is BLOCK.md, tests are tagged `[AC-05.N]`)
Fixture `F`: today 2026-10-14; WORK `WRK-WIN-001` Window installation 2026-10-19 → 2026-10-30; MAT `MAT-WIN-001` Windows delivery 2026-10-28 → that work; MAT front door 2026-10-16 → the same work; WORK `WRK-HEA-001` heating installation 2026-11-02 → 2026-11-27; MAT heat pump 2026-11-20 → it; overrun lines: concrete, electrical.
- AC-05.1 (component) F → the banner shows `Windows (MAT-WIN-001) arrive 28 Oct, 9 days after Window installation starts (19 Oct)`; the row shows `Blocked`; alerts are sorted heat pump (18) before windows (9).
- AC-05.2 (component) the material's delivery set to 2026-10-19 (same day) through the cache → alert gone, row `Ready`, no GET refetch. Model: 2026-10-20 → a 1-day alert.
- AC-05.3 (model + component) shift 19.10/30.10 → 28.10/08.11; the click sends exactly one PATCH `{startDate, endDate}` after 400 ms.
- AC-05.4 (model + component) entering end < start → a message containing "Invalid dates", no PATCH; data that already has end < start → readiness `Invalid dates` and a banner entry.
- AC-05.5 (component) the Gantt has one bar per WORK and one ◆ per dated linked material; the windows ◆ has the risk class and the front door ◆ does not; there is a Today line.
- AC-05.6 (model + component) `contingency` shows the reserve and "Used by overruns" = Σ overruns of other lines; no table.
- AC-05.7 (e2e, integrator) duplicate Taucha → construction/windows-install → the alert "9 days" → Materials: windows delivery 2026-10-18 → back on Construction the alert is gone.
- AC-05.8 (component) the SubNav badge = the number of BLOCKED + INVALID_DATES works per section (windows-install 1, heating-install 1).
- AC-05.9 (component) `/construction` with no section redirects to `lastSection.construction`, otherwise to the first section; visiting a section stores it.
- AC-05.10 (component) clicking a material chip navigates to `/projects/:id/materials/<material section>?highlight=<id>`.
- AC-05.11 (component) linking a material in the multi-select sends one PATCH of the material with `requiredForWorkId` = work id; unlinking sends `null`.
- AC-05.12 (component) "Shift work start" with two late materials on one work targets the latest delivery date.
- AC-05.13 (component) editing one work row does not re-render the other rows (render counter).

## How to verify
`bash $BIN/check.sh 05` → `CHECK: PASS` (affected lint/test/typecheck/build for web). `bash $BIN/ac-ledger.sh --block 05` → no UNCOVERED among the unit ACs. e2e (AC-05.7) is run by the integrator: `bash howItWorks/bin/e2e.sh --grep construction`.

## Open questions
- ~~Duration~~: **answered by the owner (2026-10-14): inclusive, 12 d.**
- The UNSCHEDULED material has no ◆ (no date to place it at): recorded for SOLUTION.md.

## As built (2026-10-14)
Commits on `feat/05-construction-works`: `c2064fc` feature, `388ecdd` merge main, `af38a15` CR-05 swap. `check.sh 05` PASS, AC ledger 12 OK + AC-05.7 (e2e) for the integrator.

| File | What it is |
|---|---|
| `construction-page.tsx` | `ConstructionPage`: redirect to the remembered or first section (:101), `useMemo` over one `scheduleOf` run → alerts, badges, Gantt; `onShift` = `editItem(work, shiftWorkToDate(...))`; contingency → `ContingencyPanel`, otherwise `EditableTable` with `CONSTRUCTION_COLUMNS` |
| `use-construction-schedule.ts` | `scheduleOf` (:14): `checkSchedule` memoised in a `WeakMap` keyed by the cache's `items` array, so N row selectors cost one engine run per cache version. `useWorkReadiness` / `useLinkedMaterials` select **primitives / structurally shared arrays** per row |
| `construction-columns.tsx` | module-scope `CONSTRUCTION_COLUMNS` (stable reference): Code · Work item · Volume · Rate · Planned · Committed · Actual · Status · Contractor (OrgCell, CONTRACTOR) · Start · End · Duration · Materials · Readiness |
| `work-cells.tsx` | `WorkDateCell` (:45, the "Invalid dates" guard before any PATCH), `ReadinessCell` (:83, `data-conflict` + ⚠), `MaterialChips` (:208) + `LinkMaterialsModal` (:137, checkbox per project material, "currently: <work>") |
| `schedule-alerts.tsx` | `ScheduleAlerts`: `role="alert"` region "Schedule conflicts"; Open material / Shift work start / Open work |
| `construction-gantt.tsx` | CSS bars per WORK (tone by readiness), ◆ per dated linked material (`data-late`, `text-risk-600`), Today line, list on mobile |
| `contingency-panel.tsx` | reserve / used by overruns / remaining + the overrun lines with links |
| `construction-fixture.ts` | test fixture only |

Invariants:
1. No status logic outside the engine: the model reshapes `checkSchedule` output; the only own check is the draft-date validation.
2. One edit re-renders one row (AC-05.13): columns are module-scope, and readiness/chips subscribe per row through `select`.
3. All date text is UTC with fixed month names; duration is inclusive (owner, 2026-10-14); the shift keeps `end − start`.
4. Unlinking sends `requiredForWorkId: null`: checked live on the API (200, stored `null`).

Deviations from this spec: `buildGanttRows` was renamed `buildGanttModel` (it also returns the date range); the row tint uses `tr:has([data-conflict])` on the wrapper because 02 owns `<tr>`.
