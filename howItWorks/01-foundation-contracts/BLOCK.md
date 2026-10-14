# 01 — Foundation & contracts (schema, types, budget engine, core API)

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `01`). Start: `bash $BIN/bootstrap.sh 01` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 01` → `bash $BIN/merge-block.sh 01`.

**Wave:** W0 · **Priority:** MUST · **Estimate:** 60–75 min · **Worktree:** `Kairon-wt/01-foundation-contracts` (gate and base: `bin/blocks.conf`)
**In parallel:** 02 (web shell + UI kit). 02 is waiting for your **`contracts-ready`** status so it can `git merge feat/01-foundation-contracts`. **Publish the contracts early** (steps 1–4), then do the API.
**Everyone after you** depends on you: your exported names, file paths and endpoint shapes are what they code against.

## Goal
Turn `shared/CONTRACTS.md` §1–§5 and §8 into code exactly: the schema, a single migration, the zod types, the engine with tests, the core CRUD, stub modules for later blocks, dependencies and the e2e wiring.

## You own
See CONTRACTS §7, row 01. Do not touch `apps/web/src/**` — that belongs to 02.

## Steps
1. **Dependencies** (CONTRACTS §8) with one command. Then `npm ci` passes. Commit, and **`bash $BIN/flag.sh 01.deps-ready`**: 02 merges your branch right away to get lucide/recharts.
2. **Engine lib** (the generator was checked with a dry-run):
   ```bash
   npx nx g @nx/js:library --directory=libs/shared/budget-engine --name=budget-engine \
     --importPath=@default-project/budget-engine --tags=scope:shared --bundler=none \
     --unitTestRunner=jest --linter=eslint --no-interactive
   ```
   Copy the `typecheck` target from `libs/shared/types/project.json`.
3. **Types** `libs/shared/types/src/lib/`: `enums.ts` (const arrays + `z.enum`, exported as `COST_CATEGORIES` etc. for class-validator `@IsIn`), `money.ts` (zod `centsSchema`, `qtyMilliSchema`, `isoDateSchema`), `project.ts`, `budget-line.ts`, `cost-item.ts`, `organization.ts`, `land.ts`, `architecture.ts`, `delivery.ts` (incl. `DeliveryImportRow`, `ImportResult`), `snapshot.ts` (`ProjectSnapshot`, `ProjectListItem`), `analytics.ts` (`PortfolioAnalytics`), `search.ts` (`SearchResult`), `wizard.ts` (`WizardInput`: name, clientName, city, startDate, markupBps, land{…}, house{livingAreaM2, storeys, energyStandard}, approvedByCategory?), `catalog.ts` (the §4 catalogue as data: `BUDGET_CATALOG`), `version.ts`. **Keep** `healthStatusSchema`. Barrel `index.ts`. **Every** shape is defined in CONTRACTS §3/§5 (Profitability, ScheduleResult, PortfolioAnalytics, WizardInput, ProjectListItem); copy them exactly.
4. **Engine** `libs/shared/budget-engine/src/lib/`: `money.ts` (`roundHalfUp`, `itemPlannedCents`, `parseEurToCents`, `parseQtyToMilli`), `format.ts` (`formatEur`, `formatEurWhole`, `formatQty`, `formatBps`, `formatDate`), `rollup.ts` (`itemForecastCents`, `itemOpenCommitment`, `summarizeProject`), `profitability.ts` (`computeProfitability`), `schedule.ts` (`checkSchedule`, `daysBetween`), `cashflow.ts` and `portfolio.ts` (signature + `throw new Error('Not implemented: block 06/11')`), `testing.ts` (`makeLine`, `makeItem`, `makeOrg`, `makeSnapshot`). Tests: see AC.
   → **Commit and `bash $BIN/flag.sh 01.contracts-ready "<exports>"`** + HANDOFF (list the exports).
5. **Prisma** (then commit and **`bash $BIN/flag.sh 01.schema-ready`**: this is the start gate for 03): the schema from CONTRACTS §2 (multi-line format), `npx nx run api:prisma-migrate -- --name init`, `prisma.config.ts` → `migrations.seed` (`ts-node --transpile-only prisma/seed.ts` or `node --experimental-strip-types`; check that it works). **The runner must resolve `@default-project/*` aliases** (e.g. `-r tsconfig-paths/register` if the package is installed, otherwise a CR); 03 imports `parseEurToCents` from the engine. Seed data lives in `apps/api/src/seed-data/` (03, so that Jest collects its tests), and `prisma/seed.ts` is a thin entry point. `prisma/seed.ts` is a dispatcher stub that calls `seed/index.ts` (block 03 fills it), and for now it seeds nothing.
6. **API** (folder per feature, DTOs with class-validator, `Logger`, Nest exceptions):
   - `projects/`: list (+summary/profit through the engine), snapshot (one `findUnique` with `include`, no N+1), create (default lines from `BUDGET_CATALOG`, approved 0), patch.
   - `budget-lines/`, `cost-items/` (validation: `budgetLineId` belongs to the project, otherwise 400; `requiredForWorkId` points to a WORK in the same project; caps from CONTRACTS §1), `organizations/`.
   - Stubs (`@Module({})` + an empty controller with the path prefix): `land`, `architecture`, `deliveries`, `analytics`, `project-wizard`, `search`. Register all of them in `app.module.ts`.
   - `POST /projects/:id/duplicate`: a deep copy in one `$transaction` with remapping of `requiredForWorkId`/`boqComponentId`/`batchId`, the slug gets the suffix `-copy-<n>`, codes are unchanged (they are unique per project). This is the e2e base for every block.
   - `projects.service` `GET /projects/:id` returns `organizations` = those referenced by the project's rows (`supplierId`/`contractorId`/`architectOrgId`).
7. **E2E wiring:** `playwright.config.ts`: `baseURL` `http://localhost:4300`, `webServer: [{ api, url /api/health }, { web:preview, url http://localhost:4300 }]`, `reuseExistingServer: !process.env.CI`. The preview port and the `/api` proxy on preview are set by **02** in `vite.config.mts` (you do not edit that file). Check it with `npx playwright test --list`.
8. `bash $BIN/check.sh 01` → HANDOFF → `bash $BIN/merge-block.sh 01` (PARALLEL-RUN §5).

## Acceptance criteria (Jest unless marked otherwise)
- AC-01.1 `itemPlannedCents`: 1.5 × €0.03 → 5¢; 0.333 × €1.00 → 33¢; 2.5¢ → 3¢; result not a safe integer → throw.
- AC-01.2 `roundHalfUp` is symmetric for negatives: −2.5 → −3.
- AC-01.3 EAC by status: DONE=actual; CONTRACTED=max(actual,committed); PLANNED/PARTIAL with committed<planned counts the remainder (e.g. planned 100, committed 60, actual 10 → 100); committed>planned → committed.
- AC-01.4 `summarizeProject`: line sums = sum of rows; category = sum of lines; project = sum of categories (an additivity property test over 500 random rows, all integers).
- AC-01.5 overrun only when forecast > approved (equal → not overrun); `overrunLines` sorted by overrun desc; variance is negative on overrun.
- AC-01.6 Profitability: approved 573,861.00 €, 1500 bps → contractPrice 659,940.15 € (exactly in cents); profit can go negative; margin is 0 when contractPrice=0.
- AC-01.7 Schedule: delivery = work start → ON_TIME; +1 day → LATE_FOR_WORK delayDays 1; no deliveryDate → UNSCHEDULED; delivered → DELIVERED; not delivered and date < today → OVERDUE; a work item gets `blockingMaterials`.
- AC-01.8 `parseEurToCents("1,234.56")=123456`, `"12"`→1200, `"0.005"` → error (more than 2 decimal places), `"abc"` → error.
- AC-01.9 zod rejects negative/fractional cents and a date that is not `YYYY-MM-DD`.
- AC-01.10 API (Prisma mocked): PATCH item with a `budgetLineId` from another project → 400; non-existent item → 404; `GET /projects` excludes `isTemplate`.
- AC-01.12 (Jest) duplicate: new ids, links point to the copy's rows, the source is unchanged (the mock checks there is no update on source ids).
- AC-01.11 (check) `npx nx lint api web budget-engine types` passes: boundaries hold (the engine imports nothing from apps).

## Verify
`npx nx test budget-engine && npx nx test types && npx nx test api && npx nx lint api && npx nx typecheck api budget-engine types` (all exit 0); `cd apps/api && npx prisma migrate status`.

## Do not do
Seed data (03), web code (02), the bodies of the land/architecture/... modules (07–13), `prisma migrate reset`.
