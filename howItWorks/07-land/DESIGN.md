# DESIGN — 07 Land tab (2026-10-14)

Brainstorm in block mode: context → 1 owner question → 3 approaches → panel (prosecutor, advocate, architect, tester) → judge. Verdict: **approach A, risk medium.**

## Goal / Non-goals
**Goal.** `/projects/:id/land` shows the plot card and its conditions (location, plot, zoning, soil, utilities) with every field editable inline and autosaved, plus the LAND category costs (4 sections, EditableTable) with `BudgetHealthPanel(category LAND)`.
**API.** `PATCH /api/projects/:id/land` and `PATCH /api/projects/:id/land/utilities/:type` (CONTRACTS §5).

**Non-goals:**
- maps or iframes (only an OSM link in a new tab);
- geocoding;
- storing the plot price (computed on the client);
- changing schema, types or routes;
- drawing the house on the plot (08 owns `SitePlan`).

## Owner decision (asked as [Block 07])
A project without a parcel: the **first PATCH creates the parcel with blank/zero values** (upsert). The UI shows "not set" instead of computing with zeros: no false "exceeds", no OSM link to 0,0.

## Chosen approach — A
- **One `LandPage`** built from section cards in `land-sections/*`.
- **Fields** use 02's standalone cells (`TextCell`, `MoneyCell`) and a small `NumberField` / `PercentField` in `features/land/` for integers, cm and bps.
- **Edits:**
  - `useEditLand` / `useEditUtility` are built on 02's `autosaveEdit`: slice read/write, rollback to the last confirmed row, and `invalidateRollups` after success.
- **Pure logic in `land-calc.ts`:**
  - allowed footprint;
  - soil risk;
  - plot price vs the `purchase` line;
  - utility costs from the `site-development` rows.
- **LAND costs:** `SubNav` over the 4 LAND lines + `EditableTable` (SERVICE rows) + `BudgetHealthPanel`.
- **Plot diagram:** our own `PlotDiagram` placeholder. It is swapped for 08's `SitePlan` if `08.merged` lands before our merge.

**Rejected:**
- **B (react-hook-form + debounce per section):** a second debounce and dirty state on top of `autosaveQueue`, which conflicts with flush and "latest wins" (CONTRACTS §6).
- **C (land fields as `EditableTable` rows):** needs fake row ids and mixed types in one column, and the cells are tied to `CostItem`.

