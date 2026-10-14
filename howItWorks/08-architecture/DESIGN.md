# DESIGN — 08 Architecture tab (block mode /brainstorm, 2026-10-14)

## Goal / Non-goals
**Goal:** `/projects/:id/architecture` shows the house project for a family of 4: passport, SVG floor plan (GF/UF, editable rooms, overlap/bounds warnings, SVG download), the site plan (`SitePlan`, also embedded by 07), 10 house sections with an editable BOQ takeoff that drives the linked MATERIAL rows, and totals (planned cost per house section, ARCHITECTURE cost table, `BudgetHealthPanel(ARCHITECTURE)`).
**Non-goals:** drag-and-drop room editing, room rotation or polygons, interior wall thickness, server-side overlap validation, scaling BOQ to living area (that is 12 wizard), remapping links in `/duplicate` (that is 01), linking or unlinking MATERIAL rows to components from this tab.

## Chosen approach: A
- **API** `apps/api/src/architecture/`: `ArchitectureService` + controller + `dto/` + specs. `PrismaService` is injected (PrismaModule is `@Global`; the module does not import it, and `app.module.ts` is not touched).
  - `PATCH /projects/:id/plan`: 404 if there is no project; `upsert` by `projectId` with Stadtvilla defaults (GERMANY-DATA §2) for every required field.
  - `POST|PATCH|DELETE /projects/:id/plan/rooms[/:roomId]` and `/plan/components[/:componentId]`. Every lookup is scoped `where: {id, plan: {projectId}}` → 404 otherwise. P2002 (duplicate `code`) → 409.
  - Component PATCH with `qtyMilli`: `prisma.$transaction(async tx => { update component; findMany linked ids; updateMany({where:{boqComponentId}, data:{qtyMilli}}) })` → `{ component, updatedItemIds }`. Without `qtyMilli`: no `updateMany`, `updatedItemIds: []`.
- **Web** `apps/web/src/features/architecture/`:
  - `plan-geometry.ts` (pure): `roomAreaM2x100`, `livingArea`, `innerFrame(plan) = footprint − 2 × WALL_CM (40)` (gives exactly 920 × 820 for 1000 × 900, GERMANY-DATA §2), `findRoomIssues` (strict-`<` overlap only within the same floor; out-of-frame), `siteSetbacks`, `isHouseOnPlot`.
  - `floor-plan.tsx` (SVG, GF/UF switch, hover, click → `room-modal.tsx`, red outline + `role="alert"` message, scale bar, north arrow, "Download SVG"); `site-plan.tsx` (`SitePlan({projectId, className?})`, read-only); `plan-passport.tsx`; `house-sections.ts` (static texts); `boq-section.tsx` (EditableTable); `architecture-totals.tsx` (bar chart + ARCHITECTURE table on EditableTable, so `?highlight=<itemId>` from 13 works); `architecture-page.tsx` (replaces the placeholder body, same export).
  - Hooks: `use-edit-plan.ts`, `use-edit-room.ts`, `use-edit-component.ts` (+ create/delete). Keys: `plan:<projectId>`, `room:<roomId>`, `boq:<componentId>`. Response/input types live in `local-types.ts`.

**Why not the others:** B (a PATCH per linked item through `useEditItem`) can't do it in one transaction, risks half-written state, and collides with 04's `item:` keys. C (no optimistic update, refetch afterwards) breaks CONTRACTS §6 (optimistic edits) and AC-08.4's instant recalculation, and a refetch can overwrite other rows' pending edits.

