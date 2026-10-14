# DESIGN — 10 delivery tracking (CSV import of delivered products)

Date: 2026-10-14 · Status: **implemented** (approach A with constraints; as-built notes are marked "As built") · Risk: **medium**. The import changes the money and date fields that 04, 05, 06 and 11 read.

## Goal / Non-goals
**Goal.** A `/deliveries` page with:
- a project selector;
- a CSV upload (drag and drop or file picker) and a "Download template" button;
- a client-side preview of the first 20 rows with problems highlighted;
- a server import (partial and idempotent) that shows a result card, an error table and the changed items;
- a delivery log with filters, and KPIs.

API endpoints:
- `GET /projects/:id/deliveries`
- `POST /projects/:id/deliveries/import`

**Non-goals:**
- Server-side CSV parsing or multipart upload.
- Editing or deleting deliveries by hand.
- Exporting the log to CSV.
- Raising the body limit in `main.ts` (owned by 01).
- A shared zod validator in `libs/shared/types` (frozen; possible later refactor B).

## Chosen approach and why not the others
**A: validation on both sides, contract shapes unchanged.** The client parses the file and validates it for the preview. The server re-validates everything with a pure function, then applies the result in one interactive transaction: upsert, then recompute the effects from the DB.

Rejected:
- **B (shared validator through a CR).** It ties a W2 stretch block to the integrator. The only thing duplicated is a few regexes.
- **C (multipart upload, parsing on the server).** It contradicts CONTRACTS §5, needs multer (a CR), and AC-10.6 needs client-side parsing anyway.

## Judge constraints (mandatory)
1. **Headers.**
   - Client: `meta.fields`, trimmed and BOM-stripped, must contain all 6 names (`itemCode,deliveryNoteNo,kind,date,quantity,invoiceAmountEur`). Extra columns are dropped. A missing one blocks the file.
   - Server: the header set comes from the `rows[0]` keys (trimmed, leading `﻿` removed). An empty `rows` or a missing key → `BadRequestException('Wrong headers…' / 'File has no data rows')`.
   - Both checks run in the service before any Prisma call. DTO: `@IsArray @ArrayMaxSize(500)`.
2. **Ragged rows.**
   - The client uses `skipEmptyLines:'greedy'` and sends exactly the 6 keys, filling missing ones with `""`.
   - On the server, a non-string value in a later row → the row error "must be text".
   - Row = index in `rows` + 1 (non-blank data rows). The preview uses the same numbering.
3. **Normalisation.**
   - Every field is trimmed.
   - `kind` is case-insensitive.
   - `itemCode` and `deliveryNoteNo` keep their case.
   - Length ≤ 64.
   - Duplicate detection and the upsert key use the trimmed values.
4. **Parsing.** A strict regex comes first:
   - qty `^\d+(\.\d{1,3})?$` and > 0;
   - amount `^\d+(\.\d{1,2})?$`;
   - date `^\d{4}-\d{2}-\d{2}$` plus a real calendar check.

   Values are then converted with the engine's `parseQtyToMilli` / `parseEurToCents`, never via float. Each value is ≤ 2,000,000,000.
