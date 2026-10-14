<!-- paths: apps/api/prisma/seed.ts, apps/api/prisma/seed/**, apps/api/src/seed-data/**, apps/web-e2e/fixtures/deliveries-*.csv | demo seed: Taucha, derived projects, wizard template -->
# Demo seed (Germany)

`npx prisma db seed` (run from `apps/api`) writes the demo data, built by block 03. The runner is
`ts-node --transpile-only -P tsconfig.app.json -r ./prisma/register-paths.cjs prisma/seed.ts`
(`apps/api/prisma.config.ts`); the preload resolves `@default-project/*`. `prisma/seed.ts` and
`prisma/seed/index.ts` are thin callers of `runSeed` (`apps/api/prisma/seed/index.ts:5`).

## What it writes
14 organisations (global) and 4 projects; 172 budget lines, 745 cost items, 7 deliveries in total.

| slug | status | rows | notes |
|---|---|---|---|
| `taucha-stadtvilla` | ACTIVE | 187 | **the demo**: 43 lines, Σ approved 57,386,100 ¢, land + 7 utilities, 14 rooms, 35 BOQ, 7 deliveries |
| `markranstaedt-bungalow` | COMPLETED | 186 | factor 110/144, dates −547 d, markup 12 %, own 9-room bungalow plan; forecast/approved 100.73 % |
| `markkleeberg-villa` | PLANNING | 186 | factor 160/144, dates +365 d, plan edge-scaled by √factor; 0 overruns, 0 conflicts |
| `template-efh-144` | PLANNING, `isTemplate` | 186 | wizard source: all PLANNED, committed = actual = 0, no deliveries; Σ approved 57,656,575 ¢ |

## Key files (`apps/api/src/seed-data/`)
| What | Where |
|---|---|
| `eur()` / `qty()` = engine `parseEurToCents` / `parseQtyToMilli` over decimal strings | `money.ts:4`, `:5` |
| Row builder with money states DONE/CONTRACTED/PLANNED/explicit | `row-builder.ts:42` |
| 14 organisations | `organizations.ts:4` |
| Taucha approved table (GERMANY-DATA §9) and lines | `taucha.ts:9`, `taucha.ts:61` |
| Taucha rows (187); `buildTauchaSeed()` | `taucha-items.ts:329`; `taucha.ts:216` |
| Derivation: `scaleQty` (only `m3 m2 m t kg h`), `shiftDate`, edge-scaled `scalePlan`, `deriveProject` | `derive.ts:28`, `:32`, `:36`, `:43`, `:142` |
| Derived projects and `buildAllProjectSeeds()` | `projects.ts:115`, `:139`, `:161`, `:182` |
| `toSnapshot(seed, orgs)` → engine `ProjectSnapshot` with synthetic ids (Jest checks invariants without a DB) | `to-snapshot.ts:12` |
| Writer: `upsertOrganizations`, `writeProjectSeed`, `runSeed` | `write-seed.ts:25`, `:34`, `:167` |
| Delivery CSV fixtures for block 10 | `apps/web-e2e/fixtures/deliveries-valid.csv`, `deliveries-invalid.csv` |

## Idempotency
- Every write is an `upsert` on a unique key: org `slug`, project `slug`, `(projectId, category,
  section)`, `(projectId, code)`, `(planId, code)`, `(landId, type)`, `(costItemId, deliveryNoteNo)`
  (`write-seed.ts:28`–`:111`). No `deleteMany`, `createMany` or reset; a fake-Prisma spec proves it.
- Organisations in one transaction, then one `$transaction` per project with
  `timeout: 60_000` (`write-seed.ts:23`, `:168`–`:170`).
- Seeding twice gives identical counts and ids (AC-03.5, manual); a re-seed restores seeded rows to
  their seed values.

## Demo moments (Taucha, today = 2026-10-14)
- Overrun lines, exactly: `earthworks` +380,000 ¢ (change order `WRK-EAR-006`), `concrete`
  +170,075 ¢ (192.50 €/m³), `electrical` (MATERIALS) +100,400 ¢. Σ overrun < contingency
  (2,934,000 ¢, a line with no rows). Forecast 54,045,565 ¢; contract price at 15 % = 65,994,015 ¢.
- Schedule: `MAT-WIN-001` windows LATE_FOR_WORK 9 d → `WRK-WIN-001` BLOCKED; `MAT-HEA-001` heat pump
  LATE_FOR_WORK 18 d → `WRK-HEA-001` BLOCKED; `MAT-DRP-001` gypsum plaster AT_RISK (slack 2);
  0 OVERDUE, 0 UNSCHEDULED; `MAT-WIN-002` front door ON_TIME with slack 3.
- `MAT-ELE-001` "Cable NYM-J 3×1.5 mm²" is **PARTIAL** with committed = actual = 760.00 €
  (1,000 m of 1,300 m delivered and paid), so a quantity edit moves EAC; a DONE row would not
  (`taucha-items.ts:140`, guarded by `taucha-budget.spec.ts:64` [AC-03.7]).
- Search keywords: the heat pump is named "aroTHERM"; utility rows carry the utility keyword (Land).

## Invariants (guarded by 7 Jest suites in `src/seed-data/*.spec.ts`)
- Money only from decimal strings through the engine parsers; references by code/slug, never ids.
- LAND, ARCHITECTURE and MARKETING rows sum exactly to their line's approved amount.
- Every MATERIAL row has a SUPPLIER and a CONTRACTOR; every WORK has a contractor and start ≤ end.
- Every BOQ link resolves 1:1 with equal qty and unit; rooms are in bounds and never overlap.
- For delivered items, `actualCents` = Σ invoices and `deliveredDate` = latest note date.
- PLANNED derivations (template, Markkleeberg) re-date materials with slack < 3 to `needBy − 5 d`
  (`derive.ts:92`–`:95`), drop the change order, and set approved = max(scaled approved, planned)
  per line (`derive.ts:137`), so they start with 0 overruns and 0 conflicts.
- `deliveries-valid.csv` applied by block 10's rule adds no conflict, OVERDUE or overrun.

## Decisions and deviations
- 14 rooms (BLOCK said 13); template keeps Taucha's dates (the wizard shifts them).
- Derived projects carry the full scaled row set rather than ~40 rows.
- Utility house connections are CONTRACTED, not paid. Markranstädt's contingency approved = 0
  (released into trades), so its small overrun is visible at project level.

## Known gaps
- A re-seed never deletes: rows added by users or CSV imports survive, so after an import actual may
  differ from Σ invoices. For a clean demo seed a fresh DB.
- A DELIVERED import for a DONE material without seeded Delivery rows replaces its actual by that one
  invoice (block 10's recompute rule).
- Nx cache does not see CSV-only edits (fixtures are not `api:test` inputs).
