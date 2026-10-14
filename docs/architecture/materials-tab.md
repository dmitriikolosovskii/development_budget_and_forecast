<!-- paths: apps/web/src/features/materials/**, apps/web-e2e/src/materials.spec.ts | Building materials tab -->
# Building materials tab (block 04)

Route `/projects/:projectId/materials/:section?` → `MaterialsPage`. Shows the MATERIALS category summary
(the CFO's 5 answers + "N lines over budget"), a SubNav of the project's MATERIALS lines with `Over` / `N late`
badges, an editable table of the section's MATERIAL rows with the schedule flag rightmost, a section budget
strip (forecast, editable approved, variance) and `BudgetHealthPanel` for the line. A thin feature over
02's kit: every value is derived from the shared snapshot cache, every write goes through 02's hooks, so the
KPI strip, Construction and Profitability recalculate on the same edit (see `integration-flow.md`).

## Key files
- `apps/web/src/features/materials/materials-page.tsx:61` `MaterialsPage`; remembers the section (`setLastSection` :78); SubNav badges built from `byLine.overrun` + `useLateCountsByLine` (:72-:105); redirect without/unknown section at :114-:119 (remembered → first, keeps `location.search`, `replace`).
- `materials-page.tsx:27` `useAddMaterial`: one create at a time (`pending` ref), code from `nextItemCode`, defaults "New material" / `pcs` / 0 / 0, one retry on HTTP 409 (:49).
- `materials-columns.tsx:16` `MATERIAL_COLUMNS` (module scope, stable): Code (+ delete) · Item · Qty · Unit price · Planned · Committed · Actual · Status · Supplier (`OrgCell role="SUPPLIER"` :60) · Installer (`role="CONTRACTOR"` :68) · Delivery (`<code> delivery date` :74) · Needed by · Schedule.
- `materials-cells.tsx`: `PlannedAmountCell` :27 (`itemPlannedCents`), `ActualCell` :37 (locked with "Managed by delivery tracking" when the row has DELIVERED deliveries), `NeededByCell` :53 (read-only link to the linked work in Construction), `MaterialScheduleCell` :67, `DeleteMaterialButton` :73 (inline `role="dialog"` "Delete <code>?", disabled with "Has recorded deliveries").
- `use-materials.ts`: `scheduleOf` :31 (engine `checkSchedule` memoised in a `WeakMap` on the items array), `useItemSchedule` :49, `useHasDeliveredDeliveries` :69, `useNeededBy` :84, `useLateCountsByLine` :107, `MATERIAL_CATALOG` :8, `codePrefixOf` :11.
- `next-item-code.ts:6` `nextItemCode`: `MAT-<prefix>-NNN` = max NNN over all project items + 1.
- `materials-footer.tsx:9` `sectionTotals` (table footer: planned/committed/actual, `data-testid="section-planned"`), `:27` `SectionBudget` (forecast, approved via `useEditBudgetLine`, `section-variance`).
- `materials-overview.tsx:10` `MaterialsOverview` (category Summary from `useProjectSummary`).
- e2e `apps/web-e2e/src/materials.spec.ts:20` [AC-04.8] on a duplicate of `taucha-stadtvilla`.

## Invariants
- No own schedule, money or date logic: statuses come from `checkSchedule`, amounts from engine rollups
  (`byLine`, never re-rounded), input parsing from `parseEurToCents`/`parseQtyToMilli` inside 02's cells.
- One row edit re-renders one row: columns are module-scope and per-row cells select primitives
  (schedule result, delivered flag, needed-by) from the cache.
- New codes never reuse gaps: the code is the CSV delivery-import key (block 10).
- A row with DELIVERED deliveries: Actual is read-only (block 10 recomputes it) and delete is disabled.
- `requiredForWorkId` is never written here (Construction owns the link); Needed by is display-only.
- Organisation pickers filter by role, but the current value is always shown even if its role differs.

## Decisions / deviations
- Per-item schedule uses a local memo (`scheduleOf`) instead of a CR to 02 for a per-item `useSchedule`;
  same engine call, one run per cache version.
- Delete is a custom inline control in the Code cell, not `EditableTable.onDelete` (needed for the blocked
  rule and to keep Schedule rightmost).
- Retry on code conflict only for 409 (01 maps the unique `(projectId, code)` violation to `ConflictException`);
  the first failure still shows 02's "Could not add the row" toast.
- Owner (2026-10-14): deleting a material with recorded deliveries is blocked — UI rule only, the API cascades.
- The e2e quantity edit uses PLANNED row `MAT-ELE-008` (forecast = planned, so the KPI moves) and opens the
  supplier modal from `MAT-ELE-001`; block 04's HANDOFF still describes editing `MAT-ELE-001` to 900.

## Known gaps
- The delete block for delivered rows is not enforced by the API.
- `test-utils.tsx` is type-checked with the app tsconfig, so it duplicates `fakeResponse`/QueryClient instead
  of importing `testing/render.tsx`.
- Mobile uses 02's card layout (all columns except Needed by); no dedicated card component.