## Judge constraints (mandatory)
1. **Each save touches only its own slice of the cache.**
   - Land: `{...cur, ...res, utilities: cur.utilities}`.
   - Utility: only its own row.
   - Rollback goes to the last confirmed value of that key (02's `autosaveEdit`).
   - Keys: `land:<pid>` and `utility:<pid>:<type>`.
2. **`null` on a non-nullable column → 400**, using `@ValidateIf(o => o.f !== undefined)`.
   - Nullable fields accept `null`: `district`, `cadastralRef`, `buildingLineNotes`, `bearingCapacityKnM2`, `groundwaterDepthCm`, `contaminationNotes`, `slopeNotes`, `orientation`, `notes`; on utilities `distanceM`, `provider`, `notes`.
3. **Caps:**
   - `areaM2` ≤ 1,000,000;
   - `landValuePerM2Cents` ≤ 100,000,000 (so area × price ≤ 1e14 is a safe integer);
   - `grzBps` ≤ 10,000, `gfzBps` ≤ 50,000;
   - `plotWidthCm` / `plotDepthCm` ≤ 1,000,000;
   - `maxStoreys` ≤ 50;
   - `bearingCapacityKnM2` ≤ 100,000;
   - `groundwaterDepthCm` ≤ 100,000;
   - `distanceM` ≤ 100,000;
   - `lat` ±90, `lng` ±180;
   - strings `@MaxLength(200)`, notes `@MaxLength(2000)`.
4. **`ensureParcel(projectId)`:**
   - Project missing → `NotFoundException`.
   - Then `landParcel.upsert({where:{projectId}, create: LAND_DEFAULTS+projectId, update:{}})`.
   - On P2002 (a concurrent create) retry once.
   - Both endpoints call it.
   - Utility: `upsert({where:{landId_type}}, create default status NOT_AVAILABLE)`.
   - `:type` → `ParseEnumPipe`; `status` → `@IsIn(UTILITY_STATUSES)`.
5. **"Not set" instead of zero.**
   - `land-calc` returns `null` when area = 0, GRZ = 0, there is no plan footprint, or lat = lng = 0.
   - The OSM link uses `target="_blank" rel="noopener noreferrer"`. No iframes.
6. **Strict soil class parsing.**
   - A leading bare number 1–7 (`"4 (DIN 18300, …)"`, which is the format of 03's seed), or `class|klasse|bk` + 1–7.
   - Anything else is "unknown" and gives no risk from the class.
   - Risk = groundwater < 200 cm **or** class ≥ 5 (BLOCK.md).
7. **Utility costs: each row maps to at most one type, by the leading keyword of its name** (`Power…`→POWER, `Water…`→WATER, `Sewer…`→SEWER, `Storm…`→STORMWATER, `Telecom|Fibre|Broadband…`→TELECOM, `Gas…`→GAS, `District heating…`→DISTRICT_HEATING). The rest go to "Other site development".
   - **Deviation from the judge's "by DEV-* codes":** the seed codes are sequential (`SRV-DEV-001…006`) and don't encode the type. Hard-coding them would break wizard projects.
   - Anchoring on the first word removes the double counting the prosecutor found ("Temporary site power and water" → Other; "Sewer & stormwater" → SEWER only).
8. **After every successful save:** `invalidateQueries(['projects'])` and `['analytics']` (built into `autosaveEdit`).
9. **`LandPage` is the default tab:**
   - land `null` → an empty state with an "Add land details" button;
   - no fetch beyond `['project', id]` and no save on mount;
   - loading/error states from the snapshot.
10. **The `SitePlan` swap stays inside 07.**
    - The import changes only in `plot-diagram.tsx`, after `08.merged` → `git merge main && npm ci`.
    - `land-calc.ts` stays pure; 08 may import it, but never `land-page`.
11. **Search highlight links work.** `?highlight=<itemId>` (13 links LAND items without a section) → the cost block opens the section that holds that item.
12. **400 tests:** `new ValidationPipe({whitelist:true, transform:true}).transform(body, {type:'body', metatype})`. There is no supertest.

## Affected files (all inside the row-07 globs of `bin/blocks.conf`)
API `apps/api/src/land/`:
- `land.module.ts`, `land.controller.ts` (the stubs from 01, filled in)
- `land.service.ts`, `land-defaults.ts`
- `dto/update-land.dto.ts`, `dto/update-utility.dto.ts`
- `land.service.spec.ts`, `land.controller.spec.ts` (HTTP validation on a real Nest app; as-built)

Web `apps/web/src/features/land/`:
- `land-page.tsx` (body of 02's placeholder), `land-calc.ts` (+ `.spec.ts`)
- `land-cache.ts` (slice reducers, `selectLand`), `land.fixtures.ts` (tests), `use-edit-land.ts`, `use-edit-utility.ts`, `use-create-land.ts`
- `fields.tsx` (`NumberField`, `PercentField`)
- `plot-diagram.tsx`
- `land-sections/{location,plot,zoning,soil,utilities,land-costs}-section.tsx`
- `land-page.spec.tsx`

e2e: `apps/web-e2e/src/land.spec.ts`.
Frozen files: none.

## Risks
| Risk | Measure |
|---|---|
| A land save overwrites an unsaved utility edit, or the other way round | Separate keys and slice-only write (constraint 1), AC-07.8 |
| `null` or a large number → Prisma 500 | `@ValidateIf` + caps (constraints 2–3), AC-07.6 |
| A false "Soil risk" from the class text | Strict parser (constraint 6), AC-07.3, and the e2e checks the badge is absent before the edit |
| Zero values after creation look like a real result | `null` → "not set" (constraint 5), AC-07.2/07.9 |
| `SitePlan` from 08 doesn't exist yet | Placeholder; swap only after `08.merged` (constraint 10) |

## Test strategy (tags `[AC-07.N]`; the registry is in BLOCK.md)
- **AC-07.1 (Jest)** Negative `areaM2` → 400; unknown project → 404; a repeated utility upsert uses `where landId_type` (no `create` call).
- **AC-07.2 (Vitest)** Allowed footprint 520 × 4000 bps = 2,080,000 cm² = 208 m²:
  - a 90 m² footprint → "within limit";
  - equal to the limit → within;
  - more → "exceeds";
  - area/GRZ = 0 or no plan → `null` / "not set".
- **AC-07.3 (Vitest)** Soil risk:
  - groundwater 150 → "Soil risk" badge (warn); 200 → none; `null` → none;
  - class "5" → risk; "4 (DIN 18300 …)" → none; "DIN 18300 class 4" → none.
- **AC-07.4 (Vitest)** Edit land value/m²:
  - exactly 1 PATCH at 400 ms, 0 at 399 ms (fake timers);
  - unmount and remount the page (switching tabs) → the value is kept (from the cache).
- **AC-07.5 (Vitest)** The LAND cost block shows the CFO's 5 metrics for the LAND category.
- **AC-07.6 (Jest)** First PATCH → upsert with `LAND_DEFAULTS` + patch; `areaM2: null` → 400; `groundwaterDepthCm: null` → passes (clears); out-of-cap values → 400.
- **AC-07.7 (Jest)** Unknown `:type` → 400 (ParseEnumPipe); bad `status` → 400; `ensureParcel` is called for utilities when there is no parcel.
- **AC-07.8 (Vitest)** PATCH 500 → rollback + toast; a pending utility edit survives a land save.
- **AC-07.9 (Vitest)** `land: null` → empty state, no OSM link, no PATCH on mount; the button creates the parcel.
- **AC-07.10 (Vitest)**
  - Plot price 520 × 26,000 ¢ = 13,520,000 ¢, compared with the planned total of the `purchase` line.
  - Utility cost by leading keyword: "Temporary site power and water" → Other.
- **AC-07.11 (e2e)** On a duplicated project: no badge before the edit → groundwater 150 → "Soil risk" visible → reload → 150 is kept.

## How to verify
- `bash $BIN/check.sh 07` → `CHECK: PASS`.
- `bash $BIN/ac-ledger.sh --block 07` (from `$WT`).
- e2e: only the integrator runs it: `bash howItWorks/bin/e2e.sh --grep "AC-07"`.

## Open questions
None that are business questions. The parcel-creation question is settled by the owner (see above).
