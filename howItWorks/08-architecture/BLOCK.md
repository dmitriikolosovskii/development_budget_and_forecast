# 08 — "Architecture" tab: drawing, house sections, materials takeoff (BOQ)

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `08`). Start: `bash $BIN/bootstrap.sh 08` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 08` → `bash $BIN/merge-block.sh 08`.

**Wave:** W2 · **Priority:** STRETCH · **Estimate:** 75–90 min · **Worktree:** `Kairon-wt/08-architecture` (gate and base: `bin/blocks.conf`)
**In parallel:**
- **07 land** embeds your `SitePlan` read-only (see 07). Export `SitePlan({projectId})` from `features/architecture/site-plan.tsx` and describe it in HANDOFF early (stub first, then the drawing).
- **04 materials** runs at the same time as you (it starts on `w0-frozen` too). Your BOQ edits **change the quantities of the linked MATERIAL rows** (the API does it in one transaction). On the web, after the PATCH succeeds, update those rows in the cache (or patch them optimistically: same `boqComponentId` → new qtyMilli), and Materials/Profitability recalculate on their own.

## Goal
Route `/projects/:id/architecture`: the house project for a family of 4 that fits the plot. The owner asked for a **drawing**, the **standard sections of the house**, and an **editable description of the materials and quantities**.

## You own
`apps/api/src/architecture/**`, `apps/web/src/features/architecture/**` (`ArchitecturePage`, `SitePlan`), `apps/web-e2e/src/architecture.spec.ts`.

## Page content
1. **Project passport**: name, architect (OrgCell → modal), style, storeys, roof/pitch, energy standard, heating, occupants, gross floor area, **living area = Σ room areas** (computed), footprint.
2. **Floor plan (SVG)**: Ground floor / Upper floor switch.
   - Rooms are drawn from `Room` rectangles (cm → px with a scale), with labels "Living + dining 33.0 m²", a scale bar and a north arrow.
   - Hovering highlights the room; clicking opens room editing (name, kind, size).
   - Room colours by kind (soft tones from DESIGN-SYSTEM).
   - Overlap and boundary validation: a room outside the footprint or overlapping another is outlined in red, with a message.
   - "Download SVG" button.
3. **Site plan (SVG)**: the plot `plotWidthCm × plotDepthCm`, the house at `siteOffset*`, setback distances to the boundaries, the street side, and the allowed footprint per GRZ (from land) as hatching.
4. **House sections (HouseSection)**: an accordion/tabs over 10 sections (Site & foundation, Structure, Roof, Openings, Electrical, Plumbing, Heating & ventilation, Interior finishes, Facade & insulation, Exterior).
   - Each one has a short description of what goes into it (static English texts in `house-sections.ts`) and a **BOQ table**: Code · Component · Qty · Unit · Material section (link to Building materials) · Linked items (count) · Planned cost (Σ planned of the linked rows) · Notes.
   - Editable, autosaved, rows can be added or deleted.
5. **Totals**: planned cost per house section (bar chart) and the ARCHITECTURE category cost table (design/engineering/permits/insurance, HOAI stages LPH 1–9 as rows) + BudgetHealthPanel(ARCHITECTURE).

## API
`PATCH /projects/:id/plan`, CRUD `/plan/rooms`, CRUD `/plan/components`. When a component's `qtyMilli` changes → `prisma.$transaction`: update the component + `updateMany({ where: { boqComponentId }, data: { qtyMilli } })`; return `{component, updatedItemIds}`. Tests with Prisma mocked.

## Acceptance criteria
- AC-08.1 (Jest) PATCH component qty updates linked items in the same transaction (the mock checks that `$transaction` and `updateMany` were called with `boqComponentId`).
- AC-08.2 (Vitest) Living area = Σ room areas (143.65 m² on the GERMANY-DATA §2 fixture); changing a room's width changes the total.
- AC-08.3 (Vitest) Overlapping rooms → red outline and a message; no PATCH is blocked (it's a warning).
- AC-08.4 (Vitest) Editing BOQ quantity → the planned amount of the linked MATERIAL row and the MATERIALS KPI change (cross-tab through the cache).
- AC-08.5 (Vitest) The SVG renders 6 rooms for GF and 8 for UF with the right labels; the GF/UF switch works without losing edits.
- AC-08.6 (Vitest) SitePlan: the house sits inside the plot; a house that goes outside it → warn.
- AC-08.7 (Jest) A room or component id from another project (or missing) → 404, nothing is written.
- AC-08.10 (Vitest) A failed BOQ qty PATCH → the linked MATERIAL rows' qty and the KPI roll back, and a toast is shown.
