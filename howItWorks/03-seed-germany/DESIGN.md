# DESIGN — 03 seed-germany

Status: **IMPLEMENTED** (as-built section at the end). Approved by the judge (approach A, risk **medium**). Date 2026-10-14. Panel: prosecutor, advocate, architect, tester → judge.

## Goal
An idempotent `npx prisma db seed` that writes:
- 14 organisations;
- the demo project `taucha-stadtvilla`: 43 lines with Σ approved = 573,861.00 €, rows in every section, land + 7 utilities, plan + 14 rooms, BOQ, deliveries;
- `markranstaedt-bungalow` (COMPLETED) and `markkleeberg-villa` (PLANNING) for Analytics;
- `template-efh-144` (`isTemplate`) for the wizard;
- the delivery CSV fixtures for block 10.

The data guarantees the demo moments:
- overruns on exactly `concrete`, `electrical` and `earthworks`;
- windows LATE_FOR_WORK by 9 d and the heat pump by 18 d;
- gypsum plaster AT_RISK (slack 2).

## Non-goals
- API, UI, schema or engine changes; `deleteMany`, reset or pruning of user rows.
- Running e2e, which is the integrator's job.
- The CSV import logic (block 10) and the wizard's scaling (block 12).

## Chosen approach: A, declarative pure builders + a thin ordered-upsert writer
- **Data tables.** `apps/api/src/seed-data/` holds the row tables. Money and quantities are decimal strings, converted only through the engine's `parseEurToCents`/`parseQtyToMilli`. References use `code`/`slug`, never ids.
- **Builders.**
  - `buildTauchaSeed()` returns a `ProjectSeed`.
  - `deriveProject(base, opts)` produces Markranstädt, Markkleeberg and the template.
  - `toSnapshot(seed)` maps a seed onto the engine's `ProjectSnapshot` with synthetic ids (code/slug), using the engine factories where they fit. Jest then checks every invariant through `summarizeProject`/`checkSchedule` with no database.
- **Writer.** `runSeed(prisma)` in `src/seed-data/write-seed.ts` upserts in dependency order, one `$transaction` per project with `timeout: 60_000`. `prisma/seed.ts` and `prisma/seed/index.ts` only call it through a relative import.

**Why not the others:**
- **B (static JSON with precomputed cents):** the cents are hand-computed against an exact 573,861.00 € total, and the three other projects would be copy-paste datasets that drift.
- **C (seed through the API):** needs a running server, isn't idempotent by code, and can't set statuses or actuals.

## Judge constraints (mandatory)
1. Decimal strings + engine parsing only; references by code/slug.
2. **Taucha, exact sets** at today = 2026-10-14:
   - `overrunLines` sections are exactly {concrete, electrical, earthworks}, and Σ overrun < contingency (2,934,000 ¢);
   - LATE_FOR_WORK is exactly windows (9 d) and the heat pump (18 d); AT_RISK is exactly gypsum plaster (slack 2);
   - 0 OVERDUE and 0 UNSCHEDULED;
   - `WRK-WIN-001` and `WRK-HEA-001` are each BLOCKED by one material; every other WORK is READY;
   - the stair and interior doors link to the Feb-2027 windows-install rows.
3. **Template** keeps Taucha's dates (BLOCK 03 step 6; block 12 shifts them; GERMANY-DATA §9 "no dates" is superseded).
   - Its schedule is asserted at `today = startDate − 1 d`: 0 LATE, 0 OVERDUE.
   - It has all 43 lines, everything PLANNED with zero committed/actual, no `deliveredDate`, no deliveries, and the same link count as Taucha.
4. **PLANNED derivations** (template, Markkleeberg):
   - re-date every linked material with slack < 3 to `needBy − 5 d`;
   - drop change-order rows (the earthworks addendum);
   - set approved = max(scaled approved, planned) per line, so there are 0 overruns;
   - clear `deliveredDate`, committed and actual.
5. **Markranstädt** (DONE mode):
   - approved per line = scaled planned, and the contingency approved = 0 (released into the trades at contract award, documented);
   - actual = planned + 4–8 % on 4 lines;
   - test: 100 % < forecast / approved < 103 %.
