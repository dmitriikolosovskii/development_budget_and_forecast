<!-- paths: apps/api/src/architecture/**, apps/web/src/features/architecture/**, apps/web-e2e/src/architecture.spec.ts | Architecture tab: plan passport, floor plan, site plan, BOQ takeoff driving MATERIAL qty -->
# Architecture tab (as-built, block 08)

## What it does
`/projects/:projectId/architecture` shows the house project for a family of 4:
- **Passport** (`plan-passport.tsx`): style, storeys, roof, energy standard, heating, footprint, architect.
- **Floor plan** (`floor-plan.tsx:43` `FloorPlan`): SVG of rooms per floor (GF/UF switch), hover, click → `room-modal.tsx`; overlap / out-of-frame rooms get a red outline and a `role="alert"` message (`floor-plan.tsx:110`); scale bar, north arrow, "Download SVG" (`:104`).
- **Site plan** (`site-plan.tsx:50` `SitePlan({projectId, className?})`, read-only, also embedded by the Land tab): plot, street on the top edge, house at `siteOffset*`, dashed setbacks, a hatched buildable window 3 m from every boundary (`MIN_SETBACK_CM = 300`, `site-plan.tsx:10`, SächsBO §6), caption with the GRZ limit as a number; "House extends outside the plot" alert when a setback is negative (`site-plan.tsx:180`).
- **10 house sections** (`house-sections.ts`) each with an editable BOQ takeoff (`boq-section.tsx:129`, on 02's `EditableTable`).
- **Totals** (`architecture-totals.tsx`): planned cost per house section, the ARCHITECTURE cost table and `BudgetHealthPanel(ARCHITECTURE)`; `?highlight=<itemId>` from Search works because rows are rendered by `EditableTable`.
- `plan: null` → EmptyState + "Create plan" (PATCH upsert). Page: `architecture-page.tsx:61`.

## API — `apps/api/src/architecture/` (prefix `/api/projects/:projectId/plan`)
Controller `architecture.controller.ts:13`; service `architecture.service.ts`.
| Method & path | Behaviour |
|---|---|
| `PATCH /plan` (`:17`) | `updatePlan` (`service:56`): 404 without project, `architectOrgId` must exist (400), `upsert` by `projectId` with Stadtvilla `PLAN_DEFAULTS` |
| `POST /plan/rooms` (`:25`), `PATCH/DELETE /plan/rooms/:roomId` (`:33`, `:42`) | 404 without plan (`planIdOf`, `service:142`) or for a room of another project (`roomInProject`, `service:152`); duplicate `code` → 409 (`unique`, `service:177-182`) |
| `POST /plan/components` (`:50`), `PATCH /plan/components/:componentId` (`:58`), `DELETE` (`:67`) | same scoping (`componentInProject`, `service:163`); PATCH returns `{ component, updatedItemIds }` |

`updateComponent` (`service:103-131`): one interactive `$transaction` → `boqComponent.update`; with `qtyMilli` also `costItem.findMany` + `updateMany({where:{boqComponentId}, data:{qtyMilli}})` (`service:121`); without `qtyMilli` → `updatedItemIds: []`. DELETE of a component leaves linked items (schema `SetNull`).

DTO limits (`dto/*.ts`, `dto/validators.ts`): `wCm/hCm` 1..100000, `xCm/yCm` 0..100000, site offsets ±100000, `floor ∈ {0,1}`, `kind ∈ ROOM_KINDS`, `houseSection` enum, `unit ∈ UNITS`, `materialSection` = a MATERIALS slug or null, `qtyMilli` 0..2e9.

## Web — `apps/web/src/features/architecture/`
- Pure geometry `plan-geometry.ts`: `WALL_CM = 40` (`:14`), `innerFrame` = footprint − 2 × 40 cm (`:32`, 1000×900 → 920×820), `livingAreaCm2` (`:42`), `formatAreaM2` (`:46`, integer half-up), `overlaps` (`:55`, strict; touching edges are fine), `findRoomIssues` (`:76`, same floor only + out of frame), `siteSetbacks` (`:126`), `isHouseOnPlot` (`:135`), `allowedFootprintM2` (`:139`).
- Selectors `use-plan.ts`: `usePlan` (`:11`), `useComponentIds` (`:18`), `useComponent` (`:32`), `useBoqLink` (`:58`, `{count, plannedCents, unitMismatch}`), `useSectionCosts` (`:73`).
- Edits `use-plan-edits.ts`, autosave keys `plan:<pid>`, `room:<roomId>`, `boq:<componentId>` (`:37-40`): `useEditPlan` (`:48`), `useCreatePlan` (`:69`), `useEditRoom` (`:82`), `useCreateRoom` (`:105`), `useDeleteRoom` (`:122`), `useEditComponent` (`:163`), `useCreateComponent` (`:222`), `useDeleteComponent` (`:241`).
- Cache reducers `plan-cache.ts` (`applyPlanPatch` writes plan scalars only, so a plan rollback never reverts room edits).
- `local-types.ts:5` `componentUpdateResultSchema` (`{component, updatedItemIds}`; not in shared types).
- `drawing-colors.ts`: DESIGN-SYSTEM tokens inlined so the downloaded SVG looks the same outside the app.

## Cross-tab invariant: BOQ qty → MATERIAL rows
- `useEditComponent(pid)(id, {qtyMilli})` patches the component **and every cached item with that `boqComponentId`** through 02's `applyItemsPatch` (`use-plan-edits.ts:152`), so Materials rows, the KPI strip and Profitability move at once.
- A baseline is captured at the first enqueue per `boq:` key; a linked item with its own pending `item:<id>` qty edit keeps it.
- On failure only linked `qtyMilli` is rolled back, and only on items still holding the optimistic value (`use-plan-edits.ts:213`), plus a toast.
- Every linked item gets the full component qty, regardless of status or unit (CONTRACTS §5); a "unit" warn badge marks a mismatch (`use-plan.ts:53`), no conversion.

## Tests
| AC | Where |
|---|---|
| 08.1, 08.7 | `apps/api/src/architecture/architecture.service.spec.ts` (+ `dto/architecture-dto.spec.ts` for 400s) |
| 08.2, 08.3 | `plan-geometry.spec.ts`, `architecture-page.spec.tsx`, `floor-plan.spec.tsx` |
| 08.4, 08.10 | `boq-section.spec.tsx` |
| 08.5 | `floor-plan.spec.tsx` (6 GF / 8 UF rooms, edit survives GF→UF→GF) |
| 08.6 | `site-plan.spec.tsx` (setbacks 8.0/8.0/4.0/7.0 m) |
| e2e | `apps/web-e2e/src/architecture.spec.ts`: 143.65 m² + rooms + setbacks; BOQ-ELE-001 qty → MAT-ELE-001 moves and survives reload; overlap warning, room still saved |

## Decisions / deviations
- No CR. The buildable window is drawn at 3 m from every boundary; the GRZ limit has no position, so it is shown as a number (`allowed footprint N m²`).
- Room create, room delete-restore and add-component wait for the server (no temporary row); delete is optimistic with restore on failure.
- Overlaps are a UI warning only; the API does not validate them.
- UI allows 2 storeys (GF/UF), matching `floor ∈ {0,1}`.
- No drag-and-drop, rotation, polygons or wall thickness; BOQ scaling by living area is the wizard's job (12).

## Known gaps
- 02's `overlayUnconfirmed` only knows `item/line/project/org` keys: a refetch of `['project', id]` within the ≤400 ms window before a `plan:`/`room:`/`boq:` save is confirmed shows the server value until the save lands. Low risk: these tabs do not refetch on their own.
