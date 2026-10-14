# 05 — "Construction" tab: works, schedule, material/work conflicts

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `05`). Start: `bash $BIN/bootstrap.sh 05` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 05` → `bash $BIN/merge-block.sh 05`.

**Wave:** W1 · **Priority:** MUST · **Estimate:** 60–75 min · **Worktree:** `Kairon-wt/05-construction-works` (gate and base: `bin/blocks.conf`)
**In parallel:**
- **04 materials** shows the same conflict from the material side (the "Schedule" column). Both of you take the result from `useSchedule(projectId)` (02) → `checkSchedule` (01). **Same numbers, one algorithm.**
- **06 profitability** uses work dates in the cash flow, so changing start/end shifts its chart.
- **03 seed** provides the demo conflicts (windows +9 days, heat pump +18 days).

## Goal
Route `/projects/:id/construction/:section?`.
- SubNav of the 15 CONSTRUCTION sections (incl. `contingency`, which has no rows: show the reserve and its use). The badge shows the number of conflicts.
- A table of WORK rows plus **conflict alerts**.
- A mini Gantt chart for the project.
- BudgetHealthPanel.

## You own
`apps/web/src/features/construction/**` (body of `construction-page.tsx`, export `ConstructionPage`), `apps/web-e2e/src/construction.spec.ts`.

## Table columns
Code · Work item · Volume + unit · Rate · Planned amount · Committed · Actual · Status · **Contractor** (OrgCell → modal) · **Start** · **End** · Duration (days, computed) · **Materials** (chips of the linked materials: name + schedule status; clicking one opens the row in Materials) · **Readiness** (rightmost, from `ScheduleResult.kind==='WORK'`: READY → `Ready`, BLOCKED → `Blocked: Windows arrive 9 days late`, INVALID_DATES → `Invalid dates`).

## Alerts and the algorithm
- At the top of the tab: an **AlertBanner** listing every `LATE_FOR_WORK` and `INVALID_DATES` in the project, sorted by delay: "Windows (MAT-WIN-001) arrive 28 Oct, 9 days after Window installation starts (19 Oct)". Actions: "Open material" and "Shift work start to 28 Oct" (a PATCH on the work's start/end that keeps the duration).
- A conflicted row gets a soft red background and a ⚠ icon. Hovering shows the reason.
- The conflict updates **live**: changing a delivery date in Materials or the start here changes the alert immediately, from the shared cache.
- The algorithm lives only in the engine (`checkSchedule`). Here you only display it. If you are missing a field, write a CR to 01's engine.

## Mini Gantt (`construction-gantt.tsx`)
- A horizontal bar per work item (grouped by section), plus delivery markers (◆) for the linked materials, and a "Today" line (`useToday()`).
- Red marker = late. Built with plain SVG or div/CSS grid. No new libraries.
- On mobile it collapses into a list.

## Steps
1. Columns `construction-columns.tsx`, page, `schedule-alerts.tsx`, `construction-gantt.tsx`.
2. Adding or deleting a work row, choosing the contractor (role CONTRACTOR). Linking a material to the work is a multi-select over the project's MATERIAL rows (PATCH `requiredForWorkId` on the material).
3. Remember the section in `useUiStore.lastSection.construction`.
4. e2e spec: open Windows installation → the alert "9 days" is visible → in Materials move the windows delivery to 2026-10-18 → back in Construction the alert is gone.

## Acceptance criteria
- AC-05.1 (Vitest) The fixture with windows +9 days → AlertBanner shows the text with "9 days" and the row has the `Blocked` status.
- AC-05.2 (Vitest) Changing the material's delivery date to the same day as the work start → the alert disappears without a reload (same day = OK).
- AC-05.3 (Vitest) "Shift work start" keeps the duration: start 19.10, end 30.10 → start 28.10, end 08.11; one PATCH.
- AC-05.4 (Vitest) end < start → `Invalid dates` and a validation message, no PATCH.
- AC-05.5 (Vitest) The Gantt renders a bar for every work item and a ◆ for every linked material; a late ◆ has the risk tone.
- AC-05.6 (Vitest) The `contingency` section shows the reserve (approved) and "Used by overruns" = Σ overrun of other lines (engine) without a table.
- AC-05.7 (e2e, integrator) The scenario from step 4 (cross-tab, live).

Added by the block session from the panel (DESIGN.md):
- AC-05.8 (Vitest) The SubNav badge shows the number of BLOCKED + INVALID_DATES works per section (fixture: windows-install 1, heating-install 1); `contingency` has no badge.
- AC-05.9 (Vitest) `/construction` without a section redirects to `lastSection.construction`, otherwise to the first section; visiting a section stores it.
- AC-05.10 (Vitest) Clicking a material chip navigates to `/projects/:id/materials/<material's section>?highlight=<id>`.
- AC-05.11 (Vitest) Linking a material sends one PATCH of the material with `requiredForWorkId` = the work id; unlinking sends `null`.
- AC-05.12 (Vitest) "Shift work start" on a work with two late materials targets the latest delivery date.
- AC-05.13 (Vitest) Editing one work row does not re-render the other rows (render counter).

## Verify
`npx nx test web && npx nx lint web && npx nx typecheck web`.
