# HANDOFF — 07-land

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
done on branch `feat/07-land`:
- commits `550dc0a` (API) and `f36147e` (web + e2e), plus a merge of main (01+02+03);
- `check.sh 07` → **CHECK: PASS**;
- `ac-ledger --block 07`: OK 10, UNRUN 1 (AC-07.11 is e2e, run by the integrator);
- **merged into main**: `5879e73 merge: 07-land` (`merge-block.sh 07`, check.sh green after merging main).

Design: [DESIGN.md](DESIGN.md) (approach A, judge: medium risk; owner decision: the first PATCH creates the parcel with blank values).

## Ready for neighbours (exports / components / endpoints, with examples)

### API (`apps/api/src/land/`)
| Endpoint | Behaviour |
|---|---|
| `PATCH /api/projects/:id/land` body `UpdateLandDto` (all optional) | → `LandParcel` (**without** `utilities`) |
| `PATCH /api/projects/:id/land/utilities/:type` body `{status?, distanceM?, provider?, notes?}` | → `UtilityConnection` |

**`PATCH …/land`:**
- Unknown project → 404.
- No parcel → `upsert` creates one from `LAND_DEFAULTS` (`land-defaults.ts`: empty strings, zeros, lat/lng 0) plus the patch.
- On a race (P2002) it falls back to `update`.

**`PATCH …/land/utilities/:type`:**
- An unknown `:type` → 400 (`ParseEnumPipe`); a bad `status` → 400.
- If the project has no parcel yet, it is created first.
- Upsert by `[landId, type]`; a new row defaults to `NOT_AVAILABLE`.

**Validation (`dto/update-land.dto.ts`, `LAND_CAPS`):**
- `null` on a NOT NULL column → 400.
- `null` clears the nullable fields: `district`, `cadastralRef`, `buildingLineNotes`, `bearingCapacityKnM2`, `groundwaterDepthCm`, `contaminationNotes`, `slopeNotes`, `orientation`, `notes`.
- Caps: `areaM2` ≤ 1e6, `landValuePerM2Cents` ≤ 1e8 (so area × price ≤ 1e14 stays a safe integer), `grzBps` ≤ 10 000, `gfzBps` ≤ 50 000, `maxStoreys` ≤ 20 (as in the zod type), cm/m/kN fields ≤ 1e5–1e6, lat ±90, lng ±180, strings ≤ 200 (notes ≤ 2000).

**For 12 (wizard):** writes land in its own transaction; nothing to import from here. If you want the same blanks, `LAND_DEFAULTS` is a plain object you can import.

### Web (`apps/web/src/features/land/`)
- **`land-calc.ts`** is pure (no React, no feature imports), so 08 may import it. 08 must **not** import `land-page` or `land-sections` (that would create a cycle once SitePlan is embedded here).
  - `allowedFootprintCm2(areaM2, grzBps)` = areaM2 × grzBps (cm², exact); `maxGrossFloorAreaCm2`; `houseFootprintCm2(plan)`; `footprintStatus(allowed, actual)` → `'WITHIN'|'EXCEEDS'|null` (equal = within).
  - `parseSoilClass`; `soilRisk({groundwaterDepthCm, soilClass})` (groundwater < 200 cm or class ≥ 5).
  - `plotPriceCents`, `utilityCosts(items)` (leading-keyword mapping, one type per row).
  - `hasCoordinates`, `osmUrl`, `formatCm2AsM2`, `formatCmAsM`.
  - **Zero means "not set" (`null`).**
- **Hooks:**
  - `useEditLand(projectId)` → stable `(patch) => void`; key `land:<projectId>`.
  - `useEditUtility(projectId)` → `(type, patch) => void`; key `utility:<projectId>:<type>`.
  - Both use 02's `autosaveEdit`. A land save writes only the parcel scalars and keeps `utilities`; a utility save writes only its own row.
  - `useCreateLand(projectId)` — mutation `PATCH {}`.
- **Cache helpers in `land-cache.ts`:** `selectLand` (re-applies unconfirmed `land:`/`utility:` patches after a refetch, because 02's `overlayUnconfirmed` only knows its own keys), `applyLandPatch`, `applyUtilityPatch`, `landKey`.
- **Fields in `fields.tsx`:** `InlineField` (same interaction as 02's cells: Enter → queue, blur → flush, Esc cancels), `TextField`, `IntField`, `MoneyField`, `PercentField` (bps), `MetresField` (cm), `CoordinateField`, `FieldRow`.
- **Accessible names used by the e2e:**
  - regions `Location`, `Plot`, `Zoning`, `Soil`, `Utilities`, `Land costs`;
  - buttons `Edit <label>`, e.g. `Edit Groundwater depth (cm)`;
  - badges `Soil risk` / `Soil OK`, `Within limit` / `Exceeds limit`.
- **Search (13):** `/projects/:id/land?highlight=<itemId>` opens the LAND cost section that holds the row; EditableTable flashes it.

### e2e
`apps/web-e2e/src/land.spec.ts` [AC-07.11]: duplicates `taucha-stadtvilla`, asserts there is no "Soil risk" badge, sets groundwater to 150 → badge → reload → `150 cm`. **Run by the integrator:** `bash howItWorks/bin/e2e.sh --grep "AC-07"`.

## How to check
- `bash $BIN/check.sh 07` → `CHECK: PASS` (lint/test/typecheck/build for api, web, web-e2e). Tests: api 20 (`land.service.spec.ts`, `land.controller.spec.ts`), web 23 (`land-calc.spec.ts`, `land-page.spec.tsx`).
- Red-proofs done:
  - remove `@Min(0)` on `areaM2` → AC-07.1 goes red;
  - a land save that replaces `utilities` → AC-07.8 goes red;
  - groundwater threshold 100 → AC-07.3 goes red.
- **Live API check** on the seeded worktree database (`PORT=3507`):
  - groundwater 150 → 200; `areaM2 -1` / `null` → 400; `groundwaterDepthCm null` → 200 (cleared);
  - `utilities/WIFI` → 400; `status FOO` → 400; GAS upsert updates the seeded row (still 7 types, no duplicate);
  - missing project → 404;
  - a new project without a parcel: `PATCH {address}` → 200 with blank defaults, and a utility PATCH → 200.
- **The browser visual check was not done:** several Chrome instances are connected and choosing one needed the owner. The UI is covered by Vitest; the e2e is up to the integrator.

## Gaps, CRs, deviations from CONTRACTS
- **No CRs, no frozen files touched.**
- **Contract superset:** `status` is optional in the utility PATCH body (a new row defaults to `NOT_AVAILABLE`); the zod `upsertUtilityInputSchema` makes it required.
- **Deviation from the judge, constraint 7:** utility costs are mapped by the **leading keyword of the row name**, not by `DEV-*` codes. The seed codes `SRV-DEV-001…006` do not encode the type. Rows such as "Temporary site power and water" or "Multi-utility wall entry" go to "Other site development".
- **SitePlan:** 08 had not merged when this block merged, so the Land tab shows its own `PlotDiagram` placeholder (plot to scale, house from `plan.siteOffset*`, north arrow).
  - After `08.merged`, the swap is one import in `features/land/plot-diagram.tsx`: render `<SitePlan projectId={projectId} />` (signature from 08's HANDOFF).
  - Because this is a follow-up commit after 07's merge, the owner decides who does it (a 07 follow-up session or the integrator).
- **Added to the BLOCK.md registry:** AC-07.6 … AC-07.11 (from the judge). The integrator commits `howItWorks/`.
- **Testing note:** jest-dom is not wired up in web (`test-setup.ts` is 02's), so the specs use plain matchers.
