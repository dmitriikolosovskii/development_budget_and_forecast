import { z } from 'zod';
import { projectStatusSchema } from './enums';
import { bpsSchema, idSchema, isoDateSchema, timestampSchema } from './money';

export const projectSchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  code: z.string(),
  status: projectStatusSchema,
  isTemplate: z.boolean(),
  clientName: z.string(),
  city: z.string(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  markupBps: bpsSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Project = z.infer<typeof projectSchema>;

/** `POST /projects`: an empty project with the default catalogue lines (approved 0). */
export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  clientName: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(200),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  markupBps: bpsSchema.optional(),
  status: projectStatusSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

/** `PATCH /projects/:id` */
export const updateProjectInputSchema = createProjectInputSchema
  .pick({
    name: true,
    clientName: true,
    city: true,
    status: true,
    startDate: true,
    endDate: true,
    markupBps: true,
  })
  .partial();
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

/** `POST /projects/:id/duplicate` */
export const duplicateProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
});
export type DuplicateProjectInput = z.infer<typeof duplicateProjectInputSchema>;
