# DESIGN — 04 "Building materials" tab (2026-10-14)

Spec produced by /brainstorm in block mode: context → 3 approaches → panel (prosecutor, advocate, architect, tester) → judge.
Verdict: **positive for A**, risk **medium**. **Implemented** on `feat/04-building-materials` (`7eca527`, `509b501`). `check.sh 04` PASS. The as-built differences are in the section at the end and in HANDOFF.md.

## Goal
Route `/projects/:projectId/materials/:section?` (CONTRACTS §7). It contains:
- a SubNav of the 12 MATERIALS sections, with an overrun and a late badge;
- an editable table of the section's MATERIAL rows, with the rightmost Schedule flag;
- BudgetHealthPanel for the line;
- the MATERIALS summary on top (the CFO's 5 answers).

Every edit is optimistic through the shared cache, so the KPI strip, Profitability (06) and Construction (05) recalculate at once.

## Non-goals
- No date or schedule logic of our own (the engine `checkSchedule` only).
- No money parser of our own.
- No table component of our own.
- Linking a material to a work (`requiredForWorkId`) is written by 05 only. In 04 "Needed by" is read-only.
- Delivery import (10) and BOQ quantities (08) are not edited here; we only display their effect.
- No `?highlight` / `?org` handling (02 owns it).

## Chosen approach — A: a thin feature over 02's kit
- `materials-columns.tsx` is a **column factory** for 02's `EditableTable({rowIds, useRow, columns, onEdit, onAdd, onDelete, footer})`.
- Rows come from `useItemIds(projectId, lineId)` + `useItem`; rows are memo rows, provided by 02.
- Cells that need more than the row itself (Schedule, Needed by, locked Actual, org name) are small components with **narrow selectors returning primitives**, so structural sharing keeps the other rows still.

Why not the others:
- **B** (a table owned by the feature) duplicates the kit: keyboard handling, mobile cards, `?highlight`. That breaks BLOCK step 1 and DESIGN-SYSTEM "use only the kit".
- **C** (a page-level view model) gives a new row array on every edit, so every row re-renders. AC-04.6 fails, and it creates a second derived copy that can drift from the cache.

## Judge constraints (mandatory)
1. **Schedule:** only engine `checkSchedule`, through 02's `useSchedule(projectId)`.
   - Rows/cells never subscribe to the whole result. Each one selects its own `ScheduleResult` and compares by value.
   - If 02 has no per-item form, write a CR to 02 (`useScheduleFor`). Fallback: a local memo keyed on the snapshot's items array that calls the engine.
2. **Stable `columns`:** at module level, or a `useMemo` over stable deps. AC-04.6 uses a render counter that also covers the Schedule, Needed-by and Actual cells.
3. **Locked actual, needed-by, org names:** per-row selectors returning a boolean, string or number. Check after the merge that the cache holds `deliveries`.
4. **Edits:** only `useEditItem` / `useEditBudgetLine` / `useCreateItem` / `useDeleteItem`. Cells commit on blur or Enter. The layout's `flush()` sends on a route change. AC-04.2: exactly one PATCH, with fake timers and `advanceTimersByTimeAsync`.
5. **Money input:** 01's `parseEurToCents` / 02's `MoneyCell`. If they accept `12,5,0` or `-3`, write a CR. No local parser.
6. **New row code:**
   - `MAT-<codePrefix>-NNN` = max NNN over **all project items** with that prefix, plus 1, no reuse of gaps. The code is the CSV delivery-import key, so a reused code could attach an old delivery file to a new item.
   - "Add" is disabled while a create is pending.
   - On a 409 or 400 duplicate code: recompute, retry once, then toast.
7. **Redirect without `:section`:** go to `lastSection.materials` only if it is in the MATERIALS catalogue, otherwise the first section. Keep the query string (`?highlight`, `?org`) and navigate with `replace`.
8. **Needed by:** read-only. The link is a URL string `/projects/:id/construction/<work line section>?highlight=<workId>`. No import from `features/construction`.
9. **Pickers:** supplier = organisations with `role === 'SUPPLIER'`, installer = `role === 'CONTRACTOR'`. 03's BLOCK says `contractorId` is "the installation contractor". The current value is always shown even if its role differs. Organisation data is rendered as text only.
10. **Delete:** an inline popover (`role="dialog"`), exactly one DELETE, never `window.confirm`.
11. **Missing kit pieces:** compose the org picker, locked cell and footer through 02's render/footer slots. CR to 02 only if the slots don't exist.
12. **Tests:**
    - Use `fireEvent` unless `@testing-library/user-event` is installed.
    - Reset the autosave singleton and the persisted zustand store between tests.
    - Stub `matchMedia` and `scrollIntoView`.
    - Use QueryClient `staleTime: Infinity`, `retry: false`.

## Files (all owned by 04, `bin/blocks.conf` row 04)
`apps/web/src/features/materials/`:
- `materials-page.tsx`: export `MaterialsPage`, replaces the placeholder body. Handles the redirect, SubNav, table, panel and mobile layout.
- `materials-columns.tsx`: the column factory.
- `materials-cells.tsx`: Schedule, NeededBy, LockedActual, OrgPicker and the delete popover.
- `materials-overview.tsx`: MATERIALS category summary.
- `materials-footer.tsx`: section totals and editable approved.
- `use-materials.ts`: narrow selectors: section lines, badges, per-item schedule, `hasDeliveredDeliveries`, needed-by.
- `next-item-code.ts`: the code generator, a pure function.
- `*.spec.ts(x)` and `test-utils.tsx`.

Plus `apps/web-e2e/src/materials.spec.ts`.

## Columns (left → right)
| # | Column | Behaviour |
|---|---|---|
| 1 | Code | read-only |
| 2 | Item | name plus a muted description; editable text |
| 3 | Qty + unit | `QtyCell` |
| 4 | Unit price | `MoneyCell` |
| 5 | Planned amount | computed with `itemPlannedCents`, read-only |
| 6 | Committed | editable |
| 7 | Actual | editable; locked with a lock icon and the tooltip "Managed by delivery tracking" when the item has DELIVERED deliveries |
| 8 | Status | `StatusCell` |
| 9 | Supplier | `OrgCell`: click opens the modal, plus a picker |
| 10 | Installer | `OrgCell`: click opens the modal, plus a picker |
| 11 | Delivery date | `DateCell` |
| 12 | Needed by | read-only date, links to Construction |
| 13 | Schedule | `ScheduleFlagCell`: `On time` / `At risk · N d` / `Late for work · N d` / `Overdue` / `Delivered` / `Unscheduled` |

Footer: section planned / committed / actual / forecast, from engine `byLine`, never re-rounded. Approved is editable through `useEditBudgetLine`.

SubNav badges:
- **overrun:** `byLine[lineId].overrun`, risk tone;
- **late:** the count of section rows with `LATE_FOR_WORK` or `OVERDUE`.

## Risks
1. 02's kit may be missing a piece (a per-item schedule select, a picker or locked cell, a footer slot). Then compose locally or write a CR to 02, which costs time.
2. AC-04.6 and AC-04.2 can quietly fail through a hook that returns a project-wide object, or through the order of commit and flush. Render-counter and PATCH-count tests guard both.
3. Code collision on a create race. The DB unique constraint keeps the data safe; the 409 path keeps the UX clean.

## Test strategy (Vitest + Testing Library; tags `[AC-04.N]`)
**Harness** (`test-utils.tsx`):
- a QueryClient seeded with `setQueryData(['project', id], …)` through 02's normaliser, plus `['organizations']`;
- `MemoryRouter` with the materials route and a stub profitability route;
- `fetch` as a `vi.fn` that records PATCH/POST/DELETE calls;
- `useToday` mocked to `2026-10-14`.

**Fixture**, built with `makeSnapshot`:
- `concrete` (overrun, DELIVERED with a Delivery);
- `windows-doors`: MAT-WIN-001, delivery 2026-10-28, linked to WRK-WIN-001 starting 2026-10-19, so 9 d;
- `electrical`: overrun, NYM-J;
- `masonry`: OVERDUE.

| AC | What |
|---|---|
| AC-04.1 | Changing qty/price changes the row amount, footer total and KpiStrip before the PATCH |
| AC-04.2 | section → tab → back: the edit is kept, exactly 1 PATCH |
| AC-04.3 | `Late for work · 9 d` for windows, `Delivered` for concrete |
| AC-04.4 | Supplier click opens OrganizationModal with the right organisation; Esc closes it |
| AC-04.5 | `12,5,0` and `-3` are rejected with a message and no PATCH |
| AC-04.6 | Editing one row does not re-render other rows or their cells |
| AC-04.7 | Overrun badge on `concrete` and `electrical` |
| AC-04.8 | e2e (integrator): NYM-J qty → total and KPI → reload is kept; supplier → modal with a phone |
| AC-04.9 | Add in `windows-doors` with 001 and 003 present gives `MAT-WIN-004` (max+1, no gap reuse, over all project items) |
| AC-04.10 | `/materials` without a section goes to the remembered valid section, otherwise the first, with the query string kept |
| AC-04.11 | Delete: inline popover; cancel sends nothing, confirm sends exactly 1 DELETE, `window.confirm` is never called |
| AC-04.12 | A row with a DELIVERED delivery has a locked Actual with the tooltip "Managed by delivery tracking"; other rows are editable |
| AC-04.13 | Footer approved edit updates the panel and variance immediately, then exactly 1 PATCH `budget-lines/:lineId` after 400 ms |

## How to verify
`bash $BIN/check.sh 04` → `CHECK: PASS`. It covers ownership, format, affected lint/test/typecheck/build, test weakening and the AC ledger for block 04.

## Open questions
- ~~Deleting a material with DELIVERED deliveries~~ — **answered by the owner (2026-10-14): block it.** The delete button is disabled with the tooltip "Has recorded deliveries", so delivery history and actuals are never lost silently. Guarded by AC-04.11.

## As built (2026-10-14)
Same file set as planned, except:
- there is no `materials-subnav`: the badges are built in `materials-page.tsx` from `useLateCountsByLine` + `byLine.overrun`;
- `next-item-code.spec.ts` and `materials-renders.spec.tsx` were added (the render counter wraps `useItem`, `useItemSchedule` and `useHasDeliveredDeliveries` with `vi.mock`).

Deviations from the judge's constraints:
1. **Constraint 1:** fallback memo `scheduleOf` over the engine, no CR to 02. 02 was already finished.
2. **Constraint 6:** retry on 409 only.
3. **Constraint 10:** own inline delete in the Code cell instead of `EditableTable.onDelete`. It is needed for the blocked-delete rule and keeps Schedule the rightmost column.

The table footer holds planned/committed/actual. Forecast, the editable approved amount and variance sit in the `SectionBudget` strip under the table.
At 05's request, the delivery date cell's accessible name is `<code> delivery date`.
