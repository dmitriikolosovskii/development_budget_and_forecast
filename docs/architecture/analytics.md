<!-- paths: apps/api/src/analytics/**, apps/web/src/features/analytics/**, libs/shared/budget-engine/src/lib/portfolio.ts, apps/web-e2e/src/analytics.spec.ts | portfolio analytics (block 11) -->
# Portfolio analytics

`/analytics` answers the CFO's questions for the whole portfolio (every non-template project): a KPI row,
budget vs forecast by project, a sortable project table, cost structure by category, an overrun heatmap,
the portfolio cash flow and delivery KPIs. Filters are status and period (a calendar year). The page is read-only.
The engine maths (`summarizePortfolio`, `aggregatePortfolio`, `mergeCashflows`, `clipCashflow`) is described in
[budget-engine.md](budget-engine.md); this doc covers the API and the web page.

## Data flow
1. The web calls `GET /api/analytics/portfolio?today=<useToday()>` under key `['analytics','portfolio']`
   (`apps/web/src/features/analytics/use-portfolio.ts:11`). Sending "today" makes the web and the API agree on
   schedule statuses.
2. The API runs **one** `project.findMany` with `isTemplate: false` and `include: { budgetLines, items, deliveries }`,
   ordered by `startDate`, then `name` (`apps/api/src/analytics/analytics.service.ts:43`).
3. `summarizePortfolioExtended` builds per-project rows and totals (`analytics.service.ts:48`); each row gets its own
   `monthlyCashflow(...).months` (`:59`) and `delivery` stats (`:63`); the top-level `cashflow` is
   `mergeCashflows` of the rows (`:71`).
4. The web parses the body with `analyticsResponseSchema` (`apps/web/src/features/analytics/analytics-schema.ts:16`)
   and filters on the client with `filterPortfolio` (`filter-portfolio.ts:49`), which reuses the engine's
   `aggregatePortfolio`, so filtered KPIs are computed by the same code as the server totals.

## Key files
- `apps/api/src/analytics/analytics.controller.ts:9` — `GET /analytics/portfolio`, query DTO `PortfolioQueryDto`.
- `apps/api/src/analytics/dto/portfolio-query.dto.ts:5` — optional `today`, validated by the shared `@IsIsoDate()`
  (real `YYYY-MM-DD` date), otherwise 400.
- `apps/api/src/analytics/analytics.service.ts:35` — `defaultToday()`: env `DEMO_TODAY` (`today` → current UTC
  date), else `DEFAULT_DEMO_TODAY = '2026-10-14'` (`:12`).
- `apps/api/src/analytics/analytics.service.ts:15` — `PortfolioResponse`: contract type plus the CR-11 fields
  `startDate`, `endDate`, `overrunLineCount`, `cashflow`, `delivery`.
- `apps/api/src/analytics/delivery-stats.ts:16` — `deliveryStats(items, deliveries, today)`: block 10's KPI rules.
- `apps/web/src/features/analytics/analytics-page.tsx:106` — page; filters in the URL (`?status=&period=`, `:109`),
  `<h1>Analytics</h1>` rendered outside the loading/error/empty branches (`:284`).
- `apps/web/src/features/analytics/filter-portfolio.ts:25` `periodYears`, `:38` `overlapsYear`, `:49` `filterPortfolio`.
- `apps/web/src/features/analytics/portfolio-kpis.tsx:37` — 8 KPIs: Approved, Spent, Open commitments,
  Forecast (EAC), Variance, Forecast profit, Average margin, Projects over budget `N of M`.
- `apps/web/src/features/analytics/projects-table.tsx:69` — sortable table (`aria-sort`, `:108`); row click →
  `/projects/:id/profitability` (`:135`); the name is also a real `<Link>` for the keyboard (`:142`).
- `apps/web/src/features/analytics/overrun-heatmap.tsx:24` — `heatTone`: `risk` when variance < 0, `ok` otherwise,
  `muted` when approved = forecast = 0; cell = variance % of approved.
- `apps/web/src/features/analytics/category-stack-chart.tsx:29` — stacked EAC by category per project (recharts).
- Charts reused from block 06: `BudgetVsForecastChart`, `CashflowSCurve` (`analytics-page.tsx:10`).

## Invariants
- Exactly one Prisma query per request; templates never appear (AC-11.2, `analytics.service.spec.ts`).
- Portfolio profitability is the **sum of per-project fields**, and `marginBps = toBps(Σ forecastProfit, Σ contractPrice)`
  (`libs/shared/budget-engine/src/lib/portfolio.ts:60`). It is never `computeProfitability(totals, one markup)`,
  because projects have different markups (AC-11.6).
- Period rule (owner decision): a project is kept when `startDate ≤ 'Y-12-31'` and `endDate ≥ 'Y-01-01'`
  (string compare, edges count). KPIs and the table cover the kept projects over their whole life; only the cash flow is
  clipped to the year, and its cumulatives keep the earlier history (`filter-portfolio.ts:59`).
- Delivery KPIs: `% on time = onTimeRows / deliveredRows` over DELIVERED rows of items that have a `deliveryDate`
  (on time when `date ≤ deliveryDate`); `overdueItems` = MATERIAL items with `checkSchedule` status `OVERDUE`
  (`delivery-stats.ts:24`, `:31`). They are computed from the same `findMany`, not from `/deliveries`.
- The page never throws on 404/500: skeleton, `ErrorState` with Retry, `EmptyState` with a "Calculate project" CTA
  for an empty portfolio, and "No projects match the filters" + Reset filters for a filtered-out view.

## Decisions and deviations from CONTRACTS
- CR-11 (applied in main 1e0fe11, `CONTRACT_VERSION 2`) added the optional per-project fields and the
  sum-of-fields profitability rule to CONTRACTS §5. The web schema makes them **required**
  (`portfolioProjectSchema.required(...)`, `analytics-schema.ts:8`) because this endpoint always sends them;
  a malformed body shows the error state. There is no `local-types.ts` as first planned.
- "Average margin" = Σ forecast profit / Σ contract price (weighted). Default applied; still open for the owner.
- Filters are client-side (one query, no refetch per filter); the query key stays `['analytics','portfolio']`
  since "today" is a build constant. Any successful save invalidates `['analytics']`.
- The heatmap and the cost-structure chart sit side by side only at `2xl` (`analytics-page.tsx:253`);
  at 1440 px the heatmap was clipped.

## Tests
- API: `apps/api/src/analytics/analytics.service.spec.ts` (AC-11.2, AC-11.11; `monthlyCashflow` is mocked with a
  fixed series, 06 tests the function itself).
- Web: `analytics-page.spec.tsx`, `filter-portfolio.spec.ts`, `overrun-heatmap.spec.tsx` (AC-11.3–11.5, 11.8–11.10, 11.12).
- e2e: `apps/web-e2e/src/analytics.spec.ts:38` [AC-11.13] (a duplicated Taucha appears and changes Approved; no
  absolute counts) and `:66` [AC-11.5] (Completed leaves only Markranstädt).

## Known gaps
- The period is whole years only (no date range).
- No drill-down from a heatmap cell to the category tab.
- EAC is not time-sliced: a period filter does not clip KPIs.
