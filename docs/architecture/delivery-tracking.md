<!-- paths: apps/api/src/deliveries/**, apps/web/src/features/delivery-tracking/**, apps/web-e2e/src/delivery-tracking.spec.ts, apps/web-e2e/fixtures/deliveries-*.csv | Delivery tracking: CSV import of deliveries (partial, idempotent), delivery log, KPIs -->
# Delivery tracking (as-built, block 10)

## What it does
`/deliveries?project=<id>` (defaults to the first project): a project selector, a CSV drop zone / file picker with "Download template", a client-side preview of the first 20 rows with problems marked (`aria-invalid`), a server import that shows a result card (`data-testid="import-result"`), an `Import errors` table and links to the changed items (`/projects/:id/materials/<section>?highlight=<itemId>`), and a `Delivery log` with filters (Kind / Status / Search) and KPIs.

The client parses the CSV (papaparse) and sends JSON; the server re-validates everything and applies the valid rows in one transaction (CONTRACTS §5).

## API — `apps/api/src/deliveries/`
- Controller `deliveries.controller.ts:7` (`projects/:projectId/deliveries`): `GET /` (`:11`) → `Delivery[]` sorted `date` desc, `createdAt` desc (`DeliveriesService.list`, `deliveries.service.ts:41`); `POST /import` (`:16`) → `ImportResult`.
- Module imports `ProjectsModule` for `ProjectScopeService.assertProject` (404) (`deliveries.module.ts:7`).
- `DeliveriesService.import` (`deliveries.service.ts:54`):
  1. `headerError(rows)` (`delivery-rows.validator.ts:57`) → 400 before any Prisma call when rows are empty or a header is missing (header set from `rows[0]` keys, trimmed, BOM stripped).
  2. One `findMany` for the referenced codes, then `validateDeliveryRows` (`delivery-rows.validator.ts:105`, pure) → `{valid, errors}`.
  3. `$transaction(apply, IMPORT_TX_OPTIONS)` (`deliveries.service.ts:19`, `{timeout: 20000, maxWait: 5000}`): `importBatch.create` first (`:146`), `delivery.upsert` by (`costItemId`, `deliveryNoteNo`) setting `batchId` (`:165`), then effects recomputed from the stored deliveries and `costItem.update` per item (`:206`).
- DTO `dto/import-deliveries.dto.ts`: `MAX_IMPORT_ROWS = 500` (`:11`), `@ArrayMaxSize` (`:24`).

## Row rules (validator)
- Every field trimmed; `kind` case-insensitive; codes keep their case; text ≤ 64 chars (`delivery-rows.validator.ts:37`).
- Strict regexes before conversion: qty `^\d+(\.\d{1,3})?$` and > 0; amount `^\d+(\.\d{1,2})?$`; real calendar date. Converted with the engine's `parseQtyToMilli` / `parseEurToCents`, never via float; each ≤ `MAX_INT_FIELD` (`:94`).
- `invoiceAmountEur` may be empty only for EXPECTED. Unknown or non-MATERIAL code → row error. A non-string value → "must be text" (`:121`).
- Formula injection: a code / note no. starting with `= + - @`, tab or CR is a row error (`FORMULA_START`, `:42`).
- A second (code, note no.) in one file → "duplicate deliveryNoteNo" (`:200`).
- Errors are `{row (1-based over non-blank data rows), field, message}`; `okRows + failedRows = totalRows`.

## Effects and invariants
- EXPECTED → `deliveryDate` = max EXPECTED date **in this file** for the item (`deliveries.service.ts:193`).
- An item that has or had DELIVERED deliveries → `deliveredDate` = max(DELIVERED date) or `null` (`:198`), `actualCents` = Σ `invoiceCents` of DELIVERED (`:201`), recomputed, never incremented. Items with no DELIVERED delivery keep their manual actual.
- A row that would push an item's Σ over 2e9 → row error "invoice total for the item exceeds the limit" (`:131-137`), no 500.
- Idempotent: re-importing a file changes no Delivery or item value; it only adds another `ImportBatch` (audit trail).
- Any throw inside the transaction commits nothing.

## Web — `apps/web/src/features/delivery-tracking/`
- `delivery-tracking-page.tsx:43` `DeliveryTrackingPage`; the heading always renders, even while projects load (keeps 02's route test green).
- `import-panel.tsx:46` `ImportPanel`: reads the file with `FileReader` (`:24-27`; `Blob.text()` is missing in jsdom).
- `parse-deliveries-csv.ts:23` `parseDeliveriesCsv`: `skipEmptyLines:'greedy'`, exactly 6 keys per row (missing → `""`), extra columns dropped; blocks > 500 rows (`:8`) or > 95 kB JSON (`MAX_IMPORT_BYTES`, `:10`) with "split the file".
- `validate-delivery-row.ts:12` mirrors the server rules for the preview. The preview **does not block** sending invalid rows (partial import; the server is the source of truth); only a header error, an empty file or > 500 rows disable the button.
- `use-deliveries.ts`: `useDeliveries` (`:15`, `['deliveries', projectId]`); `useImportDeliveries` (`:30`) runs `autosaveQueue.flush()` before the POST, maps 413 to "split it into smaller files", and on success invalidates `['project', id]`, `['deliveries', id]`, `['projects']`, `['analytics']`.
- `delivery-log.ts`: `planStatus` (`:22`) → `ON_TIME` | `LATE{days}` | `RECEIVED` | `OVERDUE` | `EXPECTED`; `deliveryKpis` (`:45`) → `{deliveredThisMonth, onTimeBps|null, openExpected, overdueItems}`; overdue = MATERIAL items the engine marks `OVERDUE` (`:67`), the same number as Materials/Construction.
- `delivery-template.ts:4` `DELIVERY_TEMPLATE_CSV`; `delivery-log-table.tsx:51` `DeliveryLogTable`.

## Tests
| AC | Where |
|---|---|
| 10.1–10.5 + extra cases | `apps/api/src/deliveries/deliveries.service.spec.ts` (in-memory staged `testing/fake-prisma.ts`), `delivery-rows.validator.spec.ts`, `dto/import-deliveries.dto.spec.ts` |
| 10.6 | `delivery-tracking-page.spec.tsx` (bad date marked before send; snapshot invalidated after import); `delivery-csv.spec.ts` (parser, preview, log/KPIs) |
| 10.7 (e2e) | `apps/web-e2e/src/delivery-tracking.spec.ts` on a duplicate: `deliveries-invalid.csv` → 2 ok / 6 errors; `deliveries-valid.csv` → `MAT-WIN-002` shows `Delivered` in Materials; re-import keeps the count |

## Decisions / deviations
- No CR. Server row cap 500, stricter than the zod `deliveryImportInputSchema` (5000), because of Express's default 100 kB JSON body limit (`main.ts`, not owned by 10).
- EXPECTED date = max of this file, not max of all stored EXPECTED rows: a newer supplier confirmation may move the date earlier (deviation from the judge, follows CONTRACTS §5 literally).
- DELIVERED invoices replace a manually entered actual on that item; "% on time" is measured against the item's current planned `deliveryDate`.

## Known gaps
- No manual edit/delete of deliveries, no log export, no server-side CSV parsing or multipart upload.
- Up to 500 sequential upserts hold SQLite's write lock (mitigated by the timeout and the row cap).
- The validator is duplicated on client and server (a shared validator in `libs/shared/types` would need a CR).
