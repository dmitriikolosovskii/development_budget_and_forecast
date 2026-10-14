# 04 — "Building materials" tab

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `04`). Start: `bash $BIN/bootstrap.sh 04` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 04` → `bash $BIN/merge-block.sh 04`.

**Wave:** W1 · **Priority:** MUST · **Estimate:** 60–75 min · **Worktree:** `Kairon-wt/04-building-materials` (gate and base: `bin/blocks.conf`)
**In parallel:**
- **05 construction** builds the same kind of table for WORK rows and shows the reverse side of the conflict (works blocked by late materials). Your "Schedule" column and their alert are computed by **the same** `checkSchedule` from the engine. Don't write your own date logic.
- **06 profitability** reads the same cache. Your edits must change its numbers instantly (that's the cross-tab AC).
- **03 seed** gives real data after its merge (`git merge main` + `npx prisma db seed`). Until then, work on `makeSnapshot()` fixtures from the engine.
**Later:** 08 architecture edits BOQ quantities, which change your quantities through the API. 10 deliveries changes `deliveryDate`/`deliveredDate`/`actualCents` in your rows. Show those fields read-only where needed (actual is locked when the item has DELIVERED deliveries: a lock icon plus a tooltip "Managed by delivery tracking").

## Goal
Route `/projects/:id/materials/:section?`.
- On the left, a SubNav of the 12 MATERIALS sections (CONTRACTS §4) with a badge for overrun/late counts.
- In the middle, an editable table of the section's MATERIAL rows.
- On the right, `BudgetHealthPanel` for the section.
- At the top of the tab, a summary across all MATERIALS (the CFO's 5 answers).

## You own
`apps/web/src/features/materials/**` (replace the body of `materials-page.tsx`, export `MaterialsPage`), `apps/web-e2e/src/materials.spec.ts`.

## Table columns (left to right)
Code · Item (name, description) · Qty + unit · Unit price · **Planned amount** (computed) · Committed · Actual · Status (ItemStatus) · **Supplier** (OrgCell → modal) · **Installer** (OrgCell → modal) · Delivery date · Needed by (start of the linked work, read-only, link to Construction) · **Schedule** (rightmost: ScheduleFlagCell: `On time` / `At risk · 2 d` / `Late for work · 9 d` / `Overdue` / `Delivered` / `Unscheduled`).
Footer: section totals (planned/committed/actual/forecast) and the approved amount for the line, editable (`useEditBudgetLine`).
Actions: add a row (code generated as `MAT-<PREFIX>-NNN`, the next free number, with the prefix from `BUDGET_CATALOG`), delete with confirmation (an inline popover, no browser `confirm`), pick supplier/installer from organisations by role.

## Steps
1. Use 02's hooks and kit (paths in CONTRACTS §6), including `useOrganizations()` for the supplier/installer pickers: `useItemIds(projectId, lineId)`, `useItem`, `useEditItem`, `EditableTable`, the cells. Do not create your own fetch or state.
2. Column config in `materials-columns.tsx`; page `materials-page.tsx`; section summary `materials-overview.tsx`.
3. Remember the last section: `useUiStore.lastSection.materials`. Opening the tab without `:section` goes to the remembered section or the first one.
4. Mobile: row cards (name, amount, schedule badge) → Sheet with the editor.
5. e2e spec (run by the integrator): edit the quantity of the NYM-J cable → the section total and the KPI change → reload → the value is still there; click the supplier → modal with a phone number.

## Acceptance criteria
- AC-04.1 (Vitest) Changing qty/price changes the row amount, the section footer total and the KpiStrip immediately (before the PATCH).
- AC-04.2 (Vitest) Switch section → switch tab → come back: the unsaved edit is in place and exactly one PATCH has gone out (fake timers).
- AC-04.3 (Vitest) The Schedule column for the fixture shows `Late for work · 9 d` for windows and `Delivered` for concrete.
- AC-04.4 (Vitest) Clicking the supplier opens OrganizationModal with the right organisation; Esc closes it.
- AC-04.5 (Vitest) A money cell rejects `12,5,0` and `-3` (validation message, no PATCH).
- AC-04.6 (Vitest) Editing a row does not re-render the other rows (render counter).
- AC-04.7 (Vitest) SubNav shows the overrun badge on `concrete` and `electrical` for the seed-like fixture.
- AC-04.8 (e2e, integrator) The scenario from step 5.

Added by the block 04 brainstorm (DESIGN.md, judge's constraints):
- AC-04.9 (Vitest) "Add row" in `windows-doors` with `MAT-WIN-001` and `MAT-WIN-003` in the project creates `MAT-WIN-004` (max+1 over all project items, gaps are not reused).
- AC-04.10 (Vitest) `/materials` without a section redirects to the remembered section if it is a valid MATERIALS section, otherwise to the first one; the query string (`?highlight`, `?org`) is kept.
- AC-04.11 (Vitest) Delete opens an inline popover: cancel sends nothing, confirm sends exactly one DELETE; `window.confirm` is never called. A row with DELIVERED deliveries cannot be deleted (button disabled, tooltip "Has recorded deliveries"; owner's decision 2026-10-14).
- AC-04.12 (Vitest) A row with a DELIVERED delivery shows Actual read-only with the tooltip "Managed by delivery tracking"; a row without one is editable.
- AC-04.13 (Vitest) Editing the approved amount in the footer updates the variance immediately and sends exactly one PATCH to `budget-lines/:lineId` after 400 ms.

## Verify
`npx nx test web && npx nx lint web && npx nx typecheck web`.
