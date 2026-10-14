<!-- paths: apps/web/src/features/construction/**, apps/web-e2e/src/construction.spec.ts | Construction tab: works, schedule conflicts, Gantt, contingency -->
# Construction tab (block 05)

Route `/projects/:projectId/construction/:section?` → `ConstructionPage`. Shows the project's WORK rows per
construction section, a "Schedule conflicts" banner (late materials vs work starts, invalid work dates) with a
one-click "Shift work start", SubNav conflict badges, a CSS mini Gantt with delivery markers and a Today line,
and the contingency reserve panel. Everything is a pure reshaping of the shared snapshot cache and the engine's
`checkSchedule`, so a delivery-date edit on Materials clears or raises an alert here immediately.

## Key files
- `apps/web/src/features/construction/construction-page.tsx:34` `ConstructionPage`: remembers the section (:49-:51); one `useMemo` per cache version runs `scheduleOf` once and derives alerts, badge counts and the Gantt (:53-:62); `onShift` = `editItem(work, shiftWorkToDate(...))` (:64); add work with `nextWorkCode` (:75); redirect without a section (:100-:108); contingency → `ContingencyPanel`, otherwise `EditableTable` with `CONSTRUCTION_COLUMNS` and a conflict row tint (:155).
- `use-construction-schedule.ts:14` `scheduleOf` (`checkSchedule` memoised in a `WeakMap` keyed by the items array); `:28` `useWorkReadiness`, `:64` `useLinkedMaterials` (per-row primitive / structurally shared selections).
- `construction-model.ts` (pure, unit-tested): `formatDayMonth` :46 (UTC, fixed month names, "2 Nov"), `workDurationDays` :52 (inclusive), `validateWorkDates` :64, `shiftWorkToDate` :74 (keeps `end − start`, uses engine `addDays`), `shiftTargetForWork` :87, `buildScheduleAlerts` :131, `conflictCountBySection` :187, `readinessLabel` :203, `buildGanttModel` :265, `contingencyUsage` :373, `nextWorkCode` :387.
- `construction-columns.tsx:18` `CONSTRUCTION_COLUMNS` (module scope): Code · Work item · Volume · Rate · Planned · Committed · Actual · Status · Contractor (`OrgCell`, CONTRACTOR) · Start · End · Duration · Materials · Readiness.
- `work-cells.tsx`: `WorkDateCell` :45 ("Invalid dates" guard before any PATCH), `ReadinessCell` :83 (`data-conflict` + ⚠), `LinkMaterialsModal` :137 (checkbox per project material, "currently: <work>"), `MaterialChips` :208.
- `schedule-alerts.tsx:14` `ScheduleAlerts` (`role="alert"`, "Schedule conflicts"; Open material / Shift work start / Open work).
- `construction-gantt.tsx:29` `ConstructionGantt` (bars per WORK, ◆ per dated linked material, late ◆ in risk colour, list on mobile).
- `contingency-panel.tsx:16` `ContingencyPanel` (reserve / used by overruns / remaining + overrun links).
- e2e `apps/web-e2e/src/construction.spec.ts:23` and `:58` [AC-05.7].

## Invariants
- No status logic outside the engine: readiness, blocking materials and delays come from `checkSchedule`;
  the only local check is draft-date validation (end < start → no PATCH).
- One work edit re-renders one row (columns module-scope, readiness/chips subscribe per row).
- All date text is UTC; duration is inclusive (19–30 Oct = 12 d, owner decision); a shift keeps `end − start`.
- Shift target = the latest `deliveryDate` among the work's blocking materials, so one click unblocks the work;
  it sends exactly one PATCH `{startDate, endDate}`.
- Linking writes `requiredForWorkId` **on the material** (one `useEditItem` per changed material); unlinking
  sends `null` (verified live: 200, stored `null`).
- Contingency "used" = Σ `overrunCents` of every overrun line except the contingency line (whole project).
- Alert text keeps the BLOCK's wording: "<material> (<code>) arrive <d Mon>, <n> days after <work> starts (<d Mon>)".
- Never imports `features/materials`; chips link by URL to `materials/<section>?highlight=<id>` (`lineHref`).

## Decisions / deviations
- CR-05 (applied by 00, `1e0fe11`): `addDays` is exported by the engine; the local UTC helper was removed.
- The kit has no AlertBanner or WORK readiness cell: local `ScheduleAlerts` and `ReadinessCell`.
- Row tint: 02 owns `<tr>`, so the readiness cell carries `data-conflict` and the wrapper styles
  `tr:has([data-conflict]) td` (jsdom does not evaluate it; tests assert the attribute).
- `buildGanttRows` was renamed `buildGanttModel` (also returns the date range).
- Unlike Materials, the redirect without a section does not carry the query string, and an unknown section
  renders "Unknown section." instead of redirecting.

## Known gaps
- No cascade re-plan of later works after a shift (non-goal).
- UNSCHEDULED materials get no ◆ (no date); their chip says `unscheduled`.
- Add-work has no 409 retry (Materials has one).
