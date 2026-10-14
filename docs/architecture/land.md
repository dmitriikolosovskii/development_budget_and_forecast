<!-- paths: apps/api/src/land/**, apps/web/src/features/land/**, apps/web-e2e/src/land.spec.ts | Land tab: parcel, zoning, soil, utilities, site plan, LAND costs -->
# Land tab (as-built: block 07 `5879e73`, SitePlan swap by the integrator `5822509`)

## What it does
`/projects/:projectId/land` (the default tab of a project):
- **Location:** address, postcode, municipality, district, state, cadastral reference, lat/lng, an OpenStreetMap link and the site diagram (block 08's `SitePlan`).
- **Plot:** area, width and depth, land value per m², plot price compared with the `purchase` line, orientation, slope.
- **Zoning:** B-Plan, GRZ/GFZ, allowed vs actual footprint with a "Within limit" / "Exceeds limit" badge, max storeys vs the plan, roof rules, building lines.
- **Soil:** fields plus a "Soil risk" / "Soil OK" badge.
- **Utilities:** 7 utility cards (status, distance, provider, connection cost).
- **Land costs:** the LAND cost table (4 sections) with `BudgetHealthPanel(category LAND)`.

Every field is edited inline and autosaved.

## API — `apps/api/src/land/`
- `LandController` (`land.controller.ts:11`), route `projects/:projectId/land`:
  - `PATCH /` → `LandService.updateLand` (`land.controller.ts:15`);
  - `PATCH /utilities/:type` with `ParseEnumPipe(UtilityType)` → `upsertUtility` (`land.controller.ts:23-26`).
- `LandService` (`land.service.ts`):
  - `updateLand` (`land.service.ts:22`): `ProjectScopeService.assertProject` (404), then `landParcel.upsert({where:{projectId}, create:{...LAND_DEFAULTS, ...patch}, update: patch})`; on P2002 it falls back to `update` (`land.service.ts:31-34`).
  - `upsertUtility` (`land.service.ts:39`): `ensureParcel` (`land.service.ts:58`, upsert with defaults), then `utilityConnection.upsert({where:{landId_type}})`; a new row defaults to `NOT_AVAILABLE` (`land.service.ts:50`).
- `LAND_DEFAULTS` / `definedOnly` (`land-defaults.ts:7`, `:31`): blank values for a parcel created by the first PATCH (owner decision 2026-10-14); `undefined` DTO fields never override defaults.
- DTOs: `dto/update-land.dto.ts` (`LAND_CAPS` at `:15`) and `dto/update-utility.dto.ts`, using 01's `OptionalNotNull` / `OptionalNullable` from `projects/dto/validators.ts`.

## Web — `apps/web/src/features/land/`
- `land-page.tsx:17` `LandPage`: loading → Skeleton; error → ErrorState with retry; `land: null` → EmptyState with "Add land details" (`use-create-land.ts:10`, `PATCH {}`).
- `land-sections/*.tsx`: section cards (`role="region"`, named Location, Plot, Zoning, Soil, Utilities, Land costs). Each reads a slice via `useProjectSnapshot(projectId, select)`.
- `land-calc.ts` — pure rules, zero means "not set" (`null`):
  - `allowedFootprintCm2` (`:10`) = `areaM2 × grzBps` cm²; `footprintStatus` (`:42`): equal to the limit is within.
  - `parseSoilClass` (`:69`): leading bare 1–7 or `class|Klasse|BK N`; `soilRisk` (`:85`): groundwater < 200 cm or class ≥ 5.
  - `plotPriceCents` (`:104`) = area × value per m².
  - `utilityTypeForItem` (`:130`) / `utilityCosts` (`:145`): each `site-development` row maps to at most one `UtilityType` by the **leading keyword** of its name; the rest is "Other site development".
- Edits: `use-edit-land.ts:16`, `use-edit-utility.ts:20` and `land-cache.ts` go through 02's `autosaveEdit` (`features/project/autosave-edit.ts`).
  - Queue keys `land:<projectId>` and `utility:<projectId>:<type>` (`land-cache.ts:20`).
  - A land save writes only parcel scalars (`applyLandPatch`, `land-cache.ts:32`, keeps `utilities`); a utility save writes only its own row (`applyUtilityPatch`, `:60`).
  - `selectLand` (`land-cache.ts:81`) re-applies unconfirmed `land:`/`utility:` patches after a refetch.
- `fields.tsx:36` `InlineField` and typed variants (`TextField`, `IntField`, `MoneyField`, `PercentField`, `MetresField`, `CoordinateField`): Enter queues the save (400 ms), blur flushes, Esc cancels. Metres and percent are parsed as two-decimal strings, never via float.
- `land-sections/land-costs-section.tsx`: `SubNav` over the LAND lines, 02's `EditableTable` and `BudgetHealthPanel`; `?highlight=<itemId>` (from Search) opens the section that holds the row (`:111-115`).

## Site diagram (integrator change, after `08.merged`)
- `plot-diagram.tsx:10` `PlotDiagram` now renders `<SitePlan projectId={projectId} />` from `features/architecture/site-plan` (`plot-diagram.tsx:1`, `:11`). 07's own placeholder SVG is gone; Land and Architecture draw the same picture from the same snapshot.
- The `land` prop is kept (unused) so `land-sections/location-section.tsx:104` did not change.
- Guarded by `plot-diagram.spec.tsx` (house drawn with a plan, plot only without one).
- Dependency direction: land → architecture (`site-plan`) only; 08 may import the pure `land-calc.ts`, never `land-page` or `land-sections`.

## Invariants
- `null` on a NOT NULL column → 400; `null` clears nullable fields (`district`, `cadastralRef`, `buildingLineNotes`, `bearingCapacityKnM2`, `groundwaterDepthCm`, `contaminationNotes`, `slopeNotes`, `orientation`, `notes`).
- Every Int is capped (`LAND_CAPS`), so `areaM2 × landValuePerM2Cents ≤ 1e14` stays a safe integer.
- One utility row per `[landId, type]`.
- Each save touches only its own cache slice; rollback goes to the last confirmed value of that key.
- After every successful save `['projects']` and `['analytics']` are invalidated (inside `autosaveEdit`).

## Tests
| AC | Where |
|---|---|
| 07.1, 07.6, 07.7 | `apps/api/src/land/land.service.spec.ts` (Prisma mocked), `land.controller.spec.ts` (real Nest app on port 0 + global `ValidationPipe`) |
| 07.2, 07.3, 07.9, 07.10 | `apps/web/src/features/land/land-calc.spec.ts` |
| 07.2–07.5, 07.8–07.10 | `apps/web/src/features/land/land-page.spec.tsx` (cache seeded directly, mocked API, fake timers) |
| 07.11 (e2e) | `apps/web-e2e/src/land.spec.ts` (duplicate of `taucha-stadtvilla`; groundwater 150 → badge → reload) |

## Deviations from CONTRACTS
- Contract superset: `status` is optional in the utility PATCH body (new row → `NOT_AVAILABLE`); the zod `upsertUtilityInputSchema` makes it required.
- Utility costs map by the leading keyword of the row name, not by `DEV-*` codes (seed codes `SRV-DEV-001…006` don't encode the type).
- `maxStoreys` cap is 20 (matches the zod type), not the 50 in the design's judge constraints.

## Known gaps
- No geocoding and no map embed (by design: no iframes or external scripts; only an OSM link with `rel="noopener noreferrer"`).
- The utility-cost mapping depends on row names starting with the utility keyword; the seed (03) follows this, user-renamed rows fall into "Other".
- jest-dom is not wired up in web, so the specs use plain matchers.
