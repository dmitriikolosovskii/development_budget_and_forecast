import { z } from 'zod';
import {
  architecturePlanSchema,
  boqComponentSchema,
  roomSchema,
} from './architecture';
import { budgetLineSchema } from './budget-line';
import { profitabilitySchema, summarySchema } from './budget-summary';
import { costItemSchema } from './cost-item';
import { deliverySchema } from './delivery';
import { landParcelSchema, utilityConnectionSchema } from './land';
import { organizationSchema } from './organization';
import { projectSchema } from './project';

/** `GET /projects/:id`: everything a project page needs, in one response (CONTRACTS §5). */
export const projectSnapshotSchema = z.object({
  project: projectSchema,
  budgetLines: z.array(budgetLineSchema),
  items: z.array(costItemSchema),
  /** organisations referenced by this project's items and plan */
  organizations: z.array(organizationSchema),
  land: landParcelSchema
    .extend({ utilities: z.array(utilityConnectionSchema) })
    .nullable(),
  plan: architecturePlanSchema
    .extend({
      rooms: z.array(roomSchema),
      components: z.array(boqComponentSchema),
    })
    .nullable(),
  deliveries: z.array(deliverySchema),
});
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;

/** `GET /projects` row: the project plus its engine rollup (templates excluded). */
export const projectListItemSchema = projectSchema.extend({
  summary: summarySchema,
  profitability: profitabilitySchema,
});
export type ProjectListItem = z.infer<typeof projectListItemSchema>;
