import { z } from 'zod';
import {
  cashflowMonthSchema,
  categorySummariesSchema,
  profitabilitySchema,
  summarySchema,
} from './budget-summary';
import { projectStatusSchema } from './enums';
import { idSchema, isoDateSchema } from './money';

export const portfolioProjectSchema = z.object({
  projectId: idSchema,
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  status: projectStatusSchema,
  summary: summarySchema,
  profitability: profitabilitySchema,
  byCategory: categorySummariesSchema,
  /** CR-11: optional, for the period filter and per-project charts */
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  overrunLineCount: z.number().int().nonnegative().optional(),
  cashflow: z.array(cashflowMonthSchema).optional(),
  delivery: z
    .object({
      /** DELIVERED Delivery rows of items that have a deliveryDate */
      deliveredRows: z.number().int().nonnegative(),
      /** … of those, delivered on or before item.deliveryDate */
      onTimeRows: z.number().int().nonnegative(),
      /** MATERIAL items whose checkSchedule status is OVERDUE */
      overdueItems: z.number().int().nonnegative(),
    })
    .optional(),
});
export type PortfolioProject = z.infer<typeof portfolioProjectSchema>;

/** `GET /analytics/portfolio` (block 11). */
export const portfolioAnalyticsSchema = z.object({
  totals: summarySchema,
  /** sum of the per-project profitability fields; `marginBps = toBps(Σ forecastProfit, Σ contractPrice)` (projects have different markups, CR-11) */
  profitability: profitabilitySchema,
  projects: z.array(portfolioProjectSchema),
  byCategory: categorySummariesSchema,
  cashflow: z.array(cashflowMonthSchema),
});
export type PortfolioAnalytics = z.infer<typeof portfolioAnalyticsSchema>;
