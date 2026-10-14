# HANDOFF — 03-seed-germany

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
**merged** into main as `c067c47` (11:45). `check.sh 03` PASS, AC ledger OK = 5 + MANUAL 1. Branch `feat/03-seed-germany` (commits `d1fac58`, `a9b40d0`); merged into main via `merge-block.sh 03` after `w0-frozen`.

## Ready for neighbours

### How to get the data
After `03.merged`, follow PARALLEL-RUN §2:
```bash
git -C $WT merge --no-edit main && bash $BIN/heavy.sh $WT npm ci
cd $WT/apps/api && npx prisma migrate deploy && npx prisma db seed     # ~1.5 s, idempotent
```

### What the seed writes
14 organisations + 4 projects; 745 CostItems in total.

| slug | status | rows | land / plan | notes |
|---|---|---|---|---|
| `taucha-stadtvilla` | ACTIVE | 187 | 520 m², 7 utilities / 14 rooms, 35 BOQ | **the demo**, 7 deliveries |
| `markranstaedt-bungalow` | COMPLETED | 186 | 600 m² × 112 €/m² / 9 rooms (1 storey), 35 BOQ | all DONE + delivered; project forecast/approved = 100.73 % |
| `markkleeberg-villa` | PLANNING | 186 | 480 m² × 412 €/m² / 14 rooms scaled √(160/144), 35 BOQ | all PLANNED, 0 overruns, 0 conflicts |
| `template-efh-144` | PLANNING, `isTemplate` | 186 | Taucha land / Taucha plan | the wizard's source (below) |

**Taucha numbers (engine, today = 2026-10-14):**
- Budget:
  - approved **57,386,100 ¢**; planned/forecast 54,045,565 ¢; committed 42,239,205 ¢; actual 32,797,905 ¢;
  - contract price at 15 % = 65,994,015 ¢.
- Overrun lines, `overrunLines` order: `earthworks` +380,000 ¢ (change order `WRK-EAR-006`), `concrete` +170,075 ¢ (192.50 €/m³), `electrical` +100,400 ¢ (MATERIALS line).
  - Every other line is within budget, `electrical-install` included.
  - The contingency line (2,934,000 ¢, no rows) keeps the project under budget.
- Schedule conflicts, the only non-OK statuses:
  - `MAT-WIN-001` (windows): LATE_FOR_WORK, 9 d, needBy 2026-10-19 → `WRK-WIN-001` BLOCKED (9);
  - `MAT-HEA-001` (Vaillant aroTHERM plus): LATE_FOR_WORK, 18 d, needBy 2026-11-02 → `WRK-HEA-001` BLOCKED (18);
  - `MAT-DRP-001` (gypsum plaster): AT_RISK, slack 2, `WRK-PLS-001`.
- No OVERDUE and no UNSCHEDULED rows.
- `MAT-WIN-002` (front door) is ON_TIME with slack 3.
- Delivered: `MAT-CON-001` (slab concrete), `MAT-CON-003` (rebar), `MAT-ROF-002` (roof tiles) and others.

**Codes neighbours use:**

