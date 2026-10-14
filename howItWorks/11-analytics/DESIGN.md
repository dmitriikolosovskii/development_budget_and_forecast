# DESIGN — 11 Analytics (block spec, 2026-10-14)

## Goal / Non-goals
**Goal:** `/analytics` answers the CFO's 5 questions across the **whole portfolio** (non-template projects) and compares projects: KPI row, budget vs forecast by project, sortable project table, cost structure by category, overrun heatmap, portfolio cash flow, delivery KPIs, filters by status and period.
**Non-goals:** edits on this page; server-side filtering; changes to frozen files (`libs/shared/types`, `budget-engine/src/index.ts`, routes, `app.module.ts`); copies of 06's charts; time-sliced EAC.

## Owner decision (2026-10-14)
"Period" = keep projects whose `[startDate, endDate]` overlaps the selected period. KPIs/table cover those projects over their whole life (EAC is not time-sliced). Only the cash-flow chart is clipped to the period.

## Chosen approach: A — one query, extended per-project payload, client-side filters
- **Engine (`portfolio.ts`)**: `summarizePortfolio(snapshots)` keeps its frozen signature and delegates to `summarizePortfolioExtended(snapshots)` (adds `startDate`, `endDate`, `overrunLineCount` per project). `aggregatePortfolio(projects)` → `{ totals, byCategory, profitability }`, used by **both** the API and the web filter. `mergeCashflows(months[][])` sums monthly amounts, fills gaps, recomputes cumulatives. `clipCashflow(months, from, to)` slices without resetting cumulatives.
- **API (`apps/api/src/analytics/`)**: `GET /analytics/portfolio?today=YYYY-MM-DD` → one `prisma.project.findMany({ where: { isTemplate: false }, include: { budgetLines: true, items: true, deliveries: true } })`; per project `monthlyCashflow` (06) and `delivery` stats; top-level `cashflow = mergeCashflows(...)`.
- **Web (`features/analytics/`)**: `usePortfolio()` (key `['analytics','portfolio']`, sends `useToday()`, parses with a local zod schema), pure `filter-portfolio.ts`, page sections; charts from `features/profitability/charts` (06) after `06.merged`.

**Why not the others:** B (server-side filters `?status=&from=`) refetches on each filter change, alters the query key, and turns AC-11.5 into a mock-only test. C (client fetches N snapshots) is N+1 and contradicts AC-11.2.

