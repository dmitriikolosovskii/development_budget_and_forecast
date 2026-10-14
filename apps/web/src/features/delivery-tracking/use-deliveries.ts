import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  deliverySchema,
  importResultSchema,
  type Delivery,
  type DeliveryImportInput,
  type ImportResult,
} from '@default-project/types';
import { ApiError, apiGet, apiPost, seg } from '../../lib/api-client';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';

/** The delivery log of a project (`GET /projects/:id/deliveries`), newest first. */
export function useDeliveries(projectId: string) {
  return useQuery({
    queryKey: queryKeys.deliveries(projectId),
    queryFn: async (): Promise<Delivery[]> =>
      z
        .array(deliverySchema)
        .parse(await apiGet(`/projects/${seg(projectId)}/deliveries`)),
    enabled: projectId !== '',
  });
}

/**
 * Sends parsed rows to the import endpoint. Pending autosaves are flushed first so an older edit
 * cannot overwrite the imported dates/actuals; afterwards every view of the project refetches.
 */
export function useImportDeliveries(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeliveryImportInput): Promise<ImportResult> => {
      await autosaveQueue.flush();
      try {
        return importResultSchema.parse(
          await apiPost(`/projects/${seg(projectId)}/deliveries/import`, input),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 413)
          throw new Error('The file is too large: split it into smaller files');
        throw error;
      }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.project(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.deliveries(projectId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics() }),
      ]),
  });
}
