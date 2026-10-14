# HANDOFF — 10-delivery-tracking

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
Implemented. `check.sh 10` → PASS. Branch `feat/10-delivery-tracking` (merge through `merge-block.sh 10`).

## Ready for neighbours (exports / components / endpoints, with examples)

### API (`apps/api/src/deliveries/`)

**`GET /api/projects/:id/deliveries`**
- Returns contract `Delivery[]` (`deliverySchema` from `@default-project/types`), sorted by `date` desc, then `createdAt` desc.
- Unknown project → 404.

**`POST /api/projects/:id/deliveries/import`**
- Body: `{ fileName, rows: DeliveryImportRow[] }`, at most 500 rows. Returns `ImportResult`.
- Example:
  ```json
  {"fileName":"ls.csv","rows":[{"itemCode":"MAT-WIN-002","deliveryNoteNo":"LS-1","kind":"DELIVERED","date":"2026-10-14","quantity":"1","invoiceAmountEur":"2950.00"}]}
  ```
  returns `{"batchId":"…","totalRows":1,"okRows":1,"failedRows":0,"errors":[],"updatedItemIds":["<itemId>"]}`.
- 400 before any write when the rows are empty, a required header is missing, or the DTO is invalid (more than 500 rows, no `fileName`).

**Row rules**
- Every field is trimmed. `kind` is case-insensitive: `EXPECTED` | `DELIVERED`.
- `date` must be a real `YYYY-MM-DD` date.
- `quantity` must be > 0, with a dot and ≤ 3 decimals.
- `invoiceAmountEur` uses a dot and ≤ 2 decimals. It is required for DELIVERED.
- The code must be a MATERIAL of the project.
- Note no. and code must be ≤ 64 characters and must not start with `= + - @`, a tab or CR.
- A second (code, note no.) pair in the same file is an error: "duplicate deliveryNoteNo".
- Errors are reported as `{row (1-based, data rows), field, message}`. Good rows are applied (partial import).

**Effects** (in one transaction, recomputed from the stored deliveries):
- EXPECTED rows → `deliveryDate` = the max EXPECTED date in the file for that item.
- An item that has, or had, DELIVERED deliveries → `deliveredDate` = max(DELIVERED date) or `null`, and `actualCents` = Σ invoiceCents.
- Items that never had a DELIVERED delivery keep their manual actual.
- A row that would push an item's Σ over 2e9 is a row error.
- Re-importing a file changes no Delivery or item values. It adds one more `ImportBatch` (the audit trail).

### Web (`apps/web/src/features/delivery-tracking/`)
- `useDeliveries(projectId)` → query `['deliveries', projectId]` (Delivery[]).
- `useImportDeliveries(projectId)`: flushes the autosave queue first, then invalidates `['project', id]`, `['deliveries', id]`, `['projects']` and `['analytics']`.
- `planStatus(delivery, item, today)` → `ON_TIME` | `LATE{days}` | `RECEIVED` | `OVERDUE` | `EXPECTED`.
- `deliveryKpis(deliveries, itemsById, schedule, today)` → `{deliveredThisMonth, onTimeBps|null, openExpected, overdueItems}`. 11 may reuse it.
- `parseDeliveriesCsv(text)`, `validateDeliveryRow(row, knownCodes?)`, `DELIVERY_TEMPLATE_CSV`.
- The page: `DeliveryTrackingPage` on `/deliveries?project=<id>` (defaults to the first project).
- Accessible hooks for e2e:
  - file input label `CSV file`;
  - tables `Preview`, `Import errors`, `Delivery log`;
  - `data-testid="import-result"`;
  - filters `Kind` / `Status` / `Search deliveries`.

## How to check
- `bash howItWorks/bin/check.sh 10` → `CHECK: PASS`.
- API: 3 suites under `apps/api/src/deliveries` (validator, service with an in-memory staged FakePrisma, DTO through the real `ValidationPipe`). AC-10.1 … AC-10.5.
- Web: `delivery-csv.spec.ts` (parser, preview validation, log/KPIs) and `delivery-tracking-page.spec.tsx` (AC-10.6).
- Red-proof by mutation:
  - Removing the effects or the header check fails 9 of the 13 service tests.
  - Removing the invalidation or `aria-invalid` fails both AC-10.6 tests.
- E2E (integrator, main tree): `bash howItWorks/bin/e2e.sh --grep "AC-10.7"`. `apps/web-e2e/src/delivery-tracking.spec.ts` duplicates `taucha-stadtvilla` and uploads 03's fixtures:
  - invalid → 2 ok / 6 errors;
  - valid → the front door `MAT-WIN-002` shows `Delivered` in Materials;
  - a second import keeps the delivery count.
- A live probe against the seeded SQLite DB (port 3510) gave these numbers (see DESIGN "As built").

## Gaps, CRs, deviations from CONTRACTS
- No CR.
- The row cap is 500, where the types' `deliveryImportInputSchema` allows 5000. Express's default 100 kb JSON body limit (`main.ts`, not owned by 10) makes larger files fail with 413. The client refuses such files earlier, with "split the file".
- Assumptions for SOLUTION.md:
  - the import is partial;
  - DELIVERED invoices replace a manually entered actual on that item;
  - "% on time" is measured against the item's current planned `deliveryDate`;
  - the EXPECTED date is the latest in the imported file (a newer confirmation may move it earlier).
- E2E history: the first main-tree run of AC-10.7 failed (`docs/test-runs/2026-10-14-121103-e2e.md`). The spec had a race: after the result link was clicked, the URL changed before the Delivery page left the DOM, so the row was looked up too early. The owner's orchestrator session fixed this in `b8714b5`: it waits for the `Windows, doors & stairs` region and looks for the row only inside it. Merged as `e3f68c0`; the rerun passed (`docs/test-runs/2026-10-14-121147-e2e.md`).