## Judge constraints (mandatory)
1. `summarizePortfolio` signature/return type unchanged; new exports reach callers through the existing `export *` in `index.ts`. `PortfolioSnapshot.project` gains `startDate`, `endDate` (the file is ours).
2. **Portfolio profitability = sum of per-project fields** (`approved`, `contractPrice`, `plannedProfit`, `forecastProfit`, `profitErosion`), `marginBps = toBps(Σ forecastProfit, Σ contractPrice)`. Never `computeProfitability(totals, one markup)` — projects have different markups. Same `aggregatePortfolio` on server and client. Doc comment + CR-11.
3. `mergeCashflows`: sum monthly `planned/actual/forecast` (never cumulatives), continuous months from the first to the last input month (gaps = 0), cumulatives recomputed; `[]` → `[]`. Clipping keeps cumulative history (does not restart at 0).
4. API: exactly one `findMany` with `include`, `isTemplate: false`, no other queries. DTO in `dto/` (blocks.conf: `*` matches `/`).
5. "Today": optional `?today` validated by a class-validator DTO (`/^\d{4}-\d{2}-\d{2}$/` + real date) → 400 otherwise; fallback `ConfigService` `DEMO_TODAY` (`today` → current UTC date), then `'2026-10-14'`. The web always sends `useToday()`, so web and API agree. Query key stays `['analytics','portfolio']` (today is a build constant).
6. Extension fields (`startDate`, `endDate`, `overrunLineCount`, `cashflow`, `delivery`) are declared once in `features/analytics/local-types.ts` (`// TODO CR-11`) as a zod schema extending `portfolioAnalyticsSchema`; `usePortfolio` parses the response (no bare cast). CR-11 asks to add them as optional fields.
7. Delivery KPIs use **block 10's definitions** exactly: `overdueItems` = MATERIAL items with `checkSchedule` status `OVERDUE`; `% on time` over DELIVERED `Delivery` rows of items with a `deliveryDate`, on time when `date ≤ item.deliveryDate` (`onTimeRows / deliveredRows`; `—` when 0). The `Delivery` model is in 01's init migration, so no gating on 10.
8. `<h1>Analytics</h1>` renders outside loading/error branches; 404/500 never throws (keeps 02's AC-02.16 green). Loading skeleton, ErrorState + retry, EmptyState.
9. Order: engine → API → KPIs, table, filters, heatmap → charts after `06.merged` (`git merge main`). No local copies of 06 charts. The API spec mocks `monthlyCashflow` until 06 is merged.
10. Chart tests: fixed `width`/`height`, local `ResizeObserver` stub; no recharts internals asserted. Heatmap and tables are plain HTML.
11. Period filter: chips `All` + years derived from project dates; a project overlaps year Y when `startDate ≤ 'Y-12-31'` and `endDate ≥ 'Y-01-01'` (string compare).

## Page layout
Header `<h1>Analytics</h1>` + filters (status select: All/Planning/Active/Completed; period chips) →
1. KPI row: Approved, Spent, Open commitments, Forecast (EAC), Variance, Forecast profit, Average margin, Projects over budget `N of M`.
2. Budget vs forecast by project (`BudgetVsForecastChart`, rows = projects) + sortable table (name, status, % complete = actual/EAC, variance, forecast profit, margin, overrun lines); row click → `/projects/:id/profitability`.
3. Cost structure by category: own recharts stacked bars (x = project, stacks = categories, EAC, `CATEGORY_COLORS`).
4. Overrun heatmap: project × category, cell = variance % (`variance / approved`), `data-tone="risk"` when variance < 0, `"ok"` otherwise; `—` when approved = 0 and forecast = 0.
5. Portfolio cash flow (`CashflowSCurve`, merged + clipped, `todayMonth`).
6. Deliveries: % on time, overdue items (portfolio sums).
Empty (no projects after the API, or none after filters): EmptyState + CTA "Calculate project" → `/projects/new` (for the unfiltered empty portfolio); "No projects match the filters" + reset for filtered-out.

## Affected files (all in row 11 of `bin/blocks.conf`)
- `libs/shared/budget-engine/src/lib/portfolio.ts`, `portfolio.spec.ts`
- `apps/api/src/analytics/`: `analytics.module.ts`, `analytics.controller.ts`, `analytics.service.ts`, `dto/portfolio-query.dto.ts`, `delivery-stats.ts`, specs
- `apps/web/src/features/analytics/`: `analytics-page.tsx` (body), `local-types.ts`, `use-portfolio.ts`, `filter-portfolio.ts`, `portfolio-kpis.tsx`, `projects-table.tsx`, `overrun-heatmap.tsx`, `category-stack-chart.tsx`, specs
- `apps/web-e2e/src/analytics.spec.ts`
- Coordination (main tree): `howItWorks/shared/change-requests/CR-11-portfolio-extension.md`, this DESIGN, HANDOFF.

## Risks
- 06 not merged → no charts yet (medium): engine/API/KPIs/table/heatmap first; merge waits for `06.merged` anyway.
- 01's analytics stub module may land later than `w0-frozen` (medium): if absent after the gate → note to 01/00 (we cannot register it in `app.module.ts`).
- CR-11 rejected (low): the web keeps the local schema; extra fields still flow (no response serialiser, `apiGet` returns raw JSON).
- Sums of cents across projects: Number is exact to 2^53; `finalizeSummary` throws otherwise.

## Test strategy (tags `[AC-11.N]`)
- AC-11.1 (Jest, engine) `summarizePortfolio` totals/byCategory = exact-cent sums of per-project `summarizeProject`; a snapshot not passed in is absent.
- AC-11.2 (Jest, API) one `project.findMany` with `where: {isTemplate:false}` and `include`; no other prisma calls.
- AC-11.3 (Vitest) heatmap cell variance −1 ¢ → `risk`; 0 and +1 → `ok` (and not the other tone).
- AC-11.4 (Vitest) empty portfolio → EmptyState + link "Calculate project" → `/projects/new`; no KPI row, no table.
- AC-11.5 (Vitest) status COMPLETED leaves only Markranstädt (local 3-project fixture); KPI `1 of 1`.
- AC-11.6 (Jest, engine) 2 projects with markups 1500/1200: profitability fields = sums, margin = Σprofit/Σcontract; differs from `computeProfitability(totals, 1500)`.
- AC-11.7 (Jest, engine) `mergeCashflows`: disjoint ranges → continuous months with zero gaps, cumulatives = running sums, Σ months exact; `[]` → `[]`.
- AC-11.8 (Vitest, pure) period overlap keeps edge-touching projects, drops outside ones; KPIs whole-life; clipped cash flow keeps prior cumulative.
- AC-11.9 (Vitest) header click sorts asc then desc, `aria-sort` updates.
- AC-11.10 (Vitest) row click → `/projects/:id/profitability`.
- AC-11.11 (Jest, API) invalid `today` → 400 (DTO validation); valid `today` drives `overdueItems`; on-time % per block 10's rule.
- AC-11.12 (Vitest) loading skeleton; 500 → ErrorState, Retry refetches; `<h1>` present in every state.
- AC-11.13 (e2e, integrator) duplicating Taucha adds a row (found by the copy's name) and changes portfolio Approved; no absolute counts.

## How to verify
`bash $BIN/check.sh 11` → `CHECK: PASS`; `bash $BIN/ac-ledger.sh --block 11 --root $WT`. e2e: integrator runs `bash howItWorks/bin/e2e.sh --grep analytics`.

## Open questions
- (default applied, not blocking) "Average margin" = Σ forecast profit / Σ contract price (weighted), since `computeProfitability` over summed totals needs one markup and projects differ. Raised in CR-11 for the owner/integrator.

## As built (2026-10-14)
Deviations from the plan above, all within block 11's files:
- CR-11 was applied in main (1e0fe11, `CONTRACT_VERSION 2`), so there is no `local-types.ts`: `features/analytics/analytics-schema.ts` takes `portfolioProjectSchema.required({ startDate, endDate, overrunLineCount, cashflow, delivery })` (optional in the shared contract, always sent by our endpoint). `usePortfolio` parses the response with it; a malformed body shows the error state.
- `delivery` has no gating on block 10: `Delivery` rows exist since 01's migration; the API includes them in the same `findMany`.
- `monthlyCashflow` is called as `monthlyCashflow({ budgetLines, items }, today)`; the API spec keeps a fixed mock series so the merge wiring stays deterministic (06 tests the function itself).
- Filters live in the URL (`/analytics?status=COMPLETED&period=2027`); `Reset filters` clears both.
- Projects are ordered by `startDate`, then `name` in the API; the table is unsorted until a header is clicked.
- Heatmap and cost structure sit side by side only at `2xl` (≥ 1536 px); at 1440 px the heatmap was clipped.
- A row click opens `/projects/:id/profitability`; the project name is also a real link (keyboard).
- Live probe on the seed (worktree, API :3511): totals = Σ rows; Taucha approved 57,386,100 ¢ / EAC 54,045,565 ¢ / 3 overrun lines; Markranstädt EAC/approved 100.73 %; template excluded; portfolio cash flow 2024-10 … 2028-03 (42 months); `?today=2026-02-30` → 400. Screenshots at 1440 px: all periods and 2027, no console errors.
