# 03 — Seed: German demo data (Taucha), more projects, template

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `03`). Start: `bash $BIN/bootstrap.sh 03` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 03` → `bash $BIN/merge-block.sh 03`.

**Wave:** W1 · **Priority:** MUST · **Estimate:** 45–60 min · **Worktree:** `Kairon-wt/03-seed-germany` (gate and base: `bin/blocks.conf`)
**In parallel:** 04 materials, 05 construction, 06 profitability. They build the UI on test fixtures and **wait for your merge** to see real data. **Finish fast**: once your `03.merged` flag appears, they run `git merge main`. You start from `feat/01` at `01.schema-ready`, and you merge into main after `w0-frozen` (bin/blocks.conf).
**Later:** 07 land, 08 architecture, 09 marketing, 10 deliveries and 11 analytics display the data you seed, and 12 clones your template. So fill in **every** model now, including land, plan, rooms, BOQ and deliveries.

## Goal
An idempotent `npx prisma db seed` that creates the realistic project "Stadtvilla Taucha — Family of 4" plus 2 projects for analytics plus a template. The data guarantees the demo moments: **overruns** and **schedule conflicts**.

## You own
`apps/api/prisma/seed.ts` (the dispatcher from 01: replace its body), `apps/api/prisma/seed/**`, **`apps/api/src/seed-data/**`** (pure `build*()` functions + their Jest specs: api's Jest only collects `src/**`), `apps/web-e2e/fixtures/deliveries-*.csv`.

## Data source
`shared/GERMANY-DATA.md` (all figures, organisations, dates, rooms). Line catalogue: CONTRACTS §4 (`BUDGET_CATALOG` from `@default-project/types`).

## Steps
1. `seed/organizations.ts`: the 14 organisations from GERMANY-DATA §8 (upsert by `slug`).
2. `seed/projects/taucha.ts` (slug `taucha-stadtvilla`, code `TA-2026-01`, ACTIVE, client "Familie Neumann" (fictional), 2026-04-01 → 2027-03-31, markup 1500):
   - Budget lines with approved amounts from the **exact per-line table in GERMANY-DATA §9** (Σ = 573,861.00 €).
   - Rows: **≥ 6 MATERIAL rows per material section** (codes per CONTRACTS §4 "Row code prefixes", e.g. `MAT-WIN-001`; realistic names such as "Ready-mix concrete C25/30", "NYM-J 3×1.5 mm² cable", "Vaillant aroTHERM plus 7 kW", unit, quantity, price from §3). Supplier and installer (`contractorId` = the installation contractor).
   - **≥ 3 WORK rows per construction section** (`WRK-<PREFIX>-NNN`, hours or m² × rate). Contractor, start/end from the **seed schedule table in GERMANY-DATA §7**; material delivery dates come from the same table.
   - SERVICE rows for land, architecture and marketing (HOAI work stages LPH 1–9 as separate rows, taxes, notary, connections, marketing channels with periods and the agency).
   - Link materials to works through `requiredForWorkId` (windows → window installation, heat pump → heating installation, cable → electrical installation, and so on).
   - Statuses and money per the demo plan (§7): earthworks/slab/shell DONE (actual = committed), roof CONTRACTED with partial actual, windows CONTRACTED, electrical PARTIAL, the rest PLANNED. Land and soft costs paid.
   - **Mandatory demo moments:** concrete is over budget (2026 price 192.50 €/m³ against a budget at 154), electrical is over budget, earthworks has an addendum of +3,800; **windows LATE_FOR_WORK by 9 days**, **heat pump LATE_FOR_WORK by 18 days**, plaster AT_RISK; at least one material is DELIVERED.
3. `seed/projects/taucha-land.ts` and `taucha-plan.ts`:
   - LandParcel + 7 UtilityConnection (GERMANY-DATA §1).
   - ArchitecturePlan + 13 Rooms (§2, the house offset on the plot).
   - BoqComponent: ≥ 3 per HouseSection with `materialSection`, linked to the matching MATERIAL rows (`boqComponentId`), with **the same qty**.
4. `seed/projects/taucha-deliveries.ts`: 5–8 Delivery rows (DELIVERED for concrete, rebar and roof tiles, with invoices; EXPECTED for windows and the heat pump). Keep them consistent with `deliveredDate`/`actualCents` (the actual total = the sum of DELIVERED invoices for those rows).
5. `seed/projects/markranstaedt.ts` (COMPLETED 2025, bungalow ~110 m², everything DONE, a small overrun) and `markkleeberg.ts` (PLANNING, land 412 €/m², everything PLANNED). These can be a reduced row set (~40 rows each) built with a helper that scales the Taucha set by area.
6. `seed/projects/template.ts`: `template-efh-144`, `isTemplate: true`, the same as Taucha (**dates included**, the wizard shifts them) but all PLANNED, committed/actual = 0, no `deliveredDate` and no deliveries.
7. `apps/web-e2e/fixtures/deliveries-valid.csv` (6 rows: existing codes from Taucha) and `deliveries-invalid.csv` (a mix: an unknown code, a bad date, a negative quantity, an amount like `12,5`, a duplicate (`itemCode`,`deliveryNoteNo`) within the file, a DELIVERED row without an invoice, plus 2 valid rows). Block 10 uses them.
8. Idempotency: everything is `upsert` by slug/code/unique keys. Running it twice gives the same row counts. **No** `deleteMany` on the whole database.

## Acceptance criteria
- AC-03.1 (Jest, a pure function) `buildTauchaSeed()` returns data where Σ approved = 573,861.00 € (GERMANY-DATA §9) — check it with the engine `summarizeProject`.
- AC-03.2 (Jest) On the seed data the engine gives: `overrunLines` contains `concrete`, `electrical`, `earthworks`; `checkSchedule` gives LATE_FOR_WORK for windows (9 days) and the heat pump (18 days) with today=`2026-10-14`.
- AC-03.3 (Jest) Every material row in the MATERIALS sections has supplier and contractor; every WORK row has contractor, start ≤ end.
- AC-03.4 (Jest) Every `boqComponentId` link has equal qty; `materialSection` exists in the catalogue.
- AC-03.5 (manual / integrator) `npx prisma db seed` twice in a row → identical `SELECT COUNT(*)` for every table.
- AC-03.6 Every code is unique within a project; every organisation email ends in `.example`.
- AC-03.7 (unit) The demo cable `MAT-ELE-001` is PARTIAL with committed = actual = 760.00 € (1,000 m paid), so `itemForecastCents` gives 988.00 € for 1,300 m and falls when the qty is lowered to 900 m (SUMMARY §3 step 3); the project forecast stays 540,455.65 €.

## Verify
In the worktree: `cd apps/api && npx prisma migrate deploy && npx prisma db seed && npx prisma db seed` (exit 0, counts unchanged), `npx nx test api`.

## Pitfalls
- Build the data as **pure functions** (`build*()` → plain objects) and keep Prisma calls separate. That way AC-03.1–4 are tested without a database.
- Money only in cents (`eur(1234.56)` → a helper that works through a string, e.g. `parseEurToCents('1234.56')` from the engine). Quantities through `parseQtyToMilli`.
