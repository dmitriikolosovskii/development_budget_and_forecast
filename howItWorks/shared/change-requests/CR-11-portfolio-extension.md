# CR-11-portfolio-extension
- Author: block 11 · Date: 2026-10-14
- Status: applied in main 1e0fe11 (merge: 00-integrator), CONTRACT_VERSION 2
- Affected: types (`libs/shared/types/src/lib/analytics.ts`), CONTRACTS §5 (analytics row), `apps/api/.env.example`
- Blocks affected: 11 only (additive, all fields optional)

## What to change (exact diff or field list)
1. `portfolioProjectSchema` — add optional fields:
   ```ts
   startDate: isoDateSchema.optional(),
   endDate: isoDateSchema.optional(),
   overrunLineCount: z.number().int().nonnegative().optional(),
   cashflow: z.array(cashflowMonthSchema).optional(),
   delivery: z.object({
     deliveredRows: z.number().int(),   // DELIVERED Delivery rows of items with a deliveryDate
     onTimeRows: z.number().int(),      // … with date ≤ item.deliveryDate (block 10's rule)
     overdueItems: z.number().int(),    // MATERIAL items with checkSchedule status OVERDUE
   }).optional(),
   ```
2. Comment on `portfolioAnalyticsSchema.profitability`: replace "profitability over the summed totals" with
   "sum of per-project profitability fields; `marginBps = toBps(Σ forecastProfit, Σ contractPrice)`" (projects have different markups, so `computeProfitability(totals, markup)` is undefined). Same wording in CONTRACTS §5.
3. CONTRACTS §5: `GET /analytics/portfolio?today=YYYY-MM-DD` (optional, the web sends `useToday()`; fallback `DEMO_TODAY` env, then `2026-10-14`).
4. `apps/api/.env.example`: `DEMO_TODAY=2026-10-14  # or "today"` (no block owns this file).

## Why it can't be done inside the block
`libs/shared/types/**` and `.env.example` are frozen / unowned. The owner decided the period filter works by project dates and clips the cash flow per filtered project set, which needs dates and per-project cash flow on the client.

## Local workaround in the meantime (file with TODO CR-11)
`apps/web/src/features/analytics/local-types.ts`: `analyticsResponseSchema = portfolioAnalyticsSchema.extend(...)` with the fields above; the API returns them already (no response serialiser strips extra fields). The engine's `summarizePortfolioExtended` returns them typed.
