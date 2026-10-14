# HANDOFF — 04-building-materials

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
`check.sh 04` → **CHECK: PASS** (ownership, format, affected lint/test/typecheck/build, test weakening all exit 0).
AC ledger `--block 04`: 12 OK, AC-04.8 UNRUN (e2e, run by the integrator).

Branch `feat/04-building-materials`:
- `7eca527` feat(materials): the tab
- `509b501` fix: test-utils typecheck

**Merged into main** by `merge-block.sh 04` at 11:49: merge commit `2749d1e`; check.sh passed again after main was merged in.
The block's web tests: 24 tests in 3 files. The whole web suite (`nx test web`): 75 tests.

## Ready for neighbours

Route `/projects/:projectId/materials/:section?` → `MaterialsPage` (`apps/web/src/features/materials/materials-page.tsx`).

**Layout, top to bottom:**
- `MaterialsOverview`: the CFO's 5 answers for MATERIALS (Approved · Spent · Costs & obligations · Forecast (EAC) · Variance) plus "N lines over budget".
- `SubNav` "Material sections": the project's MATERIALS lines in catalogue order. Badges:
  - `Over` (risk): `byLine.overrun`;
  - `N late` (warn): rows with `LATE_FOR_WORK` or `OVERDUE`.
- The table:
  - footer: Section total planned/committed/actual;
  - below it, `SectionBudget`: Forecast (EAC) · **Approved, editable** (`useEditBudgetLine`) · Variance.
- `BudgetHealthPanel` for the line: below the table, a sticky right column from `2xl`.

**Columns:**

