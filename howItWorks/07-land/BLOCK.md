# 07 — "Land" tab

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `07`). Start: `bash $BIN/bootstrap.sh 07` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 07` → `bash $BIN/merge-block.sh 07`.

**Wave:** W2 · **Priority:** STRETCH · **Estimate:** 45–60 min · **Worktree:** `Kairon-wt/07-land` (gate and base: `bin/blocks.conf`)
**In parallel:** 08 architecture draws the house on the plot using **your** `plotWidthCm/plotDepthCm` and its own `siteOffset*`. Agree with 08 through HANDOFF on who draws the site plan. **Decision: 08 owns `SitePlan`** (`features/architecture/site-plan.tsx`), and you embed it read-only on the Land tab. Until 08's merge, show your own placeholder rectangle.
09, 10 and 11 work in other folders, so there is no overlap.

## Goal
Route `/projects/:id/land`: a card of the plot and its conditions, plus the costs of the LAND category.

## You own
`apps/api/src/land/**` (fill in the stub module from 01: PATCH land, PATCH utility by type), `apps/web/src/features/land/**` (`LandPage`), `apps/web-e2e/src/land.spec.ts`.

## Page content
1. **Location**: address, postcode, municipality, district, state (Bundesland), cadastral reference; a link to OpenStreetMap by lat/lng (`https://www.openstreetmap.org/?mlat=..&mlon=..#map=17/..`, opens in a new tab; **no iframes or external scripts**). Plus a static mini-diagram with a north arrow.
2. **Plot**: area m², dimensions, land value per m² (Bodenrichtwert), price = area × price (comparison with the `purchase` row), orientation, slope.
3. **Zoning (B-Plan)**: GRZ/GFZ as % with a calculation of the allowed footprint (area × GRZ) and the actual footprint (from the plan, if any) → a "within limit / exceeds" indicator; max storeys; roof rules; building lines.
4. **Soil**: type, class, bearing capacity, groundwater depth, contamination, notes. An "Soil risk" badge: groundwater < 2 m or class ≥ 5 → warn.
5. **Utilities**: a grid of cards for the 7 types (icon, status badge CONNECTED/AT_BOUNDARY/IN_STREET/NOT_AVAILABLE, distance, provider) + the connection cost from the `site-development` rows.
6. **Land costs**: the LAND category table (4 sections as tabs/accordion) using the same EditableTable (SERVICE rows) + BudgetHealthPanel(category LAND).
Every field is editable inline and autosaved (a `useEditLand` hook in your folder: optimistic `setQueryData` on `snapshot.land` + `autosaveQueue.enqueue('land:'+projectId, patch)`).

## Steps
1. API: DTOs (`UpdateLandDto` partial, caps), `PATCH /projects/:id/land` (404 if there is no parcel → create it through upsert on the first PATCH), `PATCH /projects/:id/land/utilities/:type` (upsert by `[landId,type]`). Tests with Prisma mocked.
2. Web: `land-page.tsx`, `land-sections/*.tsx`, `use-edit-land.ts`, `use-edit-utility.ts`.
3. e2e spec: change groundwater to 150 cm → "Soil risk" badge → reload → the value is kept.

## Acceptance criteria
- AC-07.1 (Jest) PATCH land with negative `areaM2` → 400; a non-existent project → 404; utility upsert does not create duplicates.
- AC-07.2 (Vitest) The allowed footprint = 520 × 0.4 = 208 m²; the house footprint 90 m² → "within limit".
- AC-07.3 (Vitest) groundwater 150 cm → the "Soil risk" warn badge.
- AC-07.4 (Vitest) Editing the land value per m² triggers one PATCH after 400 ms; switching to another tab keeps the value.
- AC-07.5 (Vitest) The LAND cost block shows the CFO's 5 metrics for the LAND category.
- AC-07.6 (Jest) The first PATCH on a project without a parcel creates it with blank defaults; `null` on a required field → 400; `null` on groundwater clears it; out-of-cap integers → 400.
- AC-07.7 (Jest) Unknown utility `:type` → 400; a bad utility `status` → 400; a utility PATCH without a parcel creates the parcel first.
- AC-07.8 (Vitest) A failed PATCH rolls back the value and shows a toast; a pending utility edit survives a land save.
- AC-07.9 (Vitest) `land: null` → empty state without an OSM link and without a PATCH on mount; "Add land details" creates the parcel.
- AC-07.10 (Vitest) Plot price = area × land value per m², compared with the `purchase` line; utility costs come from `site-development` rows, one type per row.
- AC-07.11 (e2e) On a duplicated project: no "Soil risk" badge → groundwater 150 cm → badge visible → reload → value kept.

(AC-07.6–07.11 were added by the 07 brainstorm (judge); see DESIGN.md.)
