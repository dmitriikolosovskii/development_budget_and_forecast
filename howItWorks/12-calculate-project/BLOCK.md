# 12 — "Calculate project": wizard to create a project

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `12`). Start: `bash $BIN/bootstrap.sh 12` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 12` → `bash $BIN/merge-block.sh 12`.

**Wave:** W3 · **Priority:** STRETCH · **Estimate:** 75 min · **Worktree:** `Kairon-wt/12-calculate-project` (gate and base: `bin/blocks.conf`)
**Gate:** `03.merged` (you need the `template-efh-144` template in main). **In parallel:** 13 search and the W1/W2 blocks still in progress, with no overlap. You create projects with **every section** that the "Current projects" tabs have (land, plan, BOQ, lines, rows). The tabs from 04–09 must open your project without errors, so test it on the result of `POST /projects/wizard`.
**The integrator's e2e** uses your endpoint to create isolated test projects. Keep it stable.

## Goal
Route `/projects/new`: a step-by-step calculation of a new project from the template `template-efh-144` (seed 03). Scale it by area and parameters, show a live estimate, create the project, then go to it.

## You own
`apps/api/src/project-wizard/**` (`POST /projects/wizard`), `apps/web/src/features/project-wizard/**` (`ProjectWizardPage`), `apps/web-e2e/src/wizard.spec.ts`.

## Steps of the wizard (react-hook-form + zod `WizardInput` from `@default-project/types`)
1. **Basics**: name, client, city, start date, markup (default 15 %).
2. **Land**: address, municipality, state, area m², land value per m², GRZ/GFZ, soil class, groundwater, utilities (statuses). Real-estate transfer tax (Grunderwerbsteuer) by state: a hint table (Saxony 5.5 %, Bavaria 3.5 %, NRW 6.5 %, Berlin 6.0 %, Brandenburg 6.5 %, Hesse 6.0 %, Baden-Württemberg 5.0 %, other → 5.0 % (est.)).
3. **House**: living area m² (100–250), storeys (1–2), energy standard (EH55/EH40), heating (heat pump / gas hybrid), wall type (sand-lime + ETICS / monolithic brick).
4. **Budget**: an auto-estimate by category (on the client: a pure function `estimateBudget(input, template)` in your folder). Land = area × price + notary + land registry 2 % + transfer tax by state + utilities. Architecture = HOAI % of construction (est. 13.6 % of KG 300+400). Materials and construction = template × (livingArea/144). Contingency 10 %. Marketing ≈ 3 % of the price. The user can adjust the approved amount for each category.
5. **Review**: summary, contract price, planned profit, a donut chart of the structure. "Create project".

## API `POST /projects/wizard`
- In one `$transaction`:
  - create the Project (unique `slug` from name + suffix);
  - copy the template's BudgetLines (approved values distributed across lines in proportion to the template within each category, with the remainder in cents going to the largest line: **Σ exact**);
  - copy the CostItems, `qtyMilli` × area factor (round half-up), with codes unchanged, links `requiredForWorkId`/`boqComponentId` remapped to the new ids, everything PLANNED with committed/actual = 0, dates shifted by (startDate − template start);
  - copy the LandParcel and utilities from step 2;
  - copy the plan, rooms (scale their sizes by √factor) and BOQ (× factor).
- Response `ProjectSnapshot`. Protect against a double click: the button is disabled while the mutation runs. Server-side idempotency is out of the MVP (record it in HANDOFF; the integrator adds it to SOLUTION.md).

## Acceptance criteria
- AC-12.1 (Jest) Distributing the approved amount across lines: Σ lines = the category amount exactly to the cent (e.g. 100,000.01 € over 3 lines).
- AC-12.2 (Jest) Area 180 m² against the 144 template → factor 1.25: qty is scaled with half-up rounding; links between new rows point to new ids (never to the template's).
- AC-12.3 (Jest) The template is unchanged after creation (the mock checks there is no update/delete on template ids).
- AC-12.4 (Vitest) Step 4 recalculates the estimate when the area changes on step 3; invalid steps block "Next" with messages.
- AC-12.5 (Vitest) After success → navigate to `/projects/<newId>/land` and invalidate `['projects']`.
- AC-12.6 (e2e, integrator) Create a project → it appears in Current projects → the Materials tab opens with rows.
- AC-12.7 (Jest) Land parcel, utilities and land rows come from step 2, never from the template (lat/lng 0, no template B-Plan); item dates are shifted by (startDate − template start).
- AC-12.8 (Jest) With the default amounts the new project has 0 overrun lines; with user amounts Σ approved per category = `approvedByCategory` exactly.
- AC-12.9 (Jest) Template missing → 404 and nothing is written; duplicate utility types or amounts beyond Int32 → 400.

> Scaling note (DESIGN.md, judge constraint 3): only continuous units (m3, m2, m, t, kg, h) are scaled by the area factor, as in 03's `derive.ts`. Counted rows (pcs/set/lump) stay as they are.
