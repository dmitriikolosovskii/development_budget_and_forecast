<!-- paths: apps/api/src/project-wizard/**, apps/web/src/features/project-wizard/**, apps/web-e2e/src/wizard.spec.ts | calculate-project wizard (block 12) -->
# Calculate project (wizard)

`/projects/new` is a 5-step wizard (Basics · Land · House · Budget · Review). It scales the seeded template
`template-efh-144` by living area, shows a live estimate per category, and creates the project with
`POST /api/projects/wizard` in one create-only transaction. On success it opens `/projects/<id>/land`; the new project
works on every tab 04–09.

## Key files
API (`apps/api/src/project-wizard/`):
- `project-wizard.controller.ts:8` — `@Controller('projects/wizard')`: `GET template` (`:12`), `POST` (`:17`).
  `ProjectWizardModule` is registered before `ProjectsModule` (`apps/api/src/app/app.module.ts:24`), so these routes
  win over `/projects/:id`. A bare `GET /projects/wizard` does not exist.
- `project-wizard.service.ts:51` — `template()`: loads the template by `TEMPLATE_SLUG`, 404 "run the seed" if missing,
  returns 01's `ProjectsService.getSnapshot`.
- `project-wizard.service.ts:64` — `create()`: duplicate utility type → 400 (`:66`); plan; one `$transaction` of
  `create`/`createMany` in FK order (`:88`–`:101`); slug unique violation → retry up to 3 times, then 409 (`:103`).
- `wizard-plan.ts:192` — `buildWizardProject(template, input, {newId, slug, code})`: pure planner returning
  create-only payloads with fresh `randomUUID()` ids and every link remapped. Imports `scaleQty`, `shiftDate`,
  `scalePlan` from 03's `../seed-data/derive` (`:24`), not copies.
- `wizard-plan.ts:100` `areaFactor` (exact fraction `livingAreaM2 / 144`), `:166` `defaultApproved`,
  `:181` `assertInRange` (Int32 cap → `WizardRangeError` → 400).
- `distribute.ts:6` — exact split of a category amount over its lines by weight.
- `transfer-tax.ts:21` — `transferTaxBps(state)`, default 500 bps (`:19`).
- `dto/wizard-input.dto.ts:29` — nested class-validator DTO; living area 100–250 m².

Web (`apps/web/src/features/project-wizard/`):
- `project-wizard-page.tsx:39` — one react-hook-form with zod; `<h1>Calculate project</h1>` renders synchronously
  (`:122`); "Next" runs `trigger(STEP_FIELDS[step])` (`:86`); the button reads "Creating…" while pending (`:189`).
- `project-wizard-page.tsx:74` — approved amounts follow the estimate until the user edits that category.
- `estimate-budget.ts:78` — `estimateBudget(input, template)`: the client mirror of the server planner.
- `use-wizard.ts:8` — private key `['project-wizard','template']` (CR-12); `useCreateFromWizard` (`:21`) invalidates
  `['projects']`, `['analytics']`, `['search']`, then navigates to `/projects/<id>/land`.
- `wizard-form.ts:17` (schema, defaults, `STEP_FIELDS` `:33`), `wizard-fields.tsx` (`ScaledInput`: €/%/ratio as
  integers parsed from strings), `wizard-steps.tsx` (5 steps; `BudgetStep` `:383`, Review donut `:533`).

## Rules (as built)
- **Scaling** by `f = livingAreaM2 / 144`: MATERIALS/CONSTRUCTION `qtyMilli` half-up **only for continuous units**
  (m3 m2 m t kg h); `pcs`/`set`/`lump` stay (one heat pump stays one). BOQ uses the same rule, so a material's qty
  still equals its linked BOQ qty. HOAI `ARCHITECTURE/design` scales `unitPriceCents × f`. Rooms and footprint × √f;
  the site offset is clamped so the house stays on the plot.
- **Land** comes only from step 2: `SRV-PUR-001` = area × price; `SRV-ACQ-001/002/003` = transfer tax by state /
  notary 1.5 % / registry 0.5 % of the purchase, half-up. Plot sides = template × √(area / template area);
  `lat = lng = 0` (07 treats it as "location unknown"); `zoningPlan`, `roofRules`, `soilType` = "To be confirmed";
  utilities exactly from step 2.
- **Rows**: codes unchanged; every row PLANNED, committed = actual = 0, `deliveredDate` null; no deliveries and no
  import batches. Every date (items, project start/end) is shifted by `startDate − template.startDate`, so the copy has
  no schedule conflicts.
- **Default approved per line**: LAND = new planned; MATERIALS, CONSTRUCTION and `design` =
  max(template approved × f, planned); others = max(template approved, planned); the empty contingency line keeps
  template approved × f. The client default per category is the sum of these weights, so a fresh project has
  **no overrun lines** (AC-12.8).
- **User amounts** (`approvedByCategory`, optional): split over the category's lines by those weights; shares are
  floored and the leftover cents go to the largest weight (first on a tie); all-zero weights → first line. Σ is exact.
- **Project**: `slug` = name with äöüß transliterated + 6 hex chars (e.g. `haus-mueller-1fdf7d`); `code` =
  `KF-<year>-W<HEX>`; status PLANNING; `isTemplate` false.
- House options (storeys, EH55/EH40, heating, wall type) are **descriptive only** (owner decision): stored on the plan
  (wall type in `notes`); storeys = 1 keeps the template's 14 rooms.

## Invariants
- The template is only read; the transaction contains no update or delete (AC-12.3).
- Every `budgetLineId`, `requiredForWorkId`, `boqComponentId` points into the new id set, never at a template id (AC-12.2).
- Errors are 400, never 500: validation, living area outside 100–250, missing category, duplicate utility type, any
  amount or Σ approved > 2,000,000,000 (AC-12.9). Missing template → 404 and nothing written.
- Client estimate = server default to the cent (checked on the real template: 180 m², Bayern, 600 m² × €300).

## Decisions and deviations from CONTRACTS
- CR-12 (applied by 00): `GET /projects/wizard/template` and the continuous-unit rule are in CONTRACTS §5; the
  template query key is feature-private (§6).
- BLOCK.md said "qtyMilli × factor" for every row and rough budget formulas (architecture 13.6 %, marketing ≈ 3 %);
  both were replaced by the template-derived rules above.
- The rules are duplicated api ↔ web (`wizard-plan.ts` ↔ `estimate-budget.ts`, `transfer-tax.ts` × 2) because only
  frozen libs are shared; each copy names the other, and both sides assert the same 180 m² example.

## Tests
- API: `distribute.spec.ts` (AC-12.1), `wizard-plan.spec.ts` (AC-12.2, 12.7, 12.8), `project-wizard.service.spec.ts`
  (AC-12.3, 12.9); fixtures build the real template via 03's `toSnapshot(buildTemplateSeed())`.
- Web: `project-wizard-page.spec.tsx` (AC-12.4, 12.5), `estimate-budget.spec.ts`.
- e2e: `apps/web-e2e/src/wizard.spec.ts:7` [AC-12.6] create → listed → Materials tab has rows.

## Known gaps
- No server-side idempotency: a double click is prevented only by the disabled button.
- No cost multipliers for house options, no bungalow plan for 1 storey, no geocoding.
