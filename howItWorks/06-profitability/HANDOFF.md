# HANDOFF — 06-profitability

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
done, `check.sh 06` → CHECK: PASS (ownership, format, affected lint/test/typecheck/build, test weakening). AC ledger: 12 OK, AC-06.7 (e2e) UNRUN, to be run by the integrator. Branch `feat/06-profitability` merged into main as **f347fc9** (11:53, `06.merged` set, which unblocks 11). check.sh after merging main: PASS.

## Ready for neighbours (exports / components / endpoints, with examples)

### Engine: `monthlyCashflow(snapshot, today)` (`libs/shared/budget-engine/src/lib/cashflow.ts`)
```ts
import { monthlyCashflow } from '@default-project/budget-engine';
const cf = monthlyCashflow({ items, budgetLines }, '2026-10-14'); // { months: CashflowMonth[], unscheduled: { planned, forecast } }
```
- planned/forecast (`itemPlannedCents`/`itemForecastCents`): MATERIAL → month of `deliveryDate` (fallback `deliveredDate`); WORK/SERVICE → evenly over `startDate..endDate` months inclusive; cent remainder in the first month (10000/3 → 3334, 3333, 3333).
- actual → month of `deliveredDate ?? endDate ?? startDate ?? today`.
- no plan date → `unscheduled`. `months` is continuous from the first to the last month with a non-zero amount (`today` does not extend it); empty → `[]`.
- Dates are handled as strings (month index `y*12+m`), no `Date`, so results don't depend on the timezone (tested under LA/Tokyo).
- **For 11 (portfolio):** sum `planned/actual/forecast` by month across projects, then **recompute** the cumulatives; summing per-project cumulatives with different month ranges is wrong.

### Charts: `apps/web/src/features/profitability/charts` (barrel `index.ts`)
Data-only props, integer cents, no hooks inside, so 11 can feed portfolio data. Every chart sits in 02's `ChartCard` (ResponsiveContainer) and shows an `EmptyState` card (`data-testid="chart-empty"`) when it has no data.
```tsx
import { BudgetVsForecastChart, CashflowSCurve, CostStructureDonut, WaterfallChart, compactEur,
         type CategoryBarRow, type DonutSlice, type WaterfallStep, type CashflowPoint } from '../profitability/charts';

<BudgetVsForecastChart title="Budget vs forecast by project"
  rows={projects.map((p) => ({ key: p.projectId, label: p.name, approved: p.summary.approved, actual: p.summary.actual,
                              openCommitments: p.summary.openCommitments, forecast: p.summary.forecast }))} />
<CostStructureDonut slices={[{ key: 'LAND', label: 'Land', value: cents }]} />   // colour: slice.color ?? CATEGORY_COLORS[key] ?? palette; empty when Σ = 0
<CashflowSCurve months={portfolio.cashflow} todayMonth="2026-10" title="Portfolio cash flow" />  // "Today" line only if the month is in range
<WaterfallChart steps={waterfallData(rollup, profitability)} />
```
Optional `title`/`subtitle` on every chart. Colours come from 02's `CHART_COLORS`/`CATEGORY_COLORS` (`ui/chart-card.tsx`).

### Page internals (06 only; import them if useful, but they are not a contract)
`features/profitability/profitability-data.ts`: `categoryRows`, `costSlices`, `waterfallData`, `overrunRows`, `parseMarkupPercent`, `marginTone`, `CATEGORY_LABELS`. `use-profitability.ts`: `useProfitability(projectId)` → `{ query, today, markupBps, rollup, cashflow, profitability }`.
Test ids on the page: `hero-approved`, `hero-contract-price`, `hero-forecast`, `hero-forecast-profit`, `hero-margin`, `hero-planned-profit`, `hero-erosion`; the markup input has the label `Company markup %` and the slider `Company markup slider`.

## How to check
- `bash $BIN/check.sh 06` → CHECK: PASS.
- `bash $BIN/ac-ledger.sh --root $WT --block 06` → OK=12, UNRUN=1 (AC-06.7, e2e).
- Unit: `npx nx test budget-engine` (83 tests, 11 cashflow), web `src/features/profitability` (30 tests).
- Red-proof (mutation applied, the tagged tests run, then restored): remainder in the last month → AC-06.1 red; months only where data exists (gaps) → AC-06.1 red ×2; waterfall profit step = planned profit → AC-06.12 red ×2; markup input doesn't save → AC-06.2 red; `marginTone` 0 → risk → AC-06.13 red; overrun click to the wrong href → AC-06.6 red; empty-state check off → AC-06.5 red.
- e2e (integrator): `bash howItWorks/bin/e2e.sh --grep "AC-06"` → `apps/web-e2e/src/profitability.spec.ts` (markup 15 → 12; cable qty on Materials → the Profitability forecast changes). Not run in the block.

## Gaps, CRs, deviations from CONTRACTS
- No CRs. The signature `monthlyCashflow(snapshot, today)` matches 01's stub.
- Assumptions for SOLUTION.md (the contract leaves them open): a MATERIAL without `deliveryDate` uses `deliveredDate`; a WORK/SERVICE row with one date counts in that month; `endDate < startDate` → the start month; the month range is the months with non-zero amounts.
- Waterfall: approved → (forecast − approved) per category → EAC → forecast profit → contract price. Markup isn't drawn as a separate step after EAC, because it is charged on approved, so EAC + markup ≠ contract price when there's an overrun. Planned profit (= markup) is shown in the subtitle.
- Markup input: parsed from the string (`12`, `12.5`, `12,5 %`), clamped to 0–30 % and snapped to 0.5 %; invalid text shows a hint and saves nothing. No debounce of our own: 02's `useEditProject` queue sends one PATCH 400 ms after the last change.
- Not done: the charts have no fixed `width/height` props for tests (02's `ChartCard` always wraps them in ResponsiveContainer). Unit tests check the numbers on the pure functions; in jsdom the charts are only smoke-rendered, which logs recharts "width(0)" warnings (harmless). There's no visual check, because blocks don't run `serve`.
