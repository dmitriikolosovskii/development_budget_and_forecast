import { z } from 'zod';
import { costCategorySchema } from './enums';
import { centsSchema, idSchema, timestampSchema } from './money';

export const budgetLineSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  category: costCategorySchema,
  section: z.string().min(1),
  name: z.string().min(1),
  approvedCents: centsSchema,
  sortOrder: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type BudgetLine = z.infer<typeof budgetLineSchema>;

export const createBudgetLineInputSchema = z.object({
  category: costCategorySchema,
  section: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      error: 'section must be a kebab-case slug',
    }),
  name: z.string().trim().min(1).max(200),
  approvedCents: centsSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type CreateBudgetLineInput = z.infer<typeof createBudgetLineInputSchema>;

/** Category and section are the line's identity and are not editable. */
export const updateBudgetLineInputSchema = createBudgetLineInputSchema
  .pick({ name: true, approvedCents: true, sortOrder: true })
  .partial();
export type UpdateBudgetLineInput = z.infer<typeof updateBudgetLineInputSchema>;