6. **Scaling:**
   - only continuous units (m3, m2, m, t, kg, h) are scaled; pcs/set/lump stay whole, so there is still one heat pump;
   - the BOQ uses the same function, so BOQ qty = material qty holds;
   - rooms scale by **edges** (`round(x·s)`, `round((x+w)·s)`), so there are no 1 cm overlaps;
   - every plan has an in-bounds/no-overlap test.
7. **Layout:**
   - the writer lives in `src/seed-data` (typechecked by `tsconfig.app.json`) and specs only under `src/**`; `prisma/seed*` is a thin relative-import caller;
   - `$transaction` timeout 60 s; no `deleteMany`/`createMany`;
   - a fake-Prisma test proves the writer only upserts.
8. **Bigint under ts-jest:** `target es2015` gives TS2737 on `1000n` (the judge probed it). This is block 01's file, so 03 notified 01 (`note.sh 01`) and adds no workaround in 03's files.
9. **Deliveries:**
   - for every item with DELIVERED notes, `actualCents` = Σ invoices and `deliveredDate` = the latest date;
   - for DONE delivered items, invoices sum to committed;
   - EXPECTED note date = the item's `deliveryDate`.
10. **CSV fixtures:**
    - `deliveries-valid.csv`: no clash with seeded note numbers, no items with seeded actuals; avoids windows, the heat pump and plaster; flips the front door to DELIVERED; creates no new LATE, OVERDUE or overrun.
    - `deliveries-invalid.csv`: `"12,5"` is quoted.
    - A Jest spec checks both files against the Taucha seed.
11. **Scope notes:**
    - AC-03.5 is checked on a clean scratch DB (seed twice → identical counts). Re-seeding restores seeded rows to their seed values but does **not** prune rows that users or imports added.
    - Rooms: 14, the GERMANY-DATA §2 table (Σ 143.65 m²); BLOCK.md's "13" is a typo.
12. Seed runner: adopt 01's `migrations.seed` command as-is.

## Data decisions
- **Lines:** exactly GERMANY-DATA §9.
  - LAND, ARCHITECTURE and MARKETING rows sum **exactly** to their line.
  - MATERIALS/CONSTRUCTION rows use realistic qty × price (§3, hourly rates §3). Σ planned is 87–99 % of approved, except the overrun lines.
  - `sales-commission` has one 0 € row; `contingency` has no rows.
- **Overruns:**
  - concrete: 50.5 m³ at the 2026 price of 192.50 €/m³ (budget assumed 154) → ≈ +1.7k;
  - electrical materials: +7.2 % index and 92 sockets instead of 70 → ≈ +1.0k;
  - earthworks: the other rows sum to exactly 21,100 €, plus change order `WRK-EAR-006` (+3,800, DONE) → exactly +3,800.
- **Statuses (§7):**
  - earthworks, shell and roof carpentry DONE; roofing CONTRACTED with partial actual; windows, plumbing and heating CONTRACTED; electrical first fix PARTIAL; site setup PARTIAL; the rest PLANNED;
  - land and soft costs paid. Exceptions: utility house connections are CONTRACTED (built when the house exists), HOAI LPH 8 and KfW supervision are PARTIAL, LPH 9 and the blower-door test are PLANNED;
  - marketing per its periods.
- **Organisations on rows:** suppliers have role SUPPLIER and installers role CONTRACTOR. Windows, door, stair and interior doors are fitted by `muehlberg-dach`.
- **Deliveries (Taucha, 7):**
  - DELIVERED: slab concrete (2 notes), frost-apron concrete, rebar, roof tiles;
  - EXPECTED: windows (2026-10-28) and heat pump (2026-11-20).
- **Derived projects:** the full row set, scaled.
  - Markranstädt: factor 110/144, dates −547 d (2024-10-01 → 2025-09-30), land 600 m² × 112 €/m², its own one-storey bungalow plan (9 rooms, floor 0), markup 12 %.
  - Markkleeberg: factor 160/144, dates +365 d (2027-04-01 → 2028-03-31), land 480 m² × 412 €/m², the Taucha plan edge-scaled by √factor.
  - In both, land rows are recomputed from the plot (5.5 % transfer tax, 1.5 % notary, 0.5 % registry) and the design (HOAI) rows scale by price.

