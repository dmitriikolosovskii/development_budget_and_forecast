import { useCallback } from 'react';
import { checkSchedule } from '@default-project/budget-engine';
import type { ScheduleResult } from '@default-project/types';
import { useProjectSnapshot } from './use-project-snapshot';
import { useToday } from './use-today';
import type { ProjectCache } from './project-cache';

const EMPTY: Record<string, ScheduleResult> = {};

/** `checkSchedule(items, useToday())`, recomputed only when the cache changes. */
export function useSchedule(projectId: string): Record<string, ScheduleResult> {
  const today = useToday();
  const select = useCallback((c: ProjectCache) => checkSchedule(c.items, today), [today]);
  return useProjectSnapshot(projectId, select).data ?? EMPTY;
}
