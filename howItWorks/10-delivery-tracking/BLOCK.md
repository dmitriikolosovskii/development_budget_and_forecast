# 10 — "Delivery tracking": uploading data about supplied products

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `10`). Start: `bash $BIN/bootstrap.sh 10` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 10` → `bash $BIN/merge-block.sh 10`.

**Wave:** W2 · **Priority:** STRETCH · **Estimate:** 60–75 min · **Worktree:** `Kairon-wt/10-delivery-tracking` (gate and base: `bin/blocks.conf`)
**In parallel:** 07, 08, 09, 11. Your import changes the fields of MATERIAL rows (`deliveryDate`, `deliveredDate`, `actualCents`), so 04's "Schedule" column, 05's alerts and the Profitability actuals change after `invalidate(['project', id])`. **11 analytics** may show delivery KPIs (on time / late): publish a `GET /projects/:id/deliveries` response in HANDOFF early.

## Goal
A sidebar item `/deliveries`: choose a project, upload a CSV from a supplier or the site (expected and actual deliveries), see the validation result, and the delivery log.

## You own
`apps/api/src/deliveries/**`, `apps/web/src/features/delivery-tracking/**` (`DeliveryTrackingPage`), `apps/web-e2e/src/delivery-tracking.spec.ts`. Fixtures `apps/web-e2e/fixtures/deliveries-*.csv` come from 03 (read-only).

## Format and rules (CONTRACTS §5, Delivery import)
- CSV `itemCode,deliveryNoteNo,kind,date,quantity,invoiceAmountEur` (delimiter `,` or `;`, UTF-8 with or without BOM). papaparse runs on the client, **with no type coercion** (everything stays strings).
- A **"Download template"** button (generated CSV with a header and two sample rows).
- After parsing, a **preview** of the first 20 rows with client-side validation highlighted (bad date, number, empty field). The server then **re-validates everything** (the client is not trusted).
- Server: one `$transaction`. Good rows are upserted by (`costItemId`,`deliveryNoteNo`) and the item effects are recomputed (EXPECTED → deliveryDate; DELIVERED → deliveredDate = max, actualCents = Σ invoices). Bad rows go into `errors` with the row number (1-based, without the header) and the reason. `ImportBatch` is saved.
- Re-importing the same file changes nothing (idempotent).
- An empty file or wrong headers → 400 and nothing is written.

## Page content
1. A project selector (from `['projects']`), a drag-and-drop zone with a file picker, a preview, and an "Import" button.
2. The result: a ✓ N imported / ✗ M failed card, an error table (row, field, message), and a list of changed items (links to Materials).
3. A delivery log (`GET /projects/:id/deliveries`): date, note no., item, kind, qty, invoice, status relative to the plan (on time / late against the item's `deliveryDate`), with filters.
4. KPIs: deliveries this month, % on time, open expected deliveries, overdue deliveries (`checkSchedule` OVERDUE).

## Acceptance criteria
- AC-10.1 (Jest) Valid rows → upsert + effects; actualCents = Σ invoices of DELIVERED (two rows of 100.00 and 50.50 → 15050).
- AC-10.2 (Jest) Re-importing the same set → upsert, no new Delivery rows, actualCents unchanged.
- AC-10.3 (Jest) Bad rows: unknown itemCode, date `2026-13-01`, quantity `-1`, amount `12,5` (comma), empty `deliveryNoteNo` → errors with the right row numbers; good rows from the same file are applied (partial).
- AC-10.4 (Jest) No rows or wrong headers → 400, `$transaction` is not called.
- AC-10.5 (Jest) The `kind=EXPECTED` row moves the item's `deliveryDate`.
- AC-10.6 (Vitest) The preview highlights a bad date before sending; after a successful import `['project', id]` is invalidated.
- AC-10.7 (e2e, integrator) Upload `deliveries-invalid.csv` → see the error table; upload `deliveries-valid.csv` → in Materials the schedule status of the row changed.
