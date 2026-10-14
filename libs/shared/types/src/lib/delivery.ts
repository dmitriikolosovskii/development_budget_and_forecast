import { z } from 'zod';
import { deliveryKindSchema } from './enums';
import {
  centsSchema,
  idSchema,
  isoDateSchema,
  qtyMilliSchema,
  timestampSchema,
} from './money';

export const deliverySchema = z.object({
  id: idSchema,
  projectId: idSchema,
  costItemId: idSchema,
  batchId: idSchema.nullable(),
  deliveryNoteNo: z.string().min(1),
  kind: deliveryKindSchema,
  date: isoDateSchema,
  qtyMilli: qtyMilliSchema,
  invoiceCents: centsSchema.nullable(),
  createdAt: timestampSchema,
});
export type Delivery = z.infer<typeof deliverySchema>;

export const importRowErrorSchema = z.object({
  row: z.number().int().min(1),
  field: z.string().optional(),
  message: z.string(),
});
export type ImportRowError = z.infer<typeof importRowErrorSchema>;

export const importBatchSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  fileName: z.string(),
  totalRows: z.number().int().min(0),
  okRows: z.number().int().min(0),
  failedRows: z.number().int().min(0),
  errorsJson: z.string(),
  createdAt: timestampSchema,
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

/** One CSV row as sent by the client: raw strings, validated server-side row by row (CONTRACTS §5). */
export const DELIVERY_CSV_COLUMNS = [
  'itemCode',
  'deliveryNoteNo',
  'kind',
  'date',
  'quantity',
  'invoiceAmountEur',
] as const;
export const deliveryImportRowSchema = z.object({
  itemCode: z.string(),
  deliveryNoteNo: z.string(),
  kind: z.string(),
  date: z.string(),
  quantity: z.string(),
  invoiceAmountEur: z.string(),
});
export type DeliveryImportRow = z.infer<typeof deliveryImportRowSchema>;

export const deliveryImportInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  rows: z.array(deliveryImportRowSchema).max(5000),
});
export type DeliveryImportInput = z.infer<typeof deliveryImportInputSchema>;

export const importResultSchema = z.object({
  batchId: idSchema,
  totalRows: z.number().int().min(0),
  okRows: z.number().int().min(0),
  failedRows: z.number().int().min(0),
  errors: z.array(importRowErrorSchema),
  updatedItemIds: z.array(idSchema),
});
export type ImportResult = z.infer<typeof importResultSchema>;
