import { z } from 'zod';
import { itemKindSchema, itemStatusSchema, unitSchema } from './enums';
import {
  centsSchema,
  idSchema,
  isoDateSchema,
  qtyMilliSchema,
  timestampSchema,
} from './money';

export const costItemSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  budgetLineId: idSchema,
  kind: itemKindSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  unit: z.string().min(1),
  qtyMilli: qtyMilliSchema,
  unitPriceCents: centsSchema,
  committedCents: centsSchema,
  actualCents: centsSchema,
  status: itemStatusSchema,
  supplierId: idSchema.nullable(),
  contractorId: idSchema.nullable(),
  deliveryDate: isoDateSchema.nullable(),
  deliveredDate: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  requiredForWorkId: idSchema.nullable(),
  boqComponentId: idSchema.nullable(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type CostItem = z.infer<typeof costItemSchema>;

const editableItemFields = {
  name: z.string().trim().min(1).max(300),
  description: z.string().max(2000).nullable(),
  unit: unitSchema,
  qtyMilli: qtyMilliSchema,
  unitPriceCents: centsSchema,
  committedCents: centsSchema,
  actualCents: centsSchema,
  status: itemStatusSchema,
  supplierId: idSchema.nullable(),
  contractorId: idSchema.nullable(),
  deliveryDate: isoDateSchema.nullable(),
  deliveredDate: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  requiredForWorkId: idSchema.nullable(),
  boqComponentId: idSchema.nullable(),
  sortOrder: z.number().int().min(0).max(100_000),
  notes: z.string().max(2000).nullable(),
  budgetLineId: idSchema,
};

/** `POST /projects/:id/items`. `null` clears a nullable field. */
export const createCostItemInputSchema = z.object({
  ...editableItemFields,
  kind: itemKindSchema,
  code: z
    .string()
    .trim()
    .regex(/^(MAT|WRK|SRV)-[A-Z]{3}-\d{3,}$/, {
      error: 'code must look like MAT-ELE-003',
    }),
  description: editableItemFields.description.optional(),
  committedCents: centsSchema.optional(),
  actualCents: centsSchema.optional(),
  status: itemStatusSchema.optional(),
  supplierId: editableItemFields.supplierId.optional(),
  contractorId: editableItemFields.contractorId.optional(),
  deliveryDate: editableItemFields.deliveryDate.optional(),
  deliveredDate: editableItemFields.deliveredDate.optional(),
  startDate: editableItemFields.startDate.optional(),
  endDate: editableItemFields.endDate.optional(),
  requiredForWorkId: editableItemFields.requiredForWorkId.optional(),
  boqComponentId: editableItemFields.boqComponentId.optional(),
  sortOrder: editableItemFields.sortOrder.optional(),
  notes: editableItemFields.notes.optional(),
});
export type CreateCostItemInput = z.infer<typeof createCostItemInputSchema>;

/** `PATCH /projects/:id/items/:itemId`: partial; `kind` and `code` are immutable. */
export const updateCostItemInputSchema = z.object(editableItemFields).partial();
export type UpdateCostItemInput = z.infer<typeof updateCostItemInputSchema>;
