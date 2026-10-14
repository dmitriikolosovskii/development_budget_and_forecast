# DESIGN — 06 Profitability (block spec, 2026-10-14)

## Goal / Non-goals
**Goal:** `/projects/:id/profitability` shows the CFO's final financial picture (hero cards, editable markup, budget-vs-forecast bars, waterfall, cost-structure donut, cash-flow S-curve, top overruns, assumptions), recalculated live from the shared snapshot cache. Plus the engine function `monthlyCashflow` (body of `cashflow.ts`) and chart components reusable by block 11.
**Non-goals:** any stored/derived state of our own; API changes; edits to frozen files (`budget-engine/src/index.ts`, routes, tabs-config, test-setup); portfolio aggregation (block 11); running e2e (integrator).

## Chosen approach: A — pure engine + one memoized hook + data-only charts
- `cashflow.ts`: pure, string-date month arithmetic.
- `use-profitability.ts`: one hook, `useMemo` over the cached snapshot; pure shaping in `profitability-data.ts`.
- `charts/`: presentational components with plain-data props, barrel `charts/index.ts` for block 11.

**Why not the others:** B (charts take `projectId` and compute) — block 11 has portfolio data with no snapshot, so it could not reuse them (11/BLOCK.md "reuse, don't copy"); N engine calls per edit. C (one big page) — nothing to export for 11, every test needs router+query.

## Judge constraints (mandatory)
1. Signature `monthlyCashflow(snapshot, today)` (CONTRACTS §3). Code against 01's stub; a mismatch → CR, never edit `index.ts`.
2. Dates as strings only: month index `y*12 + (m-1)` from `YYYY-MM`; no `Date`. Tests: year boundary, Feb 29, TZ independence.
3. Invariants: Σmonths + unscheduled = input totals in exact cents; months continuous; cumulatives monotonic (non-negative input). 01's "Not implemented" assertion (if any) is rewritten deliberately.
4. Markup: slider in bps 0–3000 step 50; text input keeps a local string draft parsed without `parseFloat`, clamped to 0–30 %, snapped to 0.5 %. No own debounce — `useEditProject` (optimistic + 400 ms queue). If it is not optimistic → note to 02.
5. Memo: summary + cashflow depend on items/budgetLines only; `computeProfitability` on summary + `markupBps`.
6. Charts: plain data; never import 06 hooks or `features/project`. Grouped bars `rows: {key,label,approved,actual,openCommitments,forecast}[]`; donut `slices: {key,label,value}[]`; S-curve `{months, todayMonth?}`; waterfall `steps`. Palette: 02's `CHART_COLORS`/`CATEGORY_COLORS` (as-built: no own `colors.ts`). Reuse 02's `ChartCard`, `EmptyState`, `Card`, `Badge`.
7. Zero states: EmptyState when no rows or donut sum 0; overrun % with approved 0 → "—"; contract price 0 → margin 0 (no NaN); erosion ≤ 0 not red; profit < 0 → risk tone + "Loss".
8. Top overruns: join `overrunLines` with `byLine`; category→tab map is local and fixed; names as plain text.
9. Page import is side-effect free; autosave queue reset between tests.

## Cash-flow rules (contract + documented assumptions)
| Value | Rule |
|---|---|
| planned / forecast, MATERIAL | month of `deliveryDate`; *assumption:* if missing, `deliveredDate` |
| planned / forecast, WORK/SERVICE | even split over months `[start ?? end, end ?? start]` inclusive; *assumption:* one date → that month; `end < start` → start month |
| split | `base = floor(total / n)`, first month gets `total − base·(n−1)` (10000/3 → 3334, 3333, 3333) |
| actual | month of `deliveredDate ?? endDate ?? startDate ?? today` |
| no plan date | planned + forecast → `unscheduled` (actual still by the rule above) |
| months | continuous from the first to the last month **that received any non-zero amount**; `today` does not extend it by itself; cumulatives are running sums; empty → `[]` |
Amounts: `itemPlannedCents`, `itemForecastCents` from the engine (no own formulas).

