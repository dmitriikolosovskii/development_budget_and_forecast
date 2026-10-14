# HANDOFF — 01-foundation-contracts

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
done, `check.sh 01` PASS at 85e2100 → merging (`merge-block.sh 01`). Flags: `01.deps-ready` (1af45f9), `01.contracts-ready` (881ba97), `01.schema-ready` (52fd422).

## Ready for neighbours (exports / components / endpoints, with examples)

### `@default-project/types` (zod 4; every schema `xxxSchema` has an inferred type `Xxx`)
- Enums: `COST_CATEGORIES`, `ITEM_KINDS`, `ITEM_STATUSES`, `PROJECT_STATUSES`, `ORG_ROLES`, `UTILITY_TYPES`, `UTILITY_STATUSES`, `HOUSE_SECTIONS`, `DELIVERY_KINDS`, `UNITS` (const arrays, use with `@IsIn`) + `costCategorySchema` … `unitSchema`, `UNIT_LABELS`, `ITEM_KIND_CODE` (`MATERIAL→MAT` …).
- Money: `centsSchema`, `qtyMilliSchema` (int ≥0 ≤2e9), `bpsSchema` (≤100000), `signedCentsSchema`, `isoDateSchema` (`z.iso.date()`), `isIsoDate()`, `idSchema` (**`z.string().min(1)`**: ids are cuid or uuid, never format-checked), `MAX_INT_FIELD`, `MAX_BPS`.
- Entities (wire shape: timestamps are ISO strings, nullable fields are `null`, not missing): `Project`, `BudgetLine`, `CostItem`, `Organization`, `LandParcel`, `UtilityConnection`, `ArchitecturePlan`, `Room`, `BoqComponent`, `Delivery`, `ImportBatch`; `LandWithUtilities`, `PlanWithDetails`.
- Inputs (same rules as the API DTOs; use them with react-hook-form `zodResolver`):
  `createProjectInputSchema`, `updateProjectInputSchema`, `duplicateProjectInputSchema`, `createBudgetLineInputSchema`, `updateBudgetLineInputSchema`, `createCostItemInputSchema`, `updateCostItemInputSchema` (`kind`/`code` immutable; `null` clears a nullable field), `createOrganizationInputSchema`, `updateOrganizationInputSchema`,
  for 07: `updateLandInputSchema`, `upsertUtilityInputSchema`; for 08: `updatePlanInputSchema`, `create|updateRoomInputSchema`, `create|updateBoqComponentInputSchema`, `ROOM_KINDS`; for 10: `DELIVERY_CSV_COLUMNS`, `deliveryImportRowSchema` (raw strings), `deliveryImportInputSchema`, `importResultSchema`, `importRowErrorSchema`.
- Rollups: `Summary`, `LineSummary`, `OverrunLine`, `ProjectSummary`, `CategorySummaries`, `Profitability`, `MaterialStatus`, `WorkStatus`, `MaterialScheduleResult`, `WorkScheduleResult`, `ScheduleResult`, `CashflowMonth`, `Cashflow`.
- Composite: `ProjectSnapshot` (`projectSnapshotSchema`), `ProjectListItem`, `PortfolioAnalytics`, `PortfolioProject`, `SearchResult` (`SEARCH_RESULT_TYPES`), `WizardInput` (`ENERGY_STANDARDS`, `HEATING_OPTIONS`, `WALL_TYPES`).
- Catalogue: `BUDGET_CATALOG: CatalogSection[]` (`{category, section, name, codePrefix, sortOrder}`, 43 rows), `catalogSections(category)`, `findCatalogSection(category, section)`.
- `CONTRACT_VERSION = 1`, `healthStatusSchema` (kept).

