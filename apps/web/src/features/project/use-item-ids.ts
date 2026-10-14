import { useCallback } from 'react';
import { useProjectSnapshot } from './use-project-snapshot';
import type { ProjectCache } from './project-cache';

const EMPTY: string[] = [];

/** Row ids of a budget line, in display order; identity is stable while membership is unchanged. */
export function useItemIds(projectId: string, lineId: string): string[] {
  const select = useCallback((c: ProjectCache) => c.itemIdsByLineId[lineId] ?? EMPTY, [lineId]);
  return useProjectSnapshot(projectId, select).data ?? EMPTY;
}
