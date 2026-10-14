import { z } from 'zod';
import { idSchema } from './money';

export const SEARCH_RESULT_TYPES = [
  'project',
  'item',
  'organization',
  'line',
] as const;
export const searchResultTypeSchema = z.enum(SEARCH_RESULT_TYPES);
export type SearchResultType = z.infer<typeof searchResultTypeSchema>;

/** `GET /search?q=` row (block 13). */
export const searchResultSchema = z.object({
  type: searchResultTypeSchema,
  id: idSchema,
  projectId: idSchema.optional(),
  title: z.string(),
  subtitle: z.string(),
  href: z.string(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;