| Column | Accessible name / behaviour |
|---|---|
| Code | the delete button sits next to the code |
| Item | `Edit name <code>` |
| Qty | `Edit quantity <code>` |
| Unit price | `Edit unit price <code>` |
| Planned amount | `data-testid="planned-<itemId>"` |
| Committed | `Edit committed <code>` |
| Actual | `Edit actual <code>`, or locked |
| Status | |
| Supplier | `OrgCell` role SUPPLIER: `Change supplier <code>` |
| Installer | `OrgCell` role CONTRACTOR: `Change installer <code>` |
| Delivery | **`Edit <code> delivery date`** (for 05's e2e) |
| Needed by | read-only link to `/projects/:id/construction/<work section>?highlight=<workId>` |
| **Schedule** | rightmost; `ScheduleFlagCell` from 02 |

**Testids for e2e:** `section-planned`, `section-variance`.

**Neighbours linking here:**
- `/projects/:id/materials/<section>?highlight=<itemId>` scrolls to the row and flashes it (02's EditableTable).
- `/projects/:id/materials?org=<id>` (no section) redirects to the remembered or first section **and keeps the query string**.

**Rules:**
- **Locked actual:** a row with at least one `DELIVERED` delivery in `snapshot.deliveries` shows Actual read-only with a lock and "Managed by delivery tracking" (block 10).
- **Delete:** an inline "Delete? Yes / No" (`role="dialog"`, name `Delete <code>?`).
  - It is **disabled** for rows with DELIVERED deliveries, with the tooltip "Has recorded deliveries" (owner's decision, 2026-10-14).
  - The server cascades deliveries, so this is a UI rule only. The API does not enforce it.
- **New row:** `MAT-<codePrefix>-NNN` = max NNN over **all** project items with that prefix, plus 1. Gaps are never reused: the code is the CSV import key.
  - One create at a time (a double click creates one row).
  - On `409` the code is recomputed once.
  - Defaults: name "New material", unit `pcs`, qty 0, price 0.

**Reusable helpers** in `features/materials/use-materials.ts` (import only if you really need them; they are not a frozen contract):
- `scheduleOf(items, today)`: the engine `checkSchedule`, memoised per items array.
- `useItemSchedule(projectId, itemId)`: one row's `ScheduleResult`; the cell does not re-render when the result is unchanged.
- `useHasDeliveredDeliveries(projectId, itemId)` → boolean.
- `useLateCountsByLine(projectId)`.
- `MATERIAL_CATALOG`, `codePrefixOf(section)`.

## How to check
- `bash $BIN/check.sh 04` → CHECK: PASS.
- `bash $BIN/ac-ledger.sh --root $WT --block 04`.
- Unit only: `cd $WT/apps/web && npx vitest run src/features/materials`.
- e2e (integrator, main tree): `bash howItWorks/bin/e2e.sh --grep AC-04.8`. `apps/web-e2e/src/materials.spec.ts`:
  1. duplicates `taucha-stadtvilla`;
  2. edits the NYM-J quantity `MAT-ELE-001` to 900 and checks that the section total and the Forecast KPI changed;
  3. reloads and checks the quantity is still 900 m;
  4. opens the supplier modal and checks the `tel:` link;
  5. closes it with Esc.
  **Not run by this block**, because blocks never serve or run e2e.

## Red-proof
Method: one targeted mutation of block 04's code per AC, then `vitest -t "[AC-04.N]"` → red; the file is restored after each (`diff -r` empty). Run at 11:47 on `7eca527`.

| AC | Mutation | Result |
|---|---|---|
| AC-04.1 | planned cell shows unit price instead of `itemPlannedCents` | 2 failed |
| AC-04.2 | a second save of the same edit 500 ms later | 1 failed (2 PATCHes) |
| AC-04.3 | schedule cell ignores `useItemSchedule` | 2 failed |
| AC-04.4 | supplier column bound to `contractorId` | 1 failed |
| AC-04.5 | price cell commits a value regardless of input | 2 failed |
| AC-04.6 | `columns={[...MATERIAL_COLUMNS]}` (new identity per render) | 2 failed |
| AC-04.7 | late set without `OVERDUE` | 1 failed |
| AC-04.9 | `max += 1` (count instead of max) | 5 failed |
| AC-04.10 | redirect drops `location.search` | 1 failed |
| AC-04.11 | delete without the confirmation | 1 failed |
| AC-04.12 | locked branch never taken | 1 failed |
| AC-04.13 | approved commit does nothing | 1 failed |
| AC-04.8 | e2e: not run in the block (integrator) | — |

## Gaps, CRs, deviations from CONTRACTS
- **No CRs.** Only block 04's files changed.
- **Judge constraint 1, deviation.** No CR to 02 for a per-item `useSchedule`: 02 had already finished when 04 started.
  - Block 04 uses the allowed fallback: `scheduleOf` calls engine `checkSchedule` once per cache version, keyed on the items array, with a per-row select. It is the same algorithm as 05's and 02's `useSchedule`, and the cache holds no copy of it.
- **Delete is not EditableTable's `onDelete`.** 02's built-in delete applies to every row, and the Schedule column must be the rightmost. So block 04 renders its own inline delete inside the Code cell. It has the same Yes/No pattern and is disabled for delivered rows.
- **Retry on code conflict:** only on HTTP 409. 01's API maps the unique `(projectId, code)` violation to a ConflictException. The first failure still shows 02's "Could not add the row" toast before the retry.
- **`test-utils.tsx`** lives in the feature folder and is type-checked with the **app** tsconfig. So it must not import `testing/render.tsx` (vitest globals); it has local `fakeResponse` / QueryClient instead.
- **Mobile:** 02's EditableTable cards. Card fields are every column except Needed by; "Edit row" opens the Sheet. No custom card component.
- **Follow-up `dd715f6`** (after the merge): `eslint-disable-next-line jsx-a11y/aria-role` on the two `OrgCell role=` props (an OrgRole filter, not ARIA; reported by 11). check.sh 04 PASS. `merge-block.sh` says "already merged", so the integrator has been asked to merge it.
- **e2e run 12:02 (`22f27c5`):** AC-04.8 failed at `GET /api/projects` (not ok), before the tab is opened. 9 blocks failed in the same run, so the cause is likely infrastructure (API/proxy/seed). Reported to 00.
- **Not verified visually or by e2e in this block.** That is the integrator's step, with the seed data from 03.
