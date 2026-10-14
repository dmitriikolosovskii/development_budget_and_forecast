# 06 — "Profitability" tab: markup, profit, charts, cash flow

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `06`). Start: `bash $BIN/bootstrap.sh 06` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 06` → `bash $BIN/merge-block.sh 06`.

**Wave:** W1 · **Priority:** MUST · **Estimate:** 60 min · **Worktree:** `Kairon-wt/06-profitability` (gate and base: `bin/blocks.conf`)
**In parallel:** 04 and 05 change quantities, prices and dates. Your page is **derived only** from the shared snapshot cache through the engine (`summarizeProject`, `computeProfitability`, `monthlyCashflow`). Store or compute nothing yourself, so cross-tab recalculation happens automatically.
**Later:** 11 analytics reuses your chart components across the portfolio. Export them from `features/profitability/charts/` and describe them in HANDOFF (blocks may import each other's *components*, but not the internals of other features).

## Goal
Route `/projects/:id/profitability`: the project's final financial picture for the CFO, recalculated live.

## You own
`apps/web/src/features/profitability/**` (body of `profitability-page.tsx`, export `ProfitabilityPage`), the body of `libs/shared/budget-engine/src/lib/cashflow.ts` + `cashflow.spec.ts`, `apps/web-e2e/src/profitability.spec.ts`.

## Page content
1. **Hero cards:**
   - Approved budget
   - Company markup: an editable % (input + slider 0–30 %, step 0.5 %, `useEditProject` → `markupBps`)
   - Contract price
   - Forecast cost (EAC)
   - **Forecast profit** and **margin %**
   - Planned profit, and **profit erosion** (planned − forecast), in red when > 0
2. **Budget vs forecast by category**: grouped bars (Approved / Actual / Open commitments / Forecast) for LAND, ARCHITECTURE, MATERIALS, CONSTRUCTION, MARKETING.
3. **Waterfall "From approved budget to forecast"**: approved → ± variance per category → EAC → markup → contract price → profit. Recharts stacked bar with an invisible base.
4. **Cost structure**: a donut of EAC by category.
5. **Cash flow S-curve**: cumulative planned / actual / forecast by month (`monthlyCashflow`), a "Today" line, and monthly bars.
6. **Top overruns**: a table of `overrunLines` (line, category, approved, forecast, overrun €, %), click → navigates to the tab/section.
7. The "Assumptions" block: amounts are net (excl. 19 % VAT), markup on the approved budget, the EAC rules (a short legend).

## Steps
1. `cashflow.ts`: implement it exactly to the contract (CONTRACTS §3: the planned/forecast/actual rules, the remainder in the first month, continuous months, `unscheduled`). If you need to change the return type, that's a CR.
2. `charts/` (recharts, colours from DESIGN-SYSTEM §1), each wrapped in `ChartCard` with an empty state.
3. `use-profitability.ts`: `useProjectSummary` + `computeProfitability` + `monthlyCashflow` in a memo.
4. Responsive: charts stack into one column on mobile; the hero cards become a 2×N grid.
5. e2e spec: markup 15 → 12 → profit and margin change; edit a quantity in Materials → the forecast on Profitability changed.

## Acceptance criteria
- AC-06.1 (Jest, engine) `monthlyCashflow`: a 3-month work item of 100.00 € → 33.34 + 33.33 + 33.33 (the remainder goes to the first month), the sum is exactly 10000 cents; MATERIAL goes into the delivery month; actual goes into the `deliveredDate` month; rows without dates go to `unscheduled`; there are no gaps in the months; cumulative values are monotonic.
- AC-06.2 (Vitest) Changing the markup to 12 % recalculates contract price, profit and margin immediately; one PATCH after 400 ms.
- AC-06.3 (Vitest) An edit through `useEditItem` (simulating the Materials tab) changes the page's EAC and profit without a reload (cross-tab).
- AC-06.4 (Vitest) Negative profit → red tone and the label "Loss".
- AC-06.5 (Vitest) Every chart renders with empty data (EmptyState, no crash).
- AC-06.6 (Vitest) Clicking a "Top overruns" row navigates to `/projects/:id/materials/concrete`.
- AC-06.7 (e2e, integrator) The scenario from step 5.
- AC-06.8 (Jest, engine) Sum invariant on a mixed snapshot: Σ months + `unscheduled` = project planned and forecast in exact cents; Σ months.actual = project actual.
- AC-06.9 (Jest, engine) WORK with `endDate < startDate` → everything in the start month; WORK with one date → that one month.
- AC-06.10 (Jest, engine) Year boundary (2026-11 → 2027-01 = 3 months) and 2028-02-29 → `2028-02`; no `Date`, so no timezone drift.
- AC-06.11 (Jest, engine) Empty snapshot → `months: []` and `unscheduled` zeros.
- AC-06.12 (Vitest) Waterfall data: starts at approved, reaches EAC after the category steps, ends at the contract price; a negative step has base = lower value and height = |Δ|.
- AC-06.13 (Vitest) Contract price 0 → margin 0 % (no NaN); profit erosion ≤ 0 is not red.

## Verify
`npx nx test budget-engine && npx nx test web && npx nx lint web budget-engine && npx nx typecheck web budget-engine`.