## Affected files (all owned by 03, `bin/blocks.conf`)
- `apps/api/src/seed-data/`:
  - `types.ts`, `money.ts`, `row-builder.ts`, `organizations.ts`;
  - `taucha.ts` (project, lines), `taucha-items.ts` (rows), `taucha-land-plan.ts`, `taucha-deliveries.ts`;
  - `derive.ts`, `projects.ts` (all four), `to-snapshot.ts`, `write-seed.ts`;
  - specs `*.spec.ts`.
- `apps/api/prisma/seed.ts` (body: call `./seed`) and `apps/api/prisma/seed/index.ts` (PrismaClient → `runSeed` → disconnect).
- `apps/web-e2e/fixtures/deliveries-valid.csv`, `deliveries-invalid.csv`.

## Risks
- **Dependency on 01:** the seed runner, path aliases and the spec target for bigint. 01 has been notified. Fallback: a CR.
- **Data drift** breaking an exact set: guarded by the specs.
- **Block 10 import:** importing DELIVERED notes for DONE items that have no seeded Delivery rows replaces their actual (actual = Σ invoices). This is a documented gap; the fixtures avoid those items.
- **Re-seed after e2e imports:** CSV Delivery rows remain, so actual ≠ Σ invoices for those items. Re-seed on a fresh DB (`migrate deploy` on a new file).
- **Nx cache:** it does not see CSV-only edits (api test inputs); a known limitation.

## Test strategy (Jest, `apps/api/src/seed-data/*.spec.ts`, tags in titles)
- **AC-03.1** `taucha-budget.spec.ts`:
  - Σ approved = 57,386,100 ¢; per category LAND 15,984,000 · ARCH 4,928,100 · MAT 14,485,500 · CONSTR 19,988,500 · MKT 2,000,000;
  - 43 lines, one per catalogue section;
  - contract price at 1500 bps = 65,994,015 ¢;
  - LAND/ARCH/MKT lines planned = approved;
  - derived projects: Markranstädt overrun 100–103 %; Markkleeberg and template 0 overruns; template Σ approved ≥ Taucha's (max rule).
- **AC-03.2** `taucha-schedule.spec.ts` + `taucha-budget.spec.ts`:
  - the exact overrun set, with earthworks = 380,000 ¢ and Σ < 2,934,000;
  - every other line forecast ≤ approved;
  - windows delay 9 (needBy 2026-10-19); heat pump delay 18 (needBy 2026-11-02); plaster AT_RISK slack 2;
  - the exact LATE/AT_RISK set; 0 OVERDUE; 0 UNSCHEDULED;
  - BLOCKED works exactly `WRK-WIN-001` (9) and `WRK-HEA-001` (18); no INVALID_DATES;
  - front door ON_TIME; slab concrete, rebar and roof tiles DELIVERED.
- **AC-03.3** `taucha-integrity.spec.ts`:
  - MATERIAL rows have a supplier (SUPPLIER) and a contractor (CONTRACTOR);
  - WORK rows have a contractor and start ≤ end;
  - ≥ 6 MATERIAL rows per materials section and ≥ 3 WORK rows per construction section except contingency;
  - every `requiredForWorkCode` resolves to a WORK row.
- **AC-03.4** `taucha-integrity.spec.ts`:
  - every BOQ link resolves and qty is equal; `materialSection` is in the catalogue; ≥ 3 components per HouseSection;
  - plus 7 unique utilities; 14 rooms, Σ 1,436,500 cm², in bounds, no overlap (every plan in every project);
  - deliveries consistent (constraint 9).
- **AC-03.5** (manual): seed twice on a scratch DB and compare sqlite3 counts (commands below). Support: `write-seed.spec.ts` (fake Prisma) checks that only `upsert`/`$transaction` are called, the `where` keys match the unique constraints, and the dependency order holds.
- **AC-03.6**:
  - `organizations.spec.ts`: 14 orgs, unique slugs, `.example` emails, roles 5/4/3/1/1;
  - `taucha-integrity.spec.ts` and `derive.spec.ts`: codes unique per project and matching `^(MAT|WRK|SRV)-<catalogue prefix>-\d{3}$`;
  - `delivery-fixtures.spec.ts`: CSV header, codes exist, no note clash, the valid rows applied with block 10's rule create no new LATE/OVERDUE/overrun, and the invalid rows carry the defects at pinned row numbers.

