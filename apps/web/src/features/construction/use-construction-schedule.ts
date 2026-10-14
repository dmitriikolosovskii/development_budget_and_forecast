import { useCallback } from 'react';
import { checkSchedule } from '@default-project/budget-engine';
import type { CostItem, ScheduleResult } from '@default-project/types';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import type { ProjectCache } from '../project/project-cache';
import { useToday } from '../project/use-today';
import { readinessLabel, worstBlockerName } from './construction-model';

type Schedule = Record<string, ScheduleResult>;

// One engine run per cache version, shared by every row selector (rows subscribe to primitives only).
const memo = new WeakMap<CostItem[], { today: string; result: Schedule }>();

export function scheduleOf(items: CostItem[], today: string): Schedule {
  const hit = memo.get(items);
  if (hit && hit.today === today) return hit.result;
  const result = checkSchedule(items, today);
  memo.set(items, { today, result });
  return result;
}

export interface WorkReadiness {
  status: 'READY' | 'BLOCKED' | 'INVALID_DATES';
  label: string;
}

/** Readiness of one WORK row; re-renders only when its own label changes. */
export function useWorkReadiness(
  projectId: string,
  workId: string,
): WorkReadiness | undefined {
  const today = useToday();
  const select = useCallback(
    (c: ProjectCache): WorkReadiness | undefined => {
      const schedule = scheduleOf(c.items, today);
      const r = schedule[workId];
      if (!r || r.kind !== 'WORK') return undefined;
      return {
        status: r.status,
        label: readinessLabel(
          r.status,
          r.worstDelayDays,
          worstBlockerName(workId, c.itemsById, schedule),
        ),
      };
    },
    [today, workId],
  );
  return useProjectSnapshot(projectId, select).data;
}

export interface LinkedMaterial {
  id: string;
  code: string;
  name: string;
  section: string | null;
  status: string;
  late: boolean;
}

const EMPTY: LinkedMaterial[] = [];

/** Materials linked to one work (`requiredForWorkId`) with their schedule status; structurally shared. */
export function useLinkedMaterials(
  projectId: string,
  workId: string,
): LinkedMaterial[] {
  const today = useToday();
  const select = useCallback(
    (c: ProjectCache): LinkedMaterial[] => {
      const schedule = scheduleOf(c.items, today);
      return c.items
        .filter((i) => i.kind === 'MATERIAL' && i.requiredForWorkId === workId)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((m) => {
          const r = schedule[m.id];
          const status = r?.kind === 'MATERIAL' ? r.status : 'UNSCHEDULED';
          return {
            id: m.id,
            code: m.code,
            name: m.name,
            section: c.linesById[m.budgetLineId]?.section ?? null,
            status,
            late: status === 'LATE_FOR_WORK',
          };
        });
    },
    [today, workId],
  );
  return useProjectSnapshot(projectId, select).data ?? EMPTY;
}
