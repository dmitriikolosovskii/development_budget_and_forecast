import { z } from 'zod';
import { COST_CATEGORIES, costCategorySchema } from './enums';
import { idSchema, signedCentsSchema } from './money';

/** Rollup of rows for a line, a category or a project (CONTRACTS §3). All amounts in cents. */
export const summarySchema = z.object({
  approved: signedCentsSchema,
  planned: signedCentsSchema,
  committed: signedCentsSchema,
  actual: signedCentsSchema,
  openCommitments: signedCentsSchema,
  exposure: signedCentsSchema,
  forecast: signedCentsSchema,
  /** approved − forecast; negative = overrun */
  variance: signedCentsSchema,
  /** forecast > approved */
  overrun: z.boolean(),
  /** actual / approved in bps */
  spentBps: z.number().int(),
  /** forecast / approved in bps */
  forecastVsApprovedBps: z.number().int(),
});
export type Summary = z.infer<typeof summarySchema>;

export const lineSummarySchema = summarySchema.extend({
  lineId: idSchema,
  category: costCategorySchema,
  section: z.string(),
  name: z.string(),
});
export type LineSummary = z.infer<typeof lineSummarySchema>;

export const overrunLineSchema = z.object({
  lineId: idSchema,
  name: z.string(),
  category: costCategorySchema,
  section: z.string(),
  overrunCents: z.number().int(),
});
export type OverrunLine = z.infer<typeof overrunLineSchema>;

export const categorySummariesSchema = z.record(
  costCategorySchema,
  summarySchema,
);
export type CategorySummaries = Record<
  (typeof COST_CATEGORIES)[number],
  Summary
>;

export const projectSummarySchema = z.object({
  project: summarySchema,
  byCategory: categorySummariesSchema,
  byLine: z.record(z.string(), lineSummarySchema),
  overrunLines: z.array(overrunLineSchema),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const profitabilitySchema = z.object({
  approved: signedCentsSchema,
  contractPrice: signedCentsSchema,
  plannedProfit: signedCentsSchema,
  forecastProfit: signedCentsSchema,
  marginBps: z.number().int(),
  profitErosion: signedCentsSchema,
});
export type Profitability = z.infer<typeof profitabilitySchema>;

export const MATERIAL_SCHEDULE_STATUSES = [
  'DELIVERED',
  'UNSCHEDULED',
  'LATE_FOR_WORK',
  'OVERDUE',
  'AT_RISK',
  'ON_TIME',
] as const;
export type MaterialStatus = (typeof MATERIAL_SCHEDULE_STATUSES)[number];
export const WORK_SCHEDULE_STATUSES = [
  'READY',
  'BLOCKED',
  'INVALID_DATES',
] as const;
export type WorkStatus = (typeof WORK_SCHEDULE_STATUSES)[number];

export interface MaterialScheduleResult {
  kind: 'MATERIAL';
  status: MaterialStatus;
  needBy?: string;
  workId?: string;
  /** LATE_FOR_WORK only: deliveryDate − needBy in days */
  delayDays?: number;
  /** needBy − deliveryDate in days */
  slackDays?: number;
}
export interface WorkScheduleResult {
  kind: 'WORK';
  status: WorkStatus;
  blockingMaterials: string[];
  worstDelayDays: number;
}
export type ScheduleResult = MaterialScheduleResult | WorkScheduleResult;

export const cashflowMonthSchema = z.object({
  /** YYYY-MM */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  planned: signedCentsSchema,
  actual: signedCentsSchema,
  forecast: signedCentsSchema,
  cumulativePlanned: signedCentsSchema,
  cumulativeActual: signedCentsSchema,
  cumulativeForecast: signedCentsSchema,
});
export type CashflowMonth = z.infer<typeof cashflowMonthSchema>;

export const cashflowSchema = z.object({
  months: z.array(cashflowMonthSchema),
  unscheduled: z.object({
    planned: signedCentsSchema,
    forecast: signedCentsSchema,
  }),
});
export type Cashflow = z.infer<typeof cashflowSchema>;
