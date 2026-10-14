import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiDelete, seg } from '../../lib/api-client';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { showToast } from '../../lib/toast-store';
import { invalidateRollups } from './autosave-edit';
import { cacheKey, removeItem, type ProjectCache } from './project-cache';

/** `(itemId) => Promise<void>`: the row disappears at once and comes back with a toast on failure. */
export function useDeleteItem(projectId: string): (itemId: string) => Promise<void> {
  const qc = useQueryClient();
  return useCallback(
    async (itemId) => {
      const key = queryKeys.project(projectId);
      autosaveQueue.discard(cacheKey.item(itemId));
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<ProjectCache>(key);
      qc.setQueryData<ProjectCache>(key, (c) => c && removeItem(c, itemId));
      try {
        await apiDelete(`/projects/${seg(projectId)}/items/${seg(itemId)}`);
        invalidateRollups(qc);
      } catch (error) {
        if (before) qc.setQueryData<ProjectCache>(key, before);
        showToast(`Could not delete the row: ${error instanceof Error ? error.message : 'unknown error'}`, 'risk');
        throw error;
      }
    },
    [qc, projectId],
  );
}
