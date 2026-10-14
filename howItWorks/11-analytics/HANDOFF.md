# HANDOFF — 11-analytics

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
done: `check.sh 11` → CHECK: PASS (ownership, format, affected lint/test/typecheck/build, test weakening: all exit 0); AC ledger OK=12, AC-11.13 (e2e) UNRUN until the integrator runs it. Merged into main 20ebf66 (`merge-block.sh 11`, 11:57; branch head f0d75e8).

## Ready for neighbours (exports / components / endpoints, with examples)
Engine (`@default-project/budget-engine`, `portfolio.ts`):
```ts
summarizePortfolio(snapshots)            // frozen signature: Omit<PortfolioAnalytics, 'cashflow'>
summarizePortfolioExtended(snapshots)    // + per project startDate, endDate, overrunLineCount
aggregatePortfolio(projects)             // { totals, byCategory, profitability } of any subset of rows
mergeCashflows(monthsPerProject)         // sum by month, continuous months, cumulatives recomputed
clipCashflow(months, 'YYYY-MM', 'YYYY-MM') // slice; cumulatives keep earlier history
```
Portfolio profitability = sum of per-project profitability fields, `marginBps = toBps(Σ forecastProfit, Σ contractPrice)`.

API: `GET /api/analytics/portfolio?today=YYYY-MM-DD` → `PortfolioAnalytics` + per project `startDate`, `endDate`, `overrunLineCount`, `cashflow: CashflowMonth[]`, `delivery: { deliveredRows, onTimeRows, overdueItems }` (block 10's KPI rules). `today` is optional (400 if malformed); fallback env `DEMO_TODAY` (`today` = current date), then `2026-10-14`.
Web: query key `['analytics','portfolio']` (invalidated by `['analytics']`).

## How to check
- `bash $BIN/check.sh 11`; `bash $BIN/ac-ledger.sh --block 11 --root $WT`.
- Unit: `npx nx test budget-engine --testPathPatterns=portfolio`, `npx nx test api --testPathPatterns=src/analytics`, `npx nx test web -- src/features/analytics`.
- e2e (main tree): `bash howItWorks/bin/e2e.sh --grep analytics` (duplicates Taucha in `beforeEach`; asserts no absolute counts).
- By hand: `/analytics` → 8 KPIs, 3 projects (template hidden); Status = Completed → only Markranstädt; period chip 2027 → Taucha + Markkleeberg, cash flow 2027 only; a row click → that project's Profitability tab.

## Web files (`apps/web/src/features/analytics/`)
`analytics-page.tsx` (page, filters in the URL `?status=&period=`), `use-portfolio.ts` (query `['analytics','portfolio']`, sends `?today=useToday()`), `analytics-schema.ts` (response schema = contract + required CR-11 fields), `filter-portfolio.ts` (pure: `filterPortfolio`, `overlapsYear`, `periodYears`), `portfolio-kpis.tsx`, `projects-table.tsx` (sortable, `aria-sort`), `overrun-heatmap.tsx` (`heatTone`, `CATEGORY_LABELS`), `category-stack-chart.tsx`, `portfolio-fixture.ts` (test data). Charts reused from 06: `BudgetVsForecastChart` (rows = projects), `CashflowSCurve`.

## Gaps, CRs, deviations from CONTRACTS
- CR-11 applied (main 1e0fe11): optional per-project fields above; portfolio profitability = sum of per-project values, margin = Σ forecast profit / Σ contract price ("Average margin"; default applied, still open for the owner to confirm).
- Owner decision: "period" = projects whose dates overlap the year; KPIs whole-life; only the cash flow is clipped (cumulatives keep earlier months).
- Delivery KPIs use block 10's rules but are computed from the analytics query (no call to `/deliveries`).
- For SOLUTION.md: API "today" = `?today` → env `DEMO_TODAY` (`today` = current date) → `2026-10-14`.
- Not done: date-range period (years only); per-category drill-down from the heatmap.
