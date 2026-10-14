import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { SearchResult } from '@default-project/types';
import { apiGet } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 64;
export const SEARCH_DEBOUNCE_MS = 250;

/** The API answers 400 outside 2..64 trimmed characters, so we never ask. */
export function isSearchable(q: string): boolean {
  const length = q.trim().length;
  return length >= SEARCH_MIN_LENGTH && length <= SEARCH_MAX_LENGTH;
}

/** `GET /api/search?q=` under `['search', q]` (q trimmed); disabled for unsearchable input. */
export function useSearch(rawQuery: string) {
  const q = rawQuery.trim();
  return useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => apiGet<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
    enabled: isSearchable(q),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
