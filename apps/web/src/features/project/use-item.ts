import { useCallback } from 'react';
import type { CostItem } from '@default-project/types';
import { useProjectSnapshot } from './use-project-snapshot';
import type { ProjectCache } from './project-cache';

/** One row; re-renders only when this row changes (returns `.data` only). */
export function useItem(projectId: string, itemId: string): CostItem | undefined {
  const select = useCallback((c: ProjectCache) => c.itemsById[itemId], [itemId]);
  return useProjectSnapshot(projectId, select).data;
}
