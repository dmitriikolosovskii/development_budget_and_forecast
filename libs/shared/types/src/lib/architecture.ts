import { z } from 'zod';
import { houseSectionSchema, unitSchema } from './enums';
import { idSchema, qtyMilliSchema, timestampSchema } from './money';

const cm = z.number().int().min(0).max(1_000_000);
const offsetCm = z.number().int().min(-1_000_000).max(1_000_000);

export const ROOM_KINDS = [
  'living',
  'kitchen',
  'bedroom',
  'bath',
  'wc',
  'hall',
  'utility',
  'storage',
  'office',
  'stairs',
] as const;
export const roomKindSchema = z.enum(ROOM_KINDS);
export type RoomKind = z.infer<typeof roomKindSchema>;

export const roomSchema = z.object({
  id: idSchema,
  planId: idSchema,
  code: z.string().min(1),
  floor: z.number().int().min(-1).max(5),
  name: z.string(),
  kind: z.string(),
  xCm: cm,
  yCm: cm,
  wCm: cm,
  hCm: cm,
  sortOrder: z.number().int(),
});
export type Room = z.infer<typeof roomSchema>;

export const boqComponentSchema = z.object({
  id: idSchema,
  planId: idSchema,
  code: z.string().min(1),
  houseSection: houseSectionSchema,
  name: z.string(),
  unit: z.string(),
  qtyMilli: qtyMilliSchema,
  materialSection: z.string().nullable(),
  notes: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type BoqComponent = z.infer<typeof boqComponentSchema>;

export const architecturePlanSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: z.string(),
  architectOrgId: idSchema.nullable(),
  style: z.string(),
  storeys: z.number().int().min(1).max(5),
  roofType: z.string(),
  roofPitchDeg: z.number().int().min(0).max(90),
  energyStandard: z.string(),
  heatingSystem: z.string(),
  occupants: z.number().int().min(0).max(50),
  footprintWidthCm: cm,
  footprintDepthCm: cm,
  siteOffsetXcm: offsetCm,
  siteOffsetYcm: offsetCm,
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type ArchitecturePlan = z.infer<typeof architecturePlanSchema>;
export type PlanWithDetails = ArchitecturePlan & {
  rooms: Room[];
  components: BoqComponent[];
};

/** Inputs for block 08 (`/projects/:id/plan…`). */
export const updatePlanInputSchema = architecturePlanSchema
  .omit({ id: true, projectId: true, createdAt: true, updatedAt: true })
  .partial();
export type UpdatePlanInput = z.infer<typeof updatePlanInputSchema>;

export const createRoomInputSchema = roomSchema
  .omit({ id: true, planId: true, kind: true })
  .extend({
    kind: roomKindSchema,
    sortOrder: z.number().int().min(0).optional(),
  });
export type CreateRoomInput = z.infer<typeof createRoomInputSchema>;
export const updateRoomInputSchema = createRoomInputSchema.partial();
export type UpdateRoomInput = z.infer<typeof updateRoomInputSchema>;

export const createBoqComponentInputSchema = boqComponentSchema
  .omit({ id: true, planId: true, unit: true })
  .extend({
    unit: unitSchema,
    materialSection: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  });
export type CreateBoqComponentInput = z.infer<
  typeof createBoqComponentInputSchema
>;
export const updateBoqComponentInputSchema =
  createBoqComponentInputSchema.partial();
export type UpdateBoqComponentInput = z.infer<
  typeof updateBoqComponentInputSchema
>;