### `@default-project/budget-engine` (pure, scope:shared)
```ts
import { summarizeProject, computeProfitability, checkSchedule, formatEur, parseEurToCents } from '@default-project/budget-engine';
const s = summarizeProject(snapshot);                  // { project, byCategory, byLine, overrunLines }
const p = computeProfitability(s.project, snapshot.project.markupBps);
const sched = checkSchedule(snapshot.items, '2026-10-14'); // Record<itemId, ScheduleResult>
formatEur(s.project.forecast);                          // "€573,861.00"
```
- Inputs are structural: `EngineItem`, `EngineLine`, `EngineSnapshot = { budgetLines, items }` (a `ProjectSnapshot` or Prisma rows both fit).
- money: `roundHalfUp(num: bigint, den: bigint)`, `itemPlannedCents`, `parseEurToCents` (trims, optional leading `€`, `1,234.56`; throws on >2 decimals, negatives, `12,5`), `parseQtyToMilli` (≤3 decimals).
- format: `formatEur`, `formatEurWhole`, `formatQty(milli, unit?)`, `formatBps`, `formatDate` (`"3 Nov 2026"`, UTC).
- rollup: `itemForecastCents`, `itemOpenCommitment`, `itemExposure`, `toBps`, `finalizeSummary`, `summarizeProject` (overrunLines sorted by overrun desc, then name, then id).
- `computeProfitability(summary, markupBps)`; `checkSchedule(items, today)`, `daysBetween(from, to)` (INVALID_DATES → `blockingMaterials: []`).
- Stubs that throw (bodies belong to 06/11): `monthlyCashflow(snapshot, today): Cashflow`, `summarizePortfolio(snapshots: PortfolioSnapshot[])`.
- Test factories: `makeProject`, `makeLine`, `makeItem`, `makeOrg`, `makeSnapshot` (full wire types, sensible defaults, override anything).

### Prisma / seed (03)
- Schema = CONTRACTS §2, one migration `20261014080515_init`. `cd apps/api && npx prisma migrate deploy`.
- `npx prisma db seed` → `ts-node --transpile-only -P tsconfig.app.json -r ./prisma/register-paths.cjs prisma/seed.ts` (`prisma.config.ts`). The preload resolves `@default-project/*` (tsconfig-paths 4.2.0 pinned). No `VAR=…` prefixes: Prisma spawns the command without a shell. `prisma/seed.ts` is a stub that block 03 replaces.
- Api Jest's test inputs include `apps/web-e2e/fixtures/*.csv` (03's request).
- BigInt: the engine uses `BigInt(1000)` (no `1000n` literals), so ts-jest with target es2015 compiles it.

### API (prefix `/api`; responses are Prisma rows, which serialise to the zod wire types)
| Route | Notes |
|---|---|
| `GET /projects` | `ProjectListItem[]`, templates excluded, `summary` + `profitability` from the engine |
| `GET /projects/:id` | `ProjectSnapshot`; `organizations` = referenced by `supplierId`/`contractorId`/`plan.architectOrgId`; 404 |
| `POST /projects` | `CreateProjectDto` {name, code, clientName, city, startDate, endDate, markupBps?, status?} → snapshot with 43 catalogue lines at 0; slug from the name |
| `PATCH /projects/:id` | name, clientName, city, status, startDate, endDate, markupBps; end < start → 400 |
| `POST /projects/:id/duplicate` | `{name?}` → snapshot of the copy: slug `<slug>-copy-<n>`, name `"<name> (copy)"`, `isTemplate=false`; every FK remapped; organisations shared |
| `POST /projects/:id/budget-lines`, `PATCH`/`DELETE …/:lineId` | category/section immutable; duplicate section → 409; **DELETE with items → 409** (owner) |
| `POST /projects/:id/items`, `PATCH`/`DELETE …/:itemId` | foreign `budgetLineId`/`requiredForWorkId`/`boqComponentId`/unknown org → 400; item not in project → 404; duplicate code → 409; `kind`/`code` immutable (stripped); `null` clears nullable fields, `null` on NOT NULL → 400; `requiredForWorkId` only MATERIAL → WORK |
| `GET/POST /organizations`, `PATCH /organizations/:id` | slug immutable; duplicate slug → 409 |
- Stubs (empty controllers, registered in `app.module.ts`): `land` → `projects/:projectId/land`, `architecture` → `projects/:projectId/plan`, `deliveries` → `projects/:projectId/deliveries`, `analytics` → `analytics`, `project-wizard` → `projects/wizard` (registered **before** ProjectsModule, so `GET /projects/wizard/template` from CR-12 is not swallowed by `projects/:id`), `search` → `search`.
- Reuse for 12: `ProjectCopyService.deepCopy(tx, sourceId, overrides)` (exported by `ProjectsModule`; overrides: name, slug, isTemplate, status, clientName, city, startDate, endDate, markupBps) returns the new id inside your transaction. `ProjectScopeService` (assertProject / assertLineInProject / assertWorkInProject / assertBoqInProject / assertOrganizations) is exported too.
- DTO helpers in `apps/api/src/projects/dto/validators.ts`: `IsIsoDate`, `IsCappedInt` (int 0..2e9), `OptionalNotNull`, `OptionalNullable`. `isUniqueViolation(e, field?)` is in `apps/api/src/prisma/prisma-errors.ts`.