5. **Several EXPECTED rows.** As built (deviation from the judge's "max of all stored EXPECTED"): for an item touched by EXPECTED rows, `deliveryDate` = the max date among the valid EXPECTED rows **of this file**. This follows CONTRACTS §5 ("EXPECTED → item.deliveryDate = date"): a supplier's new confirmation can move the date earlier, which "max of everything stored" would never allow. It still does not depend on row order, and re-importing the same file is idempotent.
6. **Kind switch.** Before the upserts, read the existing deliveries of the touched items. For every item that has a DELIVERED delivery before or after the import:
   - `deliveredDate` = max(DELIVERED date), or `null`;
   - `actualCents` = Σ invoiceCents of DELIVERED, or 0.

   Items that never had a DELIVERED delivery keep their manual `actualCents`.
7. **Overflow.** Each item's projected Σ is computed before writing. A row that pushes it over 2e9 becomes a row error "invoice total exceeds limit" and is left out. No 500.
8. **Transaction.** `$transaction(fn, {timeout: 20000, maxWait: 5000})`. Steps inside it:
   1. Create the `ImportBatch` first.
   2. Upsert by (`costItemId`,`deliveryNoteNo`). Both create and update set `batchId`.
   3. Recompute the effects and update the items.

   Other rules:
   - Unknown project → 404.
   - Unknown code → row error. A non-MATERIAL code → row error.
   - Items are loaded with one `findMany`.
   - Re-importing creates a new `ImportBatch` (the audit trail). Deliveries and items stay unchanged.
9. **Body size.** The client blocks files with more than 500 rows, or more than 95 kb of JSON, with "split the file". A 413 is shown as the same message.
10. **Formula injection.** A `deliveryNoteNo`/`itemCode` starting with `= + - @`, a tab or CR is a row error. React escaping covers display. No `innerHTML`.
11. **Autosave race.**
    - Before the POST: `autosaveQueue.flush()`.
    - After success: invalidate `['project', id]`, `['deliveries', id]`, `['projects']` and `['analytics']` (helpers from `lib/query-keys.ts`).
12. **Overdue KPI.** The number of MATERIAL items with `useSchedule` status `OVERDUE` (matches Materials/05). The row-level "Overdue" label in the log is a separate thing.
13. **Reuse.** 01's stub filenames, `DeliveriesModule` and `PrismaService`. Types `DeliveryImportRow`, `ImportResult` and `Delivery` come from `@default-project/types`. `GET` → contract `Delivery[]` (date desc, createdAt desc).
14. **Tests.**
    - An in-memory FakePrisma with a staged `$transaction`: a failure inside it commits nothing.
    - All the extra cases listed below.
    - The e2e runs on a duplicated project.

## Affected files (block 10 only, `bin/blocks.conf` row 10)
- `apps/api/src/deliveries/`:
  - `deliveries.module.ts`, `deliveries.controller.ts`, `deliveries.service.ts`
  - `delivery-rows.validator.ts` (pure)
  - `dto/import-deliveries.dto.ts`
  - specs `deliveries.service.spec.ts`, `delivery-rows.validator.spec.ts`, `testing/fake-prisma.ts`
- `apps/web/src/features/delivery-tracking/`:
  - `delivery-tracking-page.tsx` (`DeliveryTrackingPage`)
  - `parse-deliveries-csv.ts`, `validate-delivery-row.ts`, `delivery-template.ts`
  - `use-deliveries.ts` (query + import mutation)
  - `delivery-log.ts` (pure: plan status, KPIs)
  - components: drop zone, preview, result, log, KPIs
  - specs
- `apps/web-e2e/src/delivery-tracking.spec.ts`

Read-only: fixtures `apps/web-e2e/fixtures/deliveries-*.csv` (03), the engine (01), the web lib/ui (02).

## Web: behaviour
- **Project:** from `['projects']` (02's hook or `apiGet`). The selection is stored in `?project=`, defaulting to the first project.
- **Plan status of a log row:**
  - DELIVERED → `On time` when the item has no `deliveryDate` or date ≤ item.deliveryDate, otherwise `Late · N d`.
  - EXPECTED → `Received` (the item has a `deliveredDate`), else `Overdue` (date < today), else `Expected`.
- **Filters:** kind, status, text (code/name/note no.).
- **KPIs:**
  - DELIVERED rows this month (`useToday()`);
  - % on time over DELIVERED rows of items with a `deliveryDate`;
  - open expected = EXPECTED rows whose item has no `deliveredDate`;
  - overdue = §12.
- **Changed items:** links `/projects/:id/materials/<linesById[item.budgetLineId].section>?highlight=<itemId>`.

## Risks
- The demo statuses of other blocks (windows/heat pump LATE_FOR_WORK) change if a DELIVERED/EXPECTED row hits those items. Mitigation: the e2e runs only on a duplicate.
- 03's seed must keep `actualCents = Σ DELIVERED invoices` for items that have deliveries. Otherwise the first import overwrites the actuals. This was flagged to 03 by a note.
- The SQLite write lock during an import of up to 500 rows. Mitigation: the timeout plus the 500-row cap.

## Test strategy (AC)

**Jest, `deliveries.service.spec.ts` with FakePrisma:**
- **AC-10.1** "should set actualCents to the sum of DELIVERED invoices when valid rows are imported": 100.00 + 50.50 → 15050, deliveredDate = max. Negative: an EXPECTED amount is not summed.
- **AC-10.2** "should keep deliveries and actualCents unchanged when the same rows are re-imported". Negative: ≠ 30100, count stays 2.
- **AC-10.3** "should report row-numbered errors and apply good rows when the file is mixed": unknown code, `2026-13-01`, `-1`, `12,5`, empty note no. → exact `{row, field}`. Good rows are stored, `okRows + failedRows = totalRows`.
- **AC-10.4** "should throw BadRequest without a transaction when rows are empty or headers are wrong": the `$transaction` spy has 0 calls and the store is unchanged.
- **AC-10.5** "should move deliveryDate when an EXPECTED row is imported". Negative: deliveredDate/actual are unchanged.

**Extra cases (validator/service):**
- 2026-02-30;
- qty 0 / `1.0000`;
- amount `10.555`;
- EXPECTED without an amount ok, DELIVERED without one is an error;
- a renamed header → 400;
- a BOM key;
- a non-string value;
- a non-MATERIAL code;
- a duplicate within the file;
- ` delivered `;
- formula injection;
- a kind switch DELIVERED→EXPECTED → `deliveredDate null`, actual 0;
- overflow;
- a throw in the middle of the transaction commits nothing;
- two EXPECTED rows → the max.

**Vitest:**
- **AC-10.6** "should mark a bad date in the preview before sending" (`aria-invalid` on the cell, the good row is not marked). Also "should invalidate the project snapshot after a successful import" (spy on `invalidateQueries` with `['project', id]`).
- Parser specs: `;`, BOM, ragged rows, extra columns, missing header.
- `delivery-log.ts`: statuses, KPIs.

**Playwright:**
- **AC-10.7** in `delivery-tracking.spec.ts`: duplicate in `beforeEach`. `deliveries-invalid.csv` → the error table. `deliveries-valid.csv` → in Materials the row's Schedule changes. Run by the integrator.

The decision behind AC-10.6: the preview **does not block** sending invalid rows. The import is partial and the server is the source of truth (CONTRACTS §5), so the bad rows come back in the error table. Only a header error, an empty file or more than 500 rows block the button.

## How to verify
- `bash howItWorks/bin/check.sh 10` → `CHECK: PASS`.
- `bash howItWorks/bin/heavy.sh $WT npx nx test api --testPathPattern=deliveries` and `… npx nx test web -- delivery-tracking`.
- After the merge, the integrator runs `bash howItWorks/bin/e2e.sh --grep delivery`.

## Open questions
None for the owner. The assumptions (partial import, overwriting actuals once DELIVERED rows exist, max of the EXPECTED dates, the definition of "% on time" against the current plan date) go into HANDOFF and then SOLUTION.md.

## As built (2026-10-14)
- API: `apps/api/src/deliveries/`
  - `delivery-rows.validator.ts`: `headerError`, `validateDeliveryRows` (pure).
  - `deliveries.service.ts`: `list`, `import`, with `IMPORT_TX_OPTIONS = {timeout: 20000, maxWait: 5000}`.
  - `dto/import-deliveries.dto.ts`: `MAX_IMPORT_ROWS = 500`.
  - Controller: `GET /` and `POST /import` under `projects/:projectId/deliveries`.
  - Module imports `ProjectsModule` for `ProjectScopeService.assertProject` (404).
- Web: `apps/web/src/features/delivery-tracking/`
  - `parse-deliveries-csv.ts`, `validate-delivery-row.ts`, `delivery-template.ts`, `delivery-log.ts`, `use-deliveries.ts`.
  - Components: `import-panel.tsx`, `delivery-log-table.tsx`, `delivery-tracking-page.tsx`.
  - The file is read with `FileReader`, because `Blob.text()` is missing in jsdom.
  - The page heading always renders, even while the projects load, so 02's AC-02.16 route test stays green.
- Deviations:
  - Constraint 5: see above.
  - The server row cap is 500, where the `deliveryImportInputSchema` zod in types allows 5000. 500 is stricter, because of the 100 kb body limit.
- Verified live against the seeded SQLite DB on port 3510:
  - invalid fixture → 2 ok / 6 errors on rows 1, 2, 3, 4, 6, 7;
  - valid fixture → 6 ok, MAT-WIN-002 deliveredDate 2026-10-14 / actual 295000;
  - a re-import keeps the count 15 → 15;
  - empty rows / wrong headers → 400, an unknown project → 404.
