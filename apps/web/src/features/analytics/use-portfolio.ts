import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { useToday } from '../project/use-today';
import {
  analyticsResponseSchema,
  type AnalyticsResponse,
} from './analytics-schema';

/** `GET /analytics/portfolio` (key `['analytics','portfolio']`); the API uses the same "today" as the web. */
export function usePortfolio() {
  const today = useToday();
  return useQuery({
    queryKey: queryKeys.analyticsPortfolio(),
    queryFn: async (): Promise<AnalyticsResponse> =>
      analyticsResponseSchema.parse(
        await apiGet<unknown>(
          `/analytics/portfolio?today=${encodeURIComponent(today)}`,
        ),
      ),
  });
}