## Waterfall chain
`Approved (total)` → per category `forecast − approved` (overrun goes up, red; saving down, green) → `Forecast cost EAC (total)` → `Forecast profit` (= contractPrice − EAC, may be negative) → `Contract price (total)`. Markup (planned profit) is shown in the subtitle. Floating bars: `base = min(prev, next)`, `height = |Δ|`. Both ends reconcile exactly (tested).

## Affected files (all owned by 06 in `bin/blocks.conf`)
- `libs/shared/budget-engine/src/lib/cashflow.ts`, `cashflow.spec.ts`
- `apps/web/src/features/profitability/`: `profitability-page.tsx` (body), `use-profitability.ts`, `profitability-data.ts` + spec, `markup-editor.tsx`, `hero-cards.tsx`, `top-overruns-table.tsx`, `assumptions-card.tsx`, `charts/{chart-types.ts, chart-frame.tsx, budget-vs-forecast-chart.tsx, waterfall-chart.tsx, cost-structure-donut.tsx, cashflow-s-curve.tsx, index.ts}`, `*.spec.tsx`
- `apps/web-e2e/src/profitability.spec.ts`

## Risks
- 01's stub signature differs → CR (medium). 02's `useEditProject` not optimistic → note to 02, local fallback (medium). recharts in jsdom → as-built: numbers are tested on pure functions, charts smoke-rendered with a local ResizeObserver stub (02's ChartCard always uses ResponsiveContainer, so no fixed-size props) (low). Integer overflow: totals use Number, safe up to 2^53 cents.

## Test strategy (tags `[AC-06.N]`)
- AC-06.1 cashflow: split 3334/3333/3333; MATERIAL by delivery month; actual by deliveredDate; undated → unscheduled; continuous months; monotonic cumulatives.
- AC-06.2 markup 12 % → contract price/profit/margin immediately; nothing at 399 ms, one PATCH `{markupBps:1200}` at 400 ms; clamp and 0.5 % snap.
- AC-06.3 `useEditItem` edit changes EAC and profit on the page without reload.
- AC-06.4 negative profit → risk tone + "Loss".
- AC-06.5 every chart renders EmptyState with empty data (and donut with all-zero slices).
- AC-06.6 overrun row click → `/projects/:id/materials/concrete`.
- AC-06.7 (e2e, integrator) markup 15 → 12 changes profit/margin; Materials qty edit changes Profitability forecast.
- AC-06.8 sum invariant on a mixed snapshot (planned, forecast, actual).
- AC-06.9 `end < start` → all in the start month; one-date WORK → one month.
- AC-06.10 year boundary (Nov→Jan = 3 months) and Feb 29 land in the right month.
- AC-06.11 empty snapshot → `months: []`, unscheduled zeros.
- AC-06.12 waterfall: first = approved, after categories = EAC, last = contract price; negative step base/height.
- AC-06.13 contract price 0 → margin 0 %, no NaN; erosion ≤ 0 not red.

## How to verify
`bash $BIN/check.sh 06` (= ownership, format, affected lint/test/typecheck/build, weakening) and `bash $BIN/ac-ledger.sh --block 06 --root $WT`. e2e: the integrator runs `apps/web-e2e/src/profitability.spec.ts`.

## Open questions
None for the owner; the cash-flow assumptions above go to SOLUTION.md via HANDOFF.

## As-built (2026-10-14)
Merged into main as f347fc9. Implemented as designed. Commits on `feat/06-profitability`: cashflow engine, UI, e2e spec, lint fix. `check.sh 06` PASS; AC ledger OK=12, AC-06.7 UNRUN (e2e, integrator). Deviations: palette and chart sizing as noted above; `ChartFrame` (`charts/chart-frame.tsx`) wraps `ChartCard` + the empty state. Details and examples are in HANDOFF.md.
