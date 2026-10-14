import { z } from 'zod';
import { utilityStatusSchema, utilityTypeSchema } from './enums';
import { bpsSchema, centsSchema, idSchema, timestampSchema } from './money';

const nonNegInt = z.number().int().min(0).max(2_000_000_000);

export const utilityConnectionSchema = z.object({
  id: idSchema,
  landId: idSchema,
  type: utilityTypeSchema,
  status: utilityStatusSchema,
  distanceM: nonNegInt.nullable(),
  provider: z.string().nullable(),
  notes: z.string().nullable(),
});
export type UtilityConnection = z.infer<typeof utilityConnectionSchema>;

export const landParcelSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  address: z.string(),
  postalCode: z.string(),
  municipality: z.string(),
  district: z.string().nullable(),
  state: z.string(),
  cadastralRef: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  areaM2: nonNegInt,
  plotWidthCm: nonNegInt,
  plotDepthCm: nonNegInt,
  landValuePerM2Cents: centsSchema,
  zoningPlan: z.string(),
  grzBps: bpsSchema,
  gfzBps: bpsSchema,
  maxStoreys: z.number().int().min(0).max(20),
  roofRules: z.string(),
  buildingLineNotes: z.string().nullable(),
  soilType: z.string(),
  soilClass: z.string(),
  bearingCapacityKnM2: nonNegInt.nullable(),
  groundwaterDepthCm: nonNegInt.nullable(),
  contaminationNotes: z.string().nullable(),
  slopeNotes: z.string().nullable(),
  orientation: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type LandParcel = z.infer<typeof landParcelSchema>;
export type LandWithUtilities = LandParcel & { utilities: UtilityConnection[] };

/** `PATCH /projects/:id/land` (block 07): partial upsert of the parcel. */
export const updateLandInputSchema = landParcelSchema
  .omit({ id: true, projectId: true, createdAt: true, updatedAt: true })
  .partial();
export type UpdateLandInput = z.infer<typeof updateLandInputSchema>;

/** `PATCH /projects/:id/land/utilities/:type` (block 07): upsert by type. */
export const upsertUtilityInputSchema = utilityConnectionSchema
  .omit({ id: true, landId: true, type: true })
  .partial({ distanceM: true, provider: true, notes: true });
export type UpsertUtilityInput = z.infer<typeof upsertUtilityInputSchema>;
