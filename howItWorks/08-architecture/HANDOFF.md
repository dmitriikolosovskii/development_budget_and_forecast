# HANDOFF — 08-architecture

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
checked (`check.sh 08` PASS, AC ledger 8/8 OK) → merging via `merge-block.sh 08`

## Ready for neighbours (exports / components / endpoints, with examples)

### For 07 land — `SitePlan` (signature unchanged since the first HANDOFF)
```tsx
import { SitePlan } from '../architecture/site-plan';
<SitePlan projectId={projectId} />            // props: { projectId: string; className?: string }
```
- Read-only; reads `useProjectSnapshot(projectId)` itself (`land` + `plan`). Loading → Skeleton; `land: null` → "No plot data"; `plan: null` → plot only + "No house plan yet".
- Draws: plot, street (top edge, y = 0), house at `siteOffset*`, dashed setback dimensions, a hatched buildable window 3 m from every boundary (`MIN_SETBACK_CM`, SächsBO §6), north arrow. Caption: plot size, `GRZ x.xx: allowed footprint N m²` (= `areaM2 × grzBps / 10000`, half-up) · house m², setbacks line (`data-testid="setbacks"`).
- `role="alert"` "House extends outside the plot" when any setback < 0.
- It imports only `plan-geometry`, `north-arrow`, `drawing-colors` and project hooks (no cycle with land).

### API (`apps/api/src/architecture/`, prefix `/api/projects/:projectId/plan`)
| Method & path | Body | Response | Notes |
|---|---|---|---|
| `PATCH /plan` | `UpdatePlanDto` (all optional) | `ArchitecturePlan` (no rooms/components) | 404 if no project; **upsert** with Stadtvilla defaults (GERMANY-DATA §2) on first use; `architectOrgId` must exist (400) |
| `POST /plan/rooms` | `CreateRoomDto` | `Room` | 404 if the project has no plan; duplicate `code` → 409 |
| `PATCH/DELETE /plan/rooms/:roomId` | `UpdateRoomDto` | `Room` | room must belong to the project's plan, else 404. **Overlaps are not validated** (UI warning only) |
| `POST /plan/components` | `CreateComponentDto` | `BoqComponent` | 404 without a plan; 409 on duplicate code |
| `PATCH /plan/components/:componentId` | `UpdateComponentDto` | `{ component, updatedItemIds }` | with `qtyMilli`: one interactive `$transaction` → `component.update`, `costItem.findMany` + `updateMany({ where: { boqComponentId }, data: { qtyMilli } })`. Without `qtyMilli`: `updatedItemIds: []` |
| `DELETE /plan/components/:componentId` | | `BoqComponent` | linked items stay (`boqComponentId` → null by the schema) |

DTO limits: geometry `wCm/hCm` 1..100000, `xCm/yCm` 0..100000, site offsets ±100000; `floor ∈ {0,1}`; `kind ∈ ROOM_KINDS`; `houseSection` enum; `unit ∈ UNITS`; `materialSection` = a MATERIALS slug or null; `qtyMilli` 0..2e9.

### Web (`apps/web/src/features/architecture/`)
- `ArchitecturePage` (placeholder body replaced, same export).
- Hooks (`use-plan-edits.ts`), autosave keys `plan:<projectId>`, `room:<roomId>`, `boq:<componentId>`:
  `useEditPlan`, `useCreatePlan`, `useEditRoom`, `useCreateRoom`, `useDeleteRoom`, `useEditComponent`, `useCreateComponent`, `useDeleteComponent`.
- **For 04 / 06 (cross-tab):** `useEditComponent(pid)(id, { qtyMilli })` patches the component **and every cached item with that `boqComponentId`** through 02's `applyItemsPatch` (indexes stay consistent), so Materials rows, KPIs and Profitability move at once. A linked item that has its own pending `item:<id>` qty edit keeps it (that edit wins locally). On failure only the linked `qtyMilli` is rolled back (rows that still show the optimistic value) + toast.
- Selectors (`use-plan.ts`): `usePlan`, `useComponentIds(pid, section)`, `useComponent`, `useBoqLink(pid, componentId)` → `{count, plannedCents, unitMismatch}`, `useSectionCosts(pid)`.
- Pure geometry (`plan-geometry.ts`): `WALL_CM = 40`, `innerFrame` (1000×900 → 920×820), `livingAreaCm2`, `formatAreaM2(cm2, 1|2)` (integer half-up), `overlaps` (strict; touching edges are fine), `findRoomIssues` (same floor only + out of frame), `issueMessages`, `siteSetbacks`, `isHouseOnPlot`, `allowedFootprintM2`.
- 13 search: `/projects/:pid/architecture?highlight=<itemId>` works for ARCHITECTURE items (they are rendered by 02's `EditableTable`).

## How to check
- `bash $BIN/check.sh 08` → `CHECK: PASS` (ownership 0, format 0, affected lint/test/typecheck/build 0, test-weakening 0).
- `bash $BIN/ac-ledger.sh --root <wt> --block 08` → OK=8 (AC-08.1–08.7, 08.10).
- Tests: `apps/api/src/architecture/architecture.service.spec.ts`, `dto/architecture-dto.spec.ts`; web `plan-geometry.spec.ts`, `boq-section.spec.tsx`, `floor-plan.spec.tsx`, `site-plan.spec.tsx`, `architecture-page.spec.tsx`.
- Red-proof done for AC-08.1 (no `updateMany` → red), AC-08.4 (no linked-qty patch → red), AC-08.10 (no item rollback → red).
- e2e for the integrator: `apps/web-e2e/src/architecture.spec.ts` (3 journeys on a duplicate: 143.65 m² + 6/8 rooms + setbacks; BOQ-ELE-001 qty 1300 → 1400 moves MAT-ELE-001 and survives reload; overlap warning is shown and the room is still saved). **Not run in the block** (PROTOCOL §7).

## Gaps, CRs, deviations from CONTRACTS
- No CR. `{component, updatedItemIds}` lives in `features/architecture/local-types.ts` (not in shared types).
- 02's `overlayUnconfirmed` (refetch overlay) knows only `item/line/project/org` keys. A refetch of `['project', id]` in the ≤400 ms window before a `plan:`/`room:`/`boq:` save is confirmed shows the server value until the save lands (the save is still sent). Low risk: these tabs don't refetch on their own.
- SVG colours are inlined from the DESIGN-SYSTEM tokens (`drawing-colors.ts`) so the downloaded SVG looks the same outside the app.
- The UI allows 2 storeys (GF/UF); the API accepts `floor` 0 or 1 to match.
- Units are not converted when a BOQ qty is copied to linked rows (CONTRACTS §5); a "unit" warn badge marks a linked row with another unit.
- `architecture-test-utils.tsx` / `architecture-fixtures.ts` are test helpers inside the feature folder (02's `src/testing/` is not ours).
