# HANDOFF — 12-calculate-project

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
done. `check.sh 12` → CHECK: PASS (ownership, format, affected lint/test/typecheck/build, test weakening). AC ledger: OK = 8 (12.1–12.5, 12.7–12.9); UNRUN = 1 (12.6, e2e, run by the integrator).
- Branch `feat/12-calculate-project`: `2e6037b` (API), `87c388e` (web + e2e).
- Merged into main by `merge-block.sh 12`.
- Design and judge constraints: [DESIGN.md](DESIGN.md) (see "As built").

## Ready for neighbours

### API (`apps/api/src/project-wizard/`)
| Route | Body → Response | Errors |
|---|---|---|
| `POST /api/projects/wizard` | `WizardInput` → `ProjectSnapshot` (201) | 400: validation, `livingAreaM2` outside 100–250, missing category in `approvedByCategory`, duplicate utility type, any amount > 2,000,000,000. 404: no template. 409: no free slug after 3 tries |
| `GET /api/projects/wizard/template` | → `ProjectSnapshot` of `template-efh-144` | 404 if the seed has not run |

Example (the integrator's e2e may use it to create isolated projects; **the endpoint is stable**):
```bash
curl -s -H 'content-type: application/json' localhost:3454/api/projects/wizard -d '{
 "name":"Haus Müller","clientName":"Familie Müller","city":"Regensburg","startDate":"2027-04-01","markupBps":1500,
 "land":{"address":"Am Brunnenfeld 7","postalCode":"93051","municipality":"Regensburg","state":"Bayern","areaM2":600,
         "landValuePerM2Cents":30000,"grzBps":3500,"gfzBps":7000,"maxStoreys":2,"soilClass":"3",
         "utilities":[{"type":"WATER","status":"AT_BOUNDARY"},{"type":"POWER","status":"IN_STREET"}]},
 "house":{"livingAreaM2":180,"storeys":2,"energyStandard":"EH40","heating":"HEAT_PUMP","wallType":"MONOLITHIC_BRICK"}}'
```
`approvedByCategory` is optional. When it is omitted, the server approves its defaults, which equal the wizard's estimate.

**What a wizard project looks like** (it opens on every tab 04–09):
- **Rows:** 43 budget lines and 186 rows from the template, codes unchanged.
  - Everything is PLANNED, committed = actual = 0. No deliveries and no import batches.
  - Every date is shifted by (startDate − 2026-04-01), so there are **no schedule conflicts** and **no overrun lines** with default amounts.
- **Scaling** by `f = livingAreaM2 / 144`, using 03's `derive.ts` helpers (imported, not copied):
  - MATERIALS/CONSTRUCTION quantities only for **continuous units** (m3, m2, m, t, kg, h), half-up; pcs/set/lump stay the same;
  - BOQ components use the same rule, so material qty = linked BOQ qty, as in the seed;
  - HOAI `design` unit price × f;
  - rooms and footprint × √f.
- **Land rows from step 2:**

  | Row | Value |
  |---|---|
  | `SRV-PUR-001` | area × price |
  | `SRV-ACQ-001` | transfer tax by state |
  | `SRV-ACQ-002` | notary 1.5 % |
  | `SRV-ACQ-003` | registry 0.5 % |

  Transfer tax by state:

  | State | Rate |
  |---|---|
  | Sachsen | 5.5 % |
  | Bayern | 3.5 % |
  | NRW | 6.5 % |
  | Berlin | 6.0 % |
  | Brandenburg | 6.5 % |
  | Hessen | 6.0 % |
  | BW | 5.0 % |
  | other | 5.0 % (est.) |

  `site-development` and `surveys` rows are copied unchanged.
- **For 07 (Land):**
  - `lat = lng = 0`, which means location unknown (07 hides the map link);
  - `zoningPlan` / `roofRules` = "To be confirmed", `soilType` = "To be confirmed (soil report)";
  - `district`, `cadastralRef`, `bearingCapacityKnM2` and the notes fields are null;
  - plot sides = template × √(area / 520);
  - utilities: exactly the ones from step 2 (the UI sends all 7 types).
- **For 08 (Architecture):**
  - `storeys`, `energyStandard` ("KfW EH 40 / GEG 2024") and `heatingSystem` come from step 3; the wall type is in `notes`;
  - the site offset is clamped so the house stays on the plot;
  - **the rooms are always the template's 14 (2 floors), even with storeys = 1**: the house options are descriptive only (owner decision).
- **Project fields:**
  - `slug` = name with äöüß transliterated + a 6-hex suffix (e.g. `haus-mueller-1fdf7d`);
  - `code` = `KF-<year>-W<HEX>`;
  - status PLANNING.

### Web (`apps/web/src/features/project-wizard/`)
- `ProjectWizardPage` at `/projects/new`, 5 steps: Basics · Land · House · Budget · Review.
  - The `<h1>Calculate project</h1>` renders synchronously (02's AC-02.16 stays green).
  - Each step heading is an `h2` with the step name.
- `estimateBudget(input, template)` (`estimate-budget.ts`, pure) mirrors the server planner. On the real template it was verified **equal to the cent** to the server defaults (180 m², Bayern, 600 m² × 300 €).
- `useWizardTemplate()` uses the private key `['project-wizard','template']` (CR-12, applied).
- `useCreateFromWizard()` invalidates `['projects']`, `['analytics']` and `['search']`, then navigates to `/projects/<id>/land`.
- Test hooks for e2e:
  - labels "Project name", "Client", "City", "Address", "Postal code", "Municipality", "Living area, m²", "Approved <Category>";
  - test ids `estimate-value-<CATEGORY>`;
  - buttons "Next" / "Back" / "Create project" ("Creating…" while pending).

## How to check
```bash
WT=/Users/dmitriyluba/WebstormProjects/Interview/Kairon-wt/12-calculate-project
cd $WT && npx jest -c apps/api/jest.config.cts apps/api/src/project-wizard   # 3 suites, 22 tests
npx vitest run --root apps/web src/features/project-wizard                   # 2 files, 11 tests
bash $MAIN/howItWorks/bin/check.sh 12                                          # CHECK: PASS
bash $MAIN/howItWorks/bin/e2e.sh --grep "AC-12.6"                              # main tree only (integrator)
```
Done on a real SQLite DB (`PORT=3512`, seeded):
- `GET template` → 200.
- `POST` → 201, with 43 lines / 186 rows / 14 rooms / 35 BOQ / 2 utilities.
- The project is listed with `overrun: false`.
- Duplicate utility → 400; 100,000 m² plot → 400 "Row SRV-PUR-001 is outside the supported range"; living area 260 → 400.

Red-proof:
- breaking the cent remainder, the link remap and the land source → 7 API tests red;
- removing the estimate sync, the pending guard and the `['projects']` invalidation → 3 web tests red.

## Gaps, CRs, deviations from CONTRACTS
- **CR-12-wizard-template-route** (applied by 00): `GET /projects/wizard/template` and the continuous-unit scaling rule are in CONTRACTS §5.
- **Deviations from BLOCK.md:**
  - Only continuous units are scaled (BLOCK said every `qtyMilli`), so one heat pump stays one.
  - The budget defaults are derived from the template (max(template approved × f, planned) per line, the same rule as 03's derived projects). BLOCK's rough formulas (architecture 13.6 %, marketing ≈ 3 %, contingency 10 %) are not used: contingency scales with f and so stays ≈ 10 %.
  - The user's amount per category is split across its lines in proportion to those defaults. The floor of each share is taken and the leftover cents go to the largest line, so Σ is exact.
- **Not done (for SOLUTION.md "next steps"):**
  - server-side idempotency (a double click is prevented only by the disabled button);
  - cost multipliers for house options;
  - a bungalow plan when storeys = 1;
  - geocoding of the address;
  - a wizard-specific query key in `query-keys.ts`.
- **Visual check not done:** blocks don't serve the web app. The flow is covered by Vitest (jsdom) and by `wizard.spec.ts` (AC-12.6).
  - Its last assertion (a row in the Materials table at `/materials/concrete`) needs block 04's table.
  - The API part of that test (MATERIALS rows in the snapshot) does not depend on 04.
- The api ↔ web rules are duplicated (`wizard-plan.ts` ↔ `estimate-budget.ts`, `transfer-tax.ts` ×2) because only frozen libs are shared. Each copy carries a comment naming the other.
