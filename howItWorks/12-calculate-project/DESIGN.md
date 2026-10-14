# DESIGN — 12 Calculate project (wizard)

Date: 2026-10-14 · Brainstorm in "block" mode (PARALLEL-RUN §3) · Verdict: **approach A, risk medium**.

## Goal
`/projects/new`: a 5-step wizard (Basics · Land · House · Budget · Review) that calculates a new project from the template `template-efh-144` (seed 03). It scales the template by living area, shows a live estimate, then creates the project with `POST /api/projects/wizard` in one transaction and opens `/projects/<id>/land`. Every tab from 04–09 must open the new project.

## Non-goals
- House options (storeys, EH55/EH40, heating, wall type) **do not change cost**. **Owner decision 2026-10-14: descriptive only.** They are stored on the plan; cost scales only by `livingAreaM2 / 144`.
- No server-side idempotency (double click is handled by disabling the button); no geocoding; no bungalow plan for 1 storey; no editing of individual lines in the wizard (only per-category approved amounts).

## Chosen approach (A) and why not the others
**A.** A pure planner `buildWizardProject(template: ProjectSnapshot, input: WizardInput, newId)` returns create-only payloads with pre-generated `randomUUID()` ids (01's `ProjectCopyService` uses the same scheme) and every link remapped. `ProjectWizardService` loads the template by slug and writes the payloads with `createMany` in one `$transaction`, in FK order. It never updates or deletes anything.
- **B rejected.** Reusing 01's `deepCopy` and then patching means about 200 UPDATEs. `deepCopy` has no hook for scaling and also copies deliveries and import batches. AC-12.3 is harder to prove, and the plan depends on unmerged 01 internals.
- **C rejected.** Sequential nested creates with a code→id map cost about 400 queries inside one SQLite write lock, plus a second pass for links. It has no benefit over A.

## Rules (as implemented)
- **Factor** `f = livingAreaM2 / 144`, kept as an exact fraction. **The scaling rule is 03's (`seed-data/derive.ts`, imported, not copied):**
  - MATERIALS/CONSTRUCTION `qtyMilli` is scaled half-up **only for continuous units** (m3, m2, m, t, kg, h). Counted things (pcs, set, lump) stay as they are: one heat pump is still one heat pump. **This deviates from BLOCK's wording "qtyMilli × factor".** BOQ uses the same rule, because 08 syncs BOQ qty into the linked item.
  - HOAI `ARCHITECTURE/design` scales `unitPriceCents × f`.
- **Land rows are recomputed from step 2:**

  | Row | Value |
  |---|---|
  | `SRV-PUR-001` | area × price |
  | `SRV-ACQ-001` | transfer tax by state |
  | `SRV-ACQ-002` | notary 1.5 % |
  | `SRV-ACQ-003` | land registry 0.5 % |

  All of them are percent of the purchase, rounded half-up. `site-development` and `surveys` are copied as they are.
- **Transfer tax by state (bps):**

  | State | Rate |
  |---|---|
  | Sachsen | 550 |
  | Bayern | 350 |
  | Nordrhein-Westfalen | 650 |
  | Berlin | 600 |
  | Brandenburg | 650 |
  | Hessen | 600 |
  | Baden-Württemberg | 500 |
  | other | 500 (est.) |

  English names are accepted as aliases. It is one table per side (api and web), used both for the hint and for the row.
- **Dates:** every item date, plus project start and end, is shifted by `daysBetween(template.startDate, input.startDate)`. The template has no schedule conflicts, so neither does the copy.
- **Rows:** every row is PLANNED, with committed = actual = 0, `deliveredDate` null. No deliveries and no import batches are copied. Codes are unchanged.
- **Default approved per line** (the "weights"):
  - LAND: the line's new planned amount.
  - MATERIALS, CONSTRUCTION and `design`: max(template approved × f half-up, new planned).
  - Other lines: max(template approved, new planned).
  - The **contingency line** has no rows, so its template approved × f stays in CONSTRUCTION.
  - The client's default per category is the **sum of these weights**, so a fresh project starts with **no overrun lines**.
  - BLOCK's rough formulas (architecture 13.6 %, marketing ≈ 3 %) are not used. The template-derived numbers are the same estimate, made consistent.
- **User amounts** (`approvedByCategory`): each category amount is distributed over that category's lines in proportion to the weights (largest remainder; the leftover cents go to the largest line, ties to the first by sortOrder). If every weight is 0, everything goes to the first line. **Σ is exact.**
- **Land parcel** comes only from step 2:
  - The plot sides are the template sides × √(area / template area).
  - `lat = lng = 0`: 07 treats that as "location unknown" and hides the map link.
  - `zoningPlan`, `roofRules` and `soilType` are set to "To be confirmed".
  - The nullable fields are null.
  - Utilities come from step 2, and duplicate types → 400.
- **Plan:**
  - 03's `scalePlan` (rooms and footprint × √f, edge-scaled).
  - The site offset is clamped to `[0, plot − footprint]`.
  - `storeys` comes from the input; the rooms are kept even when storeys = 1 (descriptive only).
  - `energyStandard` and `heatingSystem` are stored as text, and the wall type goes into `notes`.
  - Name `EFH '<name>' — <area> m²`.
- **Project:**
  - `slug` = slugified name (äöüß transliterated) + 6 random hex characters. It is retried on a unique violation up to 3 times, then 409.
  - `code` = `KF-<start year>-W<hex>`, status PLANNING, `isTemplate` false.
- **Validation → 400, never 500:**
  - class-validator DTO (nested), `livingAreaM2` 100–250, `storeys` 1|2, all 5 categories when `approvedByCategory` is present;
  - after planning, every money/qty field and the project's Σ approved ≤ 2,000,000,000, otherwise 400 "amounts exceed the supported range".
- **Endpoints** (own controller):
  - `POST /api/projects/wizard` → `ProjectSnapshot` (201);
  - **new** `GET /api/projects/wizard/template` → the template `ProjectSnapshot` (the client estimates from it); 404 if the template is missing (CR-12-wizard-template-route).
  - Never a bare `GET /projects/wizard` (it would be captured by `/projects/:id`).

## Web
- `ProjectWizardPage` renders `<h1>Calculate project</h1>` **synchronously**, outside the loading and error states (02's AC-02.16 renders the route with only `/health` mocked).
- **Form and steps:**
  - One react-hook-form with `zodResolver` built from the shared `wizardInputSchema`, plus web limits (living area 100–250).
  - "Next" calls `trigger(<step fields>)`, so an invalid step shows messages and stays put.
  - Steps are in local state, not in the URL.
- **Estimate:**
  - `estimate-budget.ts` (pure) computes, from the template snapshot and the input, the per-category defaults and per-line weights (the same rules as the server, a deliberate small duplication: api and web can't share code outside the frozen libs), plus land details (purchase, tax, notary/registry).
  - Step 4 shows the estimate and an "Approved" money input per category. It is pre-filled with the estimate and re-synced from the estimate when the area or the land changes, until the user edits that category.
  - Review shows the summary, Σ approved, contract price, planned profit (`computeProfitability`) and a donut (recharts, `CATEGORY_COLORS`). The donut is the first cut if time runs out: a table instead.
- **Data:**
  - `useWizardTemplate()` uses the local key `['project-wizard','template']` (`// TODO CR-12`; it is not in `query-keys.ts`).
  - `useCreateFromWizard()` is a `useMutation`. On success it invalidates `['projects']`, `['analytics']` and `['search']`, then navigates to `/projects/<id>/land`. It does not seed `['project', id]`. "Create project" is disabled while pending.

## Judge constraints (mandatory)
1. Pure planner and create-only transaction, in FK order: project → lines → land → utilities → plan → rooms → BOQ → items without links → linked items. 01's chained-link handling is not needed: the template has only MATERIAL→WORK links, checked by test.
2. Import `scaleQty`, `shiftDate`, `scalePlan` and `TEMPLATE_SLUG` from `../seed-data`.
3. The continuous-unit rule for items and BOQ; the deviation is recorded here and in HANDOFF.
4. Largest-remainder split with an exact Σ; client defaults = Σ server weights.
5. 400, never 500: Int32 caps, duplicate utility types, missing categories, living area 100–250.
6. New land comes only from step 2; the plot is scaled; the plan is scaled and clamped.
7. House options are descriptive only; storeys=1 keeps the rooms.
8. No frozen files are touched (`app.module.ts`, `query-keys.ts`, `libs/shared/types`).
9. The extra GET goes in the own controller, with a CR; it is never a bare `GET /projects/wizard`.
10. The web h1 is synchronous; all 5 categories are sent; the button is disabled while pending; invalidations and navigation as above.
11. No deliveries or import batches are copied; everything is PLANNED with 0 money.

## Affected files (all owned by 12)
- `apps/api/src/project-wizard/`:
  - `project-wizard.module.ts` and `project-wizard.controller.ts` (fill 01's stubs);
  - `project-wizard.service.ts`;
  - `wizard-plan.ts` (pure builder), `distribute.ts`, `transfer-tax.ts`;
  - `dto/wizard-input.dto.ts`;
  - specs.
- `apps/web/src/features/project-wizard/`:
  - `project-wizard-page.tsx` (the body is replaced, the export kept);
  - `wizard-steps.tsx`, `estimate-budget.ts`, `transfer-tax.ts`;
  - `use-wizard-template.ts`, `use-create-from-wizard.ts`;
  - specs.
- `apps/web-e2e/src/wizard.spec.ts`.
- Docs (main tree): `howItWorks/12-calculate-project/{DESIGN,HANDOFF,BLOCK}.md`, `shared/change-requests/CR-12-wizard-template-route.md`.

## Risks
- The work depends on 01 (projects module, the `prisma-errors` helper, stub registration) and on 03 (helpers, template), neither merged yet. After `03.merged` the bootstrap branches from main, so the shapes are checked then.
- The rules are duplicated between api and web. Mitigation: the same numeric example (180 m², template fixture) is asserted on both sides.
- Time: the block is a 75 min STRETCH. Cut order: donut → offset clamp beyond min/max → the e2e beyond AC-12.6.

## Test strategy (tags `[AC-12.N]`)
- AC-12.1 (Jest) `distribute.spec.ts`: 10,000,001 ¢ over weights [1,1,1] → Σ exact, the extra cent on the first largest line; plus a test that a category with zero weights → all on the first line.
- AC-12.2 (Jest) `wizard-plan.spec.ts`, using a template fixture built from 03's `toSnapshot`:
  - 180 m² → f = 1.25, an m³ qty rounded half-up, a pcs row unchanged;
  - every `requiredForWorkId`/`boqComponentId`/`budgetLineId` is in the new id set and none is a template id.
- AC-12.3 (Jest) `project-wizard.service.spec.ts`, Prisma mocked: one `$transaction`, only `create`/`createMany`, no update or delete on any model; the template object is deep-equal to a clone taken before.
- AC-12.4 (Vitest) The page: step 3 area 144 → 180 changes the step 4 MATERIALS estimate by × 1.25 (± the counted rows); an empty name blocks "Next" with a message.
- AC-12.5 (Vitest) A mocked POST → navigates to `/projects/p9/land` and invalidates `['projects']`; "Create project" is disabled while pending.
- AC-12.6 (e2e, integrator) `wizard.spec.ts`: create → in Current projects → the Materials tab has rows.
- **AC-12.7 (Jest, new)** The land parcel, the utilities and the land rows come from step 2, never from the template (lat/lng 0, Taucha's B-Plan not copied); item dates are shifted by (start − template start).
- **AC-12.8 (Jest, new)** With default amounts (the client's estimate), the new project has 0 overrun lines; with user amounts, Σ approved per category = `approvedByCategory` exactly.
- **AC-12.9 (Jest, new)** Template missing → 404 and nothing written; duplicate utility types or amounts above Int32 → 400.

## How to verify
`bash $BIN/check.sh 12` (exit 0) and `bash $BIN/ac-ledger.sh --block 12` (12.1–12.5, 12.7–12.9 OK; 12.6 UNRUN until the integrator runs e2e).

## Open questions
None blocking. House-option cost multipliers and server idempotency go to SOLUTION.md "next steps".

## As built (2026-10-14)
- Commits: `2e6037b` (API), `87c388e` (web + e2e). `check.sh 12` PASS; ledger OK 8, UNRUN 1 (AC-12.6 e2e).
- **Changes from the plan above:**
  - The web hooks live in one file, `use-wizard.ts` (`useWizardTemplate`, `useCreateFromWizard`).
  - The form pieces are split into `wizard-form.ts` (schema, defaults, step fields), `wizard-fields.tsx` (`Field`, `ScaledInput`: €/%/ratio as integers, parsed from strings) and `wizard-steps.tsx` (the five steps).
  - The test fixtures (`wizard-fixtures.ts`) build the real template through 03's `toSnapshot(buildTemplateSeed())`.
  - Ids are `randomUUID()`, like 01's `ProjectCopyService`.
  - The response is built by 01's `ProjectsService.getSnapshot` (`ProjectWizardModule` imports `ProjectsModule`).
  - The private query key has no `TODO`: CR-12 was applied.
- **Bugs found and fixed during implementation (each guarded by a test):**
  1. The slug lost umlauts (`haus-muller`): NFKD ran before the transliteration. Fixed, so it is now `haus-mueller`.
  2. react-hook-form `setValueAs` also receives the numeric defaults, which crashed `v.trim()`. The parsers now accept numbers.
- **Verified on real data:** the client estimate equals the server's default approved per category to the cent (real template, 180 m², Bayern, 600 m² × 300 €):

  | Category | Amount |
  |---|---|
  | LAND | 204,400.00 € |
  | ARCHITECTURE | 59,276.25 € |
  | MATERIALS | 184,449.69 € |
  | CONSTRUCTION | 249,856.25 € |
  | MARKETING | 20,000.00 € |

  The created project had no overrun.
