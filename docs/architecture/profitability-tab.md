<!-- paths: apps/web/src/features/profitability/**, apps/web-e2e/src/profitability.spec.ts | Profitability tab and reusable charts -->
# Profitability tab (block 06)

Route `/projects/:projectId/profitability` → `ProfitabilityPage`. The CFO's final picture, recalculated live
from the shared snapshot cache: hero cards (approved, contract price, forecast EAC, forecast profit, margin,
planned profit, erosion) with an editable company markup, budget-vs-forecast bars per category, a waterfall
from approved to contract price, a cost-structure donut, a cash-flow S-curve, the top overruns table and an
assumptions card. The engine function `monthlyCashflow` (body of `cashflow.ts`) also belongs to block 06; its
rules are documented in [budget-engine.md](budget-engine.md).

## Key files
- `apps/web/src/features/profitability/profitability-page.tsx:22` `ProfitabilityPage`; markup change → `useEditProject({ markupBps })` (:26); skeleton while loading, `ErrorState` on error.
- `use-profitability.ts:14` `useProfitability`: three `useMemo`s over the cache — `summarizeProject` on `items`/`budgetLines` (:22), `monthlyCashflow(…, today)` (:29), `computeProfitability(rollup.project, markupBps)` (:36).
- `profitability-data.ts` (pure, unit-tested): `MARKUP_MAX_BPS = 3000`, `MARKUP_STEP_BPS = 50` (:22-:23), `categoryRows` :26, `costSlices` :41, `waterfallData` :54, `overrunRows` :115, `marginTone` :132, `parseMarkupPercent` :140.
- `markup-editor.tsx:17` `MarkupEditor`: text input "Company markup %" (string draft, parsed without float) + range slider (:55) "Company markup slider".
- `hero-cards.tsx:37` `HeroCards` (`Loss`/`Profit` label + risk tone at :78; test ids `hero-*`).
- `top-overruns-table.tsx:15` `TopOverrunsTable`; row click → `lineHref(...)` from 02 (:43).
- `assumptions-card.tsx:3` `AssumptionsCard` (cash-flow and markup assumptions in plain text).
- Charts barrel `charts/index.ts` (`BudgetVsForecastChart`, `WaterfallChart`, `CostStructureDonut`, `CashflowSCurve`, `compactEur`, types in `chart-types.ts`); `charts/chart-frame.tsx:15` `ChartFrame` = 02's `ChartCard` + empty state (`data-testid="chart-empty"` :25). Reused by Analytics (`apps/web/src/features/analytics/analytics-page.tsx`).
- Engine: `libs/shared/budget-engine/src/lib/cashflow.ts:39` `monthlyCashflow`.
- e2e `apps/web-e2e/src/profitability.spec.ts:24` (markup 15 → 12 → reload) and `:56` (Materials qty edit on `MAT-ELE-008` changes the forecast) [AC-06.7].

## Invariants
- No stored or derived state of its own: everything is a memo over the one cached `ProjectCache`.
  Summary and cash flow depend only on `items`/`budgetLines`; profitability on summary + `markupBps`.
- Markup: 0–30 %, snapped to 0.5 % (bps step 50); invalid text shows a hint and saves nothing; no own
  debounce — 02's queue sends one PATCH `{markupBps}` 400 ms after the last change.
- Charts take plain data (integer cents), import no hooks and nothing from `features/project`, so 11 can feed
  portfolio data; colours come from 02's `CHART_COLORS`/`CATEGORY_COLORS`.
- Zero states: empty rows or a zero donut sum → EmptyState; overrun % with approved 0 → "—"; contract price
  0 → margin 0 (no NaN); profit < 0 → risk tone + "Loss"; erosion ≤ 0 is not red.
- Waterfall reconciles exactly: approved → per-category `forecast − approved` → EAC → forecast profit →
  contract price. Markup is shown in the subtitle, not as a step (it is charged on approved, so EAC + markup ≠
  contract price when there is an overrun).

## Decisions / deviations
- No own palette file: 02's colours. Charts have no fixed width/height props (02's `ChartCard` always wraps
  them in `ResponsiveContainer`); numbers are tested on the pure functions, charts are smoke-rendered.
- Top overruns link through 02's `lineHref` instead of a local category → tab map.
- Cash-flow assumptions beyond CONTRACTS (MATERIAL without `deliveryDate` uses `deliveredDate`, one-date
  WORK in that month, `end < start` → start month, month range = months with non-zero amounts) are in
  budget-engine.md and SOLUTION.md.

## Known gaps
- jsdom chart renders log recharts "width(0)" warnings (harmless); no visual regression test.
- Unscheduled forecast is only mentioned in the S-curve subtitle, not plotted.
