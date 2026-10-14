import { z } from 'zod';
import {
  costCategorySchema,
  utilityStatusSchema,
  utilityTypeSchema,
} from './enums';
import { bpsSchema, centsSchema, isoDateSchema } from './money';

export const ENERGY_STANDARDS = ['EH55', 'EH40'] as const;
export const HEATING_OPTIONS = ['HEAT_PUMP', 'GAS_HYBRID'] as const;
export const WALL_TYPES = ['SAND_LIME_ETICS', 'MONOLITHIC_BRICK'] as const;

/** `POST /projects/wizard` body (block 12, CONTRACTS §5). */
export const wizardInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  clientName: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(200),
  startDate: isoDateSchema,
  markupBps: bpsSchema,
  land: z.object({
    address: z.string().trim().min(1).max(300),
    postalCode: z.string().trim().min(1).max(20),
    municipality: z.string().trim().min(1).max(200),
    state: z.string().trim().min(1).max(100),
    areaM2: z.number().int().min(1).max(1_000_000),
    landValuePerM2Cents: centsSchema,
    grzBps: bpsSchema,
    gfzBps: bpsSchema,
    maxStoreys: z.number().int().min(1).max(20),
    soilClass: z.string().trim().min(1).max(100),
    groundwaterDepthCm: z.number().int().min(0).max(100_000).optional(),
    utilities: z.array(
      z.object({ type: utilityTypeSchema, status: utilityStatusSchema }),
    ),
  }),
  house: z.object({
    livingAreaM2: z.number().int().min(20).max(2000),
    storeys: z.union([z.literal(1), z.literal(2)]),
    energyStandard: z.enum(ENERGY_STANDARDS),
    heating: z.enum(HEATING_OPTIONS),
    wallType: z.enum(WALL_TYPES),
  }),
  /** optional: BLOCK 01 lists it as `approvedByCategory?`; when omitted the template amounts are scaled */
  approvedByCategory: z.record(costCategorySchema, centsSchema).optional(),
});
export type WizardInput = z.infer<typeof wizardInputSchema>;
