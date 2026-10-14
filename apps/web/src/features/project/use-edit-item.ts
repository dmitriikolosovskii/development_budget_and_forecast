import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { costItemSchema, type CostItem } from '@default-project/types';
import { apiPatch, seg } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { autosaveEdit } from './autosave-edit';
import { applyItemPatch, cacheKey, type ProjectCache } from './project-cache';

/** Stable `(itemId, patch) => void`: optimistic, autosaved after 400 ms, rollback + toast on error. */
export function useEditItem(projectId: string): (itemId: string, patch: Partial<CostItem>) => void {
  const qc = useQueryClient();
  return useCallback(
    (itemId, patch) => {
      const key = queryKeys.project(projectId);
      autosaveEdit<CostItem>(
        qc,
        {
          queueKey: cacheKey.item(itemId),
          cancel: [key],
          read: () => qc.getQueryData<ProjectCache>(key)?.itemsById[itemId],
          write: (p) => qc.setQueryData<ProjectCache>(key, (c) => c && applyItemPatch(c, itemId, p)),
          send: async (merged) =>
            costItemSchema.parse(
              await apiPatch(`/projects/${seg(projectId)}/items/${seg(itemId)}`, merged, { keepalive: true }),
            ),
        },
        patch,
      );
    },
    [qc, projectId],
  );
}
