import { z } from 'zod';
import {
  portfolioAnalyticsSchema,
  portfolioProjectSchema,
} from '@default-project/types';

// The CR-11 fields are optional in the shared contract; our endpoint always sends them, so the page requires them.
export const analyticsProjectSchema = portfolioProjectSchema.required({
  startDate: true,
  endDate: true,
  overrunLineCount: true,
  cashflow: true,
  delivery: true,
});

export const analyticsResponseSchema = portfolioAnalyticsSchema.extend({
  projects: z.array(analyticsProjectSchema),
});

export type AnalyticsProject = z.infer<typeof analyticsProjectSchema>;
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;
