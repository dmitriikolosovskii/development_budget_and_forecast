import { z } from 'zod';
import { orgRoleSchema } from './enums';
import { idSchema, timestampSchema } from './money';

export const organizationSchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  role: orgRoleSchema,
  legalForm: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  website: z.string().nullable(),
  email: z.string(),
  phone: z.string(),
  contactPerson: z.string(),
  contactRole: z.string(),
  paymentTermsDays: z.number().int().min(0),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Organization = z.infer<typeof organizationSchema>;

export const createOrganizationInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: 'slug must be kebab-case' }),
  name: z.string().trim().min(1).max(200),
  role: orgRoleSchema,
  legalForm: z.string().max(100).nullable().optional(),
  address: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(200),
  website: z.string().max(300).nullable().optional(),
  email: z.email().max(200),
  phone: z.string().trim().min(1).max(50),
  contactPerson: z.string().trim().min(1).max(200),
  contactRole: z.string().trim().min(1).max(200),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreateOrganizationInput = z.infer<
  typeof createOrganizationInputSchema
>;

/** `PATCH /organizations/:id`: the slug is the seed key and is not editable. */
export const updateOrganizationInputSchema = createOrganizationInputSchema
  .omit({ slug: true })
  .partial();
export type UpdateOrganizationInput = z.infer<
  typeof updateOrganizationInputSchema
>;