### E2E
`apps/web-e2e/playwright.config.ts`: baseURL `http://localhost:4300` (`BASE_URL` overrides it), `webServer` = [`nx serve api` → `/api/health`, `nx run web:preview` → 4300], `reuseExistingServer: !CI`. `npx playwright test --list -c apps/web-e2e/playwright.config.ts` lists the tests.

## How to check
- `bash howItWorks/bin/check.sh 01` → CHECK: PASS (ownership, format, affected lint/test/typecheck/build, test weakening). Tests: types 20, budget-engine 72, api 35.
- `bash howItWorks/bin/ac-ledger.sh --root <WT> --block 01` → OK=11, MANUAL=1 (AC-01.11 = lint), UNCOVERED=0.
- Real-SQLite smoke (api on :3501, then stopped): create → 43 lines; WORK+MATERIAL link; 400/404/400(null)/409(line delete) as designed; duplicate ×2 → `-copy-1`, `-copy-2`, links point to the copy, source unchanged; list shows summary/profitability; stub route → 404.

## Red-proof
Each AC was shown red by a mutation in production code (applied, the tagged tests run, then restored):
| AC | Mutation | Result |
|---|---|---|
| 01.1 | `itemPlannedCents` divisor 1000 → 999 | 1 failed (the €2,406.25 case added after a first survivor) |
| 01.2 | `roundHalfUp` drops the sign | 1 failed |
| 01.3 | PLANNED forecast = committed only | 1 failed |
| 01.4 | `add()` drops exposure / project skips a category | 1 failed each (the test was strengthened after the first survivor) |
| 01.5 | overrun `>` → `>=` | 1 failed |
| 01.6 | margin guard `=== 0` → `!== 0` | 3 failed |
| 01.7 | DELIVERED check disabled | 1 failed |
| 01.8 | allow 3 decimals for euros | 1 failed |
| 01.9 | `centsSchema` without int/min | 2 failed |
| 01.10 | no budgetLine scope check / no `isTemplate:false` filter | 1 failed each |
| 01.12 | `requiredForWorkId` / `batchId` not remapped | 1 failed each |

## Gaps, CRs, deviations from CONTRACTS
- `WizardInput.approvedByCategory` is **optional** (BLOCK 01 step 3 lists it as `approvedByCategory?`; CONTRACTS §5 shows it as required). Optional accepts both.
- `DELETE /projects/:id/budget-lines/:lineId` with items → 409 (owner's answer 2026-10-14; the schema cascade stays for project deletion).
- Ids of copied rows are `randomUUID()`, not cuid. `idSchema` is `z.string().min(1)`, so don't validate ids by format.
- CR-11 (portfolio fields) and CR-12 (wizard template route) are left to the integrator after `w0-frozen`. Nothing in 01 blocks them.
- Extra exports beyond CONTRACTS (input schemas for 07/08/10, `Summary` etc. as zod) were added so later blocks don't need a CR for frozen `libs/shared/types`.
