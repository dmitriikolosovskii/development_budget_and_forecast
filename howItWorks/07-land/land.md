<!-- paths: apps/api/src/land/**, apps/web/src/features/land/**, apps/web-e2e/src/land.spec.ts | Land tab: parcel, zoning, soil, utilities, LAND costs -->
# Land tab (as-built, merged into main at `5879e73`)

> For the integrator: this file is meant for `docs/architecture/land.md`, plus a row in `docs/architecture/README.md`. Block 07 cannot write `docs/**` (ownership, and a dirty main would block merges).

## What it does
`/projects/:projectId/land` (the default tab of a project):
- **Location:** address, postcode, municipality, district, state, cadastral reference, lat/lng, an OpenStreetMap link and a plot diagram.
- **Plot:** area, width and depth, land value per m², plot price compared with the `purchase` line, orientation, slope.
- **Zoning:** B-Plan, GRZ/GFZ, allowed and actual footprint with a "Within limit" / "Exceeds limit" badge, max storeys compared with the plan, roof rules, building lines.
- **Soil:** fields plus a "Soil risk" / "Soil OK" badge.
- **Utilities:** 7 utility cards (status, distance, provider, connection cost).
- **Land costs:** the LAND cost table (4 sections) with `BudgetHealthPanel(category LAND)`.

Every field is edited inline and autosaved.

## API — `apps/api/src/land/`
- **`LandController`** (`land.controller.ts`), route `projects/:projectId/land`:
  - `PATCH /` → `LandService.updateLand`;
  - `PATCH /utilities/:type` (`ParseEnumPipe(UtilityType)`) → `upsertUtility`.
- **`LandService`** (`land.service.ts`):
  - `updateLand` calls `ProjectScopeService.assertProject` (404), then `landParcel.upsert({where:{projectId}, create:{...LAND_DEFAULTS, ...patch}, update: patch})`. On P2002 it falls back to `update`.
  - `upsertUtility` first runs `ensureParcel` (an upsert with defaults), then `utilityConnection.upsert({where:{landId_type}})`. A new row defaults to `NOT_AVAILABLE`.
- **`LAND_DEFAULTS`** and `definedOnly` (`land-defaults.ts`): blank values for a parcel created by the first PATCH (owner decision 2026-10-14). `undefined` DTO fields never override the defaults.
- **DTOs** (`dto/update-land.dto.ts` with `LAND_CAPS`, and `dto/update-utility.dto.ts`) use 01's `OptionalNotNull` / `OptionalNullable` from `projects/dto/validators.ts`.

**Invariants:**
- `null` on a NOT NULL column → 400.
- Every Int is capped, and `areaM2 × landValuePerM2Cents ≤ 1e14` (a safe integer).
- One utility row per `[landId, type]`.

## Web — `apps/web/src/features/land/`
- `land-page.tsx` holds the `LandPage` states:
  - loading → Skeleton;
  - error → ErrorState with retry;
  - `land: null` → an EmptyState with an "Add land details" button (`use-create-land.ts`, `PATCH {}`).
- `land-sections/*.tsx` are the section cards (`role="region"` with names). Each one reads small slices through `useProjectSnapshot(projectId, select)`.
- **`land-calc.ts`** holds the pure rules. Zero means "not set" (`null`).
  - Allowed footprint = `areaM2 × grzBps` cm². The house footprint comes from `plan.footprintWidthCm × footprintDepthCm`; equal to the limit counts as within.
  - Soil risk: groundwater < 200 cm, or a DIN 18300 class ≥ 5. The class is the leading number 1–7 or `class|Klasse|BK N`, so "DIN 18300 class 4" is class 4.
  - Plot price = area × value per m².
  - Utility cost: each `site-development` row maps to at most one `UtilityType` by the **leading keyword** of its name ("Power…", "Water…", "Sewer…", "Telecom|Fibre…", "Gas…", "District heating…"). Everything else is "Other site development".
- **Edits** (`use-edit-land.ts`, `use-edit-utility.ts`, `land-cache.ts`) go through 02's `autosaveEdit` (`features/project/autosave-edit.ts`).
  - Queue keys are `land:<projectId>` and `utility:<projectId>:<type>`.
  - A land save writes only the parcel scalars (`applyLandPatch` keeps `utilities`); a utility save writes only its own row (`applyUtilityPatch`).
  - `selectLand` re-applies unconfirmed patches after a refetch.
- **`fields.tsx`:** `InlineField` and its typed variants. Enter queues the save (400 ms), blur flushes, Esc cancels. Metres and percent are parsed as two-decimal strings with the engine's `parseEurToCents`, never via float.
- **`plot-diagram.tsx`:** a placeholder SVG (plot to scale, house from `plan.siteOffset*`, north arrow) until block 08's `SitePlan` is merged. Then only this file switches to `<SitePlan projectId={projectId} />`.
- **`land-costs-section.tsx`:** `SubNav` over the LAND lines, 02's `EditableTable` and `BudgetHealthPanel`. `?highlight=<itemId>` (from Search) opens the section that holds the row.

## Tests
| AC | Where |
|---|---|
| 07.1, 07.6, 07.7 | `apps/api/src/land/land.service.spec.ts` (Prisma mocked), `land.controller.spec.ts` (a real Nest app on port 0 with `fetch` and the global `ValidationPipe`) |
| 07.2, 07.3, 07.9, 07.10 | `apps/web/src/features/land/land-calc.spec.ts` |
| 07.2–07.5, 07.8–07.10 | `apps/web/src/features/land/land-page.spec.tsx` (cache seeded directly, `mockApi`, fake timers + `notifyManager.setScheduler`) |
| 07.11 (e2e) | `apps/web-e2e/src/land.spec.ts` (a duplicate of `taucha-stadtvilla`; groundwater 150 → badge → reload) |

## Known limits
- No geocoding and no map embed (by design: no iframes or external scripts).
- The plot diagram is a placeholder until 08's `SitePlan` is merged.
- The utility-cost mapping depends on row names starting with the utility keyword. The seed (03) follows this.
