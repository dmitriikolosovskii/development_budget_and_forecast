import { useCallback } from 'react';
import { checkSchedule } from '@default-project/budget-engine';
import { BUDGET_CATALOG, type BudgetLine, type CostItem, type Delivery, type ScheduleResult } from '@default-project/types';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { useToday } from '../project/use-today';
import type { ProjectCache } from '../project/project-cache';

export const MATERIAL_CATALOG = BUDGET_CATALOG.filter((s) => s.category === 'MATERIALS');

/** Row code prefix of a MATERIALS section (`electrical` → `ELE`). */
export function codePrefixOf(section: string): string | undefined {
  return MATERIAL_CATALOG.find((s) => s.section === section)?.codePrefix;
}

const catalogOrder = (section: string) => {
  const i = MATERIAL_CATALOG.findIndex((s) => s.section === section);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

/** The project's MATERIALS lines in catalogue order (module-level select: memoised per cache version). */
export const selectMaterialLines = (c: ProjectCache): BudgetLine[] =>
  c.budgetLines
    .filter((l) => l.category === 'MATERIALS')
    .sort((a, b) => catalogOrder(a.section) - catalogOrder(b.section) || a.sortOrder - b.sortOrder);

// --- schedule: the engine's checkSchedule, computed once per items array, read per row -------------

const scheduleMemo = new WeakMap<readonly CostItem[], Map<string, Record<string, ScheduleResult>>>();

/** `checkSchedule(items, today)` memoised on the items array identity (one engine call per cache version). */
export function scheduleOf(items: readonly CostItem[], today: string): Record<string, ScheduleResult> {
  let byDay = scheduleMemo.get(items);
  if (!byDay) {
    byDay = new Map();
    scheduleMemo.set(items, byDay);
  }
  let result = byDay.get(today);
  if (!result) {
    result = checkSchedule(items, today);
    byDay.set(today, result);
  }
  return result;
}

/**
 * One row's schedule result. The select returns only this row's entry, so TanStack's structural sharing
 * keeps the previous reference when it is unchanged and the cell does not re-render.
 */
export function useItemSchedule(projectId: string, itemId: string): ScheduleResult | undefined {
  const today = useToday();
  const select = useCallback((c: ProjectCache) => scheduleOf(c.items, today)[itemId], [itemId, today]);
  return useProjectSnapshot(projectId, select).data;
}

// --- deliveries: actual is managed by delivery tracking once a DELIVERED delivery exists -----------

const deliveredMemo = new WeakMap<readonly Delivery[], Set<string>>();

export function deliveredItemIds(deliveries: readonly Delivery[]): Set<string> {
  let ids = deliveredMemo.get(deliveries);
  if (!ids) {
    ids = new Set(deliveries.filter((d) => d.kind === 'DELIVERED').map((d) => d.costItemId));
    deliveredMemo.set(deliveries, ids);
  }
  return ids;
}

/** `true` when the row has at least one DELIVERED delivery (a boolean: no re-render on unrelated edits). */
export function useHasDeliveredDeliveries(projectId: string, itemId: string): boolean {
  const select = useCallback((c: ProjectCache) => deliveredItemIds(c.deliveries).has(itemId), [itemId]);
  return useProjectSnapshot(projectId, select).data ?? false;
}

// --- needed by: the start of the linked work ------------------------------------------------------

export interface NeededBy {
  workId: string;
  workName: string;
  startDate: string | null;
  section: string | null;
}

/** The linked WORK row as primitives (only re-renders when that work's name/start/section changes). */
export function useNeededBy(projectId: string, workId: string | null): NeededBy | undefined {
  const select = useCallback(
    (c: ProjectCache): NeededBy | undefined => {
      const work = workId ? c.itemsById[workId] : undefined;
      if (!work) return undefined;
      return {
        workId: work.id,
        workName: work.name,
        startDate: work.startDate,
        section: c.linesById[work.budgetLineId]?.section ?? null,
      };
    },
    [workId],
  );
  return useProjectSnapshot(projectId, select).data;
}

// --- SubNav badges --------------------------------------------------------------------------------

/** Schedule statuses counted as "late" in the SubNav badge. */
const LATE = new Set(['LATE_FOR_WORK', 'OVERDUE']);

/** Late-material count per MATERIALS line id. */
export function useLateCountsByLine(projectId: string): Record<string, number> {
  const today = useToday();
  const select = useCallback(
    (c: ProjectCache) => {
      const schedule = scheduleOf(c.items, today);
      const counts: Record<string, number> = {};
      for (const item of c.items) {
        const r = schedule[item.id];
        if (item.kind === 'MATERIAL' && r?.kind === 'MATERIAL' && LATE.has(r.status)) {
          counts[item.budgetLineId] = (counts[item.budgetLineId] ?? 0) + 1;
        }
      }
      return counts;
    },
    [today],
  );
  return useProjectSnapshot(projectId, select).data ?? EMPTY_COUNTS;
}

const EMPTY_COUNTS: Record<string, number> = {};
