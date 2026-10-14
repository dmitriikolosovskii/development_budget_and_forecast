import { z } from 'zod';

export const healthStatusSchema = z.object({
  status: z.literal('ok'),
  db: z.enum(['up', 'down']),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