## How to verify
```bash
WT=/Users/dmitriyluba/WebstormProjects/Interview/Kairon-wt/03-seed-germany
bash $MAIN/howItWorks/bin/heavy.sh $WT npx nx test api          # AC-03.1–4, 03.6
cd $WT/apps/api && export DATABASE_URL="file:/tmp/kairon-ac035.db" && rm -f /tmp/kairon-ac035.db
npx prisma migrate deploy && npx prisma db seed && <counts> && npx prisma db seed && <counts>   # AC-03.5: identical
bash $MAIN/howItWorks/bin/check.sh 03
```

## Open questions
None for the owner. All decisions above are technical, or follow BLOCK/GERMANY-DATA, with the deviations recorded (14 rooms, template dates, full scaled row sets).

## As built (2026-10-14, commits `d1fac58`, `a9b40d0` on `feat/03-seed-germany`)

### Files
**`apps/api/src/seed-data/`:**

| File | Contents |
|---|---|
| `types.ts` | seed shapes; enums re-exported from `@default-project/types` |
| `money.ts` | `eur()`/`qty()` over the engine parsers |
| `row-builder.ts` | `buildRows()` with `MoneyState` `DONE`/`CONTRACTED`/`PLANNED`/explicit |
| `organizations.ts` | the 14 organisations |
| `taucha-items.ts` | 187 rows |
| `taucha.ts` | §9 approved table, `buildLines()`, land, 14 rooms, 35 BOQ components, 7 deliveries, `buildTauchaSeed()` |
| `derive.ts` | `deriveProject`, `scaleQty`, `shiftDate`, `scalePlan` |
| `projects.ts` | Markranstädt / Markkleeberg / template, `buildAllProjectSeeds()` |
| `to-snapshot.ts` | the seed mapped onto `ProjectSnapshot` |
| `write-seed.ts` | `upsertOrganizations`, `writeProjectSeed`, `runSeed` |

The land/plan/deliveries modules planned above were merged into `taucha.ts`, per the advocate's "fewer files".

**Specs (7 suites, 45 tests):** `taucha-budget`, `taucha-schedule`, `taucha-integrity`, `organizations`, `derive`, `write-seed`, `delivery-fixtures`.

**Callers and fixtures:**
- `apps/api/prisma/seed.ts` logs per-project stats through the Nest `Logger`.
- `apps/api/prisma/seed/index.ts` handles PrismaClient → `runSeed` → disconnect.
- `apps/web-e2e/fixtures/deliveries-valid.csv` and `deliveries-invalid.csv`.

### Engine-verified numbers

| Project | Results |
|---|---|
| Taucha | Overruns: earthworks 380,000 ¢, concrete 170,075 ¢, electrical 100,400 ¢. Forecast 54,045,565 ¢ (94.18 % of approved). Schedule: 2 LATE_FOR_WORK (9 d, 18 d), 1 AT_RISK (slack 2), 0 OVERDUE/UNSCHEDULED, 2 BLOCKED works |
| Markranstädt | forecast/approved 100.73 %; 4 overrun lines (shell, heating-install, roof, electrical-install) |
| Markkleeberg | approved 68,595,693 ¢, 0 overruns, 0 conflicts |
| Template | approved 57,656,575 ¢ (max rule raised concrete and electrical), 0 overruns, 0 conflicts at start − 1 d |

### Verification
- `check.sh 03`: ownership 0 · format 0 · affected lint/test/typecheck/build 0 · test-weakening 0 → PASS.
- `ac-ledger --block 03`: OK = 5, MANUAL = 1.
- Red-proof: moving the windows delivery one day earlier turns 2 schedule tests red.
- AC-03.5 on a scratch DB: seed ×2 gives identical counts and ids (counts in HANDOFF); a manual edit was restored by the re-seed. One seed takes ~1.4 s.

### Deviations from the plan above
- **Judge constraint 8 (bigint):** not needed. The engine builds bigints with `BigInt()`, not literals, so ts-jest compiles it (01 was notified before this was known).
- **Neighbour requests folded in:** 07's keyword row names and DIN class first; 10's invoice consistency.