| Code | Row |
|---|---|
| `MAT-ELE-001` | "Cable NYM-J 3×1.5 mm²", supplier `rietzschke-baustoffe` (block 04's cable edit) |
| `MAT-WIN-001` | windows |
| `WRK-WIN-001` | window installation, 2026-10-19 → 2026-10-30 |
| `MAT-WIN-005` / `MAT-WIN-006` | stair / interior doors, linked to `WRK-WIN-004` / `WRK-WIN-005` (2027-02-15) |
| `MAT-HEA-001` | heat pump, named "aroTHERM" (search) |
| `MAT-DRP-001` | gypsum plaster |
| `SRV-DES-001…009` | HOAI LPH 1–9 |
| `SRV-DEV-001…006` | utility connections |
| `SRV-COM-001` | sales commission: one 0 € row |

Row codes follow `<MAT|WRK|SRV>-<catalogue prefix>-NNN` and are unique per project.

**Organisation roles:** material rows have a SUPPLIER-role supplier and a CONTRACTOR-role installer. Windows, the door, the stair and interior doors are fitted by `muehlberg-dach`; `fensterwerk-sachsen` is the supplier only. `architekten-sommer` is `plan.architectOrgId`.

**Block 07 (Land):**
- `site-development` row names carry the utility keyword: "Power connection…", "Water connection", "Sewer & stormwater connection…", "Telecom (fibre) connection", "Multi-utility wall entry", "Temporary site power and water". There is no gas row: not connected because of the heat pump.
- `soilClass` starts with the DIN class number: `4 (DIN 18300, …)`.

**Block 08 (Architecture):**
- Rooms are the GERMANY-DATA §2 table: **14** (BLOCK 03 said 13), Σ 1,436,500 cm² = 143.65 m², inside the 920 × 820 frame of the 1000 × 900 footprint.
- 35 BOQ components (≥ 3 per HouseSection). Each links 1:1 to a MATERIAL row (`boqComponentId`) with **equal qtyMilli and unit**.

**Block 10 (Delivery tracking):**
- `apps/web-e2e/fixtures/deliveries-valid.csv` (6 rows):
  - `MAT-WIN-002` (front door) DELIVERED 2026-10-14, 2,950.00 → status DELIVERED;
  - `MAT-ROF-005` and `MAT-ROF-008` DELIVERED;
  - `MAT-INF-001`, `MAT-HEA-003` and `MAT-ELE-005` EXPECTED, with slack ≥ 6 d.
  - Applying the file adds no conflict, no OVERDUE and no overrun (checked through the engine in `delivery-fixtures.spec.ts`). No note number clashes with a seeded one, and every item it touches has actual 0 in the seed.
- `deliveries-invalid.csv` (8 data rows), by data row (1 = first row after the header):

  | Row | Content |
  |---|---|
  | 1 | unknown code `MAT-XXX-999` |
  | 2 | bad date `2026-13-45` |
  | 3 | quantity `-5` |
  | 4 | amount `"12,5"` (quoted) |
  | 5 | valid |
  | 6 | duplicate of row 5 (`MAT-DRP-005`, `AB-OK-0005`) |
  | 7 | DELIVERED without an invoice |
  | 8 | valid |

- Seeded deliveries: `MAT-CON-001` ×2, `MAT-CON-002`, `MAT-CON-003` and `MAT-ROF-002` DELIVERED, with actual = Σ invoices and deliveredDate = max date. `MAT-WIN-001` 2026-10-28 and `MAT-HEA-001` 2026-11-20 EXPECTED.

**Block 11 (Analytics):** exactly one COMPLETED project (Markranstädt, small project-level overrun) and one PLANNING project (Markkleeberg). The template is `isTemplate: true`.

**Block 12 (Wizard), `template-efh-144`:**
- 43 lines (the full catalogue), every category > 0.
- 186 rows: Taucha minus change order `WRK-EAR-006`, codes unchanged, everything PLANNED with committed = actual = 0, no `deliveredDate`, no deliveries.
- Dates are kept (start 2026-04-01). Materials whose slack would be < 3 d are re-dated to 5 d before their work, so the template and its copies start with **no conflicts** (checked at today = start − 1 d).
- `requiredForWork` and BOQ links are the same as Taucha's. BOQ qty = material qty.
- Approved per line = max(Taucha approved, template planned), so the template has no overruns. Σ = 57,656,575 ¢; only concrete and electrical were raised to their planned amount.

### Code entry points (`apps/api/src/seed-data/`)
- `buildTauchaSeed()`, `buildAllProjectSeeds()` (`projects.ts`).
- `deriveProject(base, opts)` (`derive.ts`: scales only m3/m2/m/t/kg/h, edge-scales rooms, re-dates materials).
- `toSnapshot(seed, orgs)` → `ProjectSnapshot` with synthetic ids (code/slug); validates against `projectSnapshotSchema`.
- `runSeed(prisma)` (`write-seed.ts`).
- `prisma/seed.ts` → `prisma/seed/index.ts` → `runSeed`.

## How to check
```bash
WT=/Users/dmitriyluba/WebstormProjects/Interview/Kairon-wt/03-seed-germany
cd $WT && npx jest -c apps/api/jest.config.cts apps/api/src/seed-data      # 7 suites, 45 tests
bash $MAIN/howItWorks/bin/check.sh 03                                     # CHECK: PASS
# AC-03.5 (manual, scratch DB): seed twice → identical COUNT(*) per table and identical ids
cd $WT/apps/api && export DATABASE_URL="file:/tmp/kairon-ac035.db" && rm -f /tmp/kairon-ac035.db
npx prisma migrate deploy && npx prisma db seed && npx prisma db seed
```

AC-03.5 result (2026-10-14), identical after both runs:

| Table | Rows |
|---|---|
| ArchitecturePlan | 4 |
| BoqComponent | 140 |
| BudgetLine | 172 |
| CostItem | 745 |
| Delivery | 7 |
| ImportBatch | 0 |
| LandParcel | 4 |
| Organization | 14 |
| Project | 4 |
| Room | 51 |
| UtilityConnection | 28 |

A manual edit (`qtyMilli` of `MAT-WIN-001`) was restored by the re-seed.

## Gaps, CRs, deviations from CONTRACTS
No CRs. Deviations from BLOCK and GERMANY-DATA:
- **Rooms:** 14, not 13.
- **Template dates:** kept, per BLOCK step 6 and block 12; GERMANY-DATA §9 says "no dates".
- **Derived projects:** the full scaled row set instead of ~40 rows.
- **Utility connections:** CONTRACTED, not paid; they are built once the house stands.

Known limitations:
- **Re-seed never deletes:**
  - rows added by users or imports survive;
  - a re-seed after a CSV import leaves the imported Delivery rows, so actual ≠ Σ invoices for those items. For a clean demo, seed a fresh DB.
- **DONE materials without Delivery rows:** a DELIVERED import for such an item (e.g. `MAT-MAS-001`) replaces its actual by that one invoice (block 10's rule).
- **Markranstädt's contingency** has approved = 0: it was released into the trades at contract award, so the small overrun is visible at project level.
- **Nx cache:** it does not see CSV-only edits (the fixtures are not inputs of `api:test`).
- **Bigint concern:** noted to 01. The engine uses `BigInt()` calls, not literals, so there was no TS2737 and no change was needed.

## Change 2026-10-14: demo cable PARTIAL [AC-03.7]
Owner decision 2026-10-14: `MAT-ELE-001` (NYM-J 3×1.5, 1,300 m × 0.76 €) is now PARTIAL with committed = actual = 760.00 € (1,000 m delivered and paid, 300 m not ordered yet; still `delivered: true`, 2026-10-08). A DONE row's EAC = actual, so the CFO's qty edit on Building materials → Electrical (SUMMARY §3 step 3) never moved the KPIs. Effect: Spent and committed −228.00 €; Forecast/Variance/Profitability unchanged (EAC = planned 988.00 €, project forecast 540,455.65 €).