## Judge constraints (mandatory)
1. Ownership scoping on every nested id → 404; project existence is checked before the plan upsert (no P2003 500).
2. Autosave key per component: `boq:<componentId>`.
3. Interactive `$transaction(async tx)`; every linked item gets the same qty (CONTRACTS §5, no filtering by status or unit). If the units differ, the UI shows a non-blocking hint.
4. Optimistic and onSuccess writes change **only `qtyMilli`** of the linked items. A baseline is captured at the first enqueue per component. Rollback restores `qtyMilli` only on items that still hold the optimistic value. A toast is shown.
5. Cache writes go through 02's cache helper or index builder (never a hand-written `items[]` edit). Fallback: `invalidateQueries(['project', id])`. A note has been sent to 02.
6. DTO: `wCm/hCm` `@Min(1) @Max(100000)`, `xCm/yCm` `@Min(0) @Max(100000)`, `floor ∈ {0,1}`, `kind` from the 10 kinds, `houseSection` enum, `unit` from §1, `materialSection` = a MATERIALS slug or null, `qtyMilli` `@Min(0) @Max(2e9)`.
7. Deleting a component → in the cache, the linked items get `boqComponentId = null` (SetNull).
8. Overlap is strict and same-floor only; it is a warning, the PATCH is still sent.
9. Inner frame = footprint − 2 × 40 cm (named constant).
10. No files outside the 08 globs; `plan: null` → EmptyState + a "Create plan" action (PATCH upsert); the `SitePlan` signature is frozen (HANDOFF).
11. Tests: reset the autosaveQueue between tests, use fake timers. Fixture: 14 rooms (6 GF + 8 UF), 143.65 m², labels to 1 decimal, setbacks 8.0/8.0/4.0/7.0 m.

## Affected files (all owned by 08)
`apps/api/src/architecture/{architecture.module,architecture.controller,architecture.service}.ts`, `dto/*.ts`, `*.spec.ts`;
`apps/web/src/features/architecture/*`; `apps/web-e2e/src/architecture.spec.ts`.

## Risks
- **Medium:** cross-tab cache interplay with 04 (both edit linked rows at the same time). Mitigated by constraints 4 and 5.
- 02's helpers may not have the expected names. Adapt to the real exports at implementation time; fall back to invalidate.
- The seed (03) may not link components → AC-08.4 is tested on fixtures; e2e needs `03.merged`.

## Test strategy (AC registry in BLOCK.md)
| AC | Level · file |
|---|---|
| AC-08.1 qty PATCH → `$transaction` + `updateMany({where:{boqComponentId}})` → `{component, updatedItemIds}`; without qty no `updateMany` | Jest · `architecture.service.spec.ts` |
| AC-08.2 Σ rooms 143.65 m²; GF-LIV w 560→600 → 146.01 | Vitest · `plan-geometry.spec.ts`, `architecture-page.spec.tsx` |
| AC-08.3 overlap/out of frame → red outline + message; PATCH still sent; touching edges are OK | Vitest · `plan-geometry.spec.ts`, `floor-plan.spec.tsx` |
| AC-08.4 BOQ qty edit → linked MATERIAL planned + MATERIALS KPI change | Vitest · `boq-section.spec.tsx` |
| AC-08.5 GF 6 rooms / UF 8 rooms with labels; an edit survives GF→UF→GF | Vitest · `floor-plan.spec.tsx` |
| AC-08.6 SitePlan: seed inside, setbacks 8.0/8.0/4.0/7.0 m; outside → warning | Vitest · `site-plan.spec.tsx` |
| AC-08.7 a foreign room/component id → 404, no write | Jest · `architecture.service.spec.ts` |
| AC-08.10 a failed qty PATCH → linked qty + KPI roll back, toast | Vitest · `boq-section.spec.tsx` |
Plus untagged unit tests: DTO 400s, plan upsert, P2002 → 409. e2e `architecture.spec.ts` (run by the integrator): duplicate → plan visible, 143.65 m², UF 8 rooms; BOQ qty edit → Materials row qty changed.

## How to verify
`bash $BIN/check.sh 08` → `CHECK: PASS`; `bash $BIN/ac-ledger.sh --block 08`.

## Open questions
None new. Settled by CONTRACTS: every linked item gets the full component qty (§5); DONE rows are harmless (forecast = actual, §3); units are not converted (hint only).

## As built (2026-10-14, after implementation)
- Everything above was implemented without a CR; the details of what was built are in HANDOFF.md.
- Deviations from this design:
  - The buildable window on the site plan is hatched at 3 m from every boundary (SächsBO §6). Beside it the caption shows the GRZ limit as a number (`allowed footprint 208 m²`). A GRZ area has no position on the plot, so it can't be drawn.
  - The room create, delete and add-component actions wait for the server instead of showing a temporary row first. Delete is still optimistic, with restore on failure.
  - The UI allows 2 storeys (GF/UF), matching the DTO's `floor ∈ {0,1}`.
- Tests: Jest 2 files (service, DTO); Vitest 5 files; AC ledger OK = 8. e2e `architecture.spec.ts` is written, but runs only in the integrator's main tree.
- Known gap: see HANDOFF ("refetch overlay" for the `plan:/room:/boq:` keys).
