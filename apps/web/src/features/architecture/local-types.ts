import { z } from 'zod';
import { boqComponentSchema } from '@default-project/types';

/** `PATCH /projects/:id/plan/components/:componentId` response (CONTRACTS §5 row 08; not in shared types). */
export const componentUpdateResultSchema = z.object({
  component: boqComponentSchema,
  updatedItemIds: z.array(z.string()),
});
export type ComponentUpdateResult = z.infer<typeof componentUpdateResultSchema>;
