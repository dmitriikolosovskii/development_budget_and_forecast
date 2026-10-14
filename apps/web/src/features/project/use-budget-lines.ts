import { useCallback } from 'react';
import type { BudgetLine, CostCategory } from '@default-project/types';
import { useProjectSnapshot } from './use-project-snapshot';
import type { ProjectCache } from './project-cache';

const EMPTY: BudgetLine[] = [];

/** Budget lines (optionally of one category) sorted by sortOrder. */
export function useBudgetLines(projectId: string, category?: CostCategory): BudgetLine[] {
  const select = useCallback(
    (c: ProjectCache) =>
      c.budgetLines
        .filter((l) => !category || l.category === category)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [category],
  );
  return useProjectSnapshot(projectId, select).data ?? EMPTY;
}

/** One budget line by category + section slug. */
export function useBudgetLine(projectId: string, category: CostCategory, section: string | undefined): BudgetLine | undefined {
  const select = useCallback(
    (c: ProjectCache) => c.budgetLines.find((l) => l.category === category && l.section === section),
    [category, section],
  );
  return useProjectSnapshot(projectId, select).data;
}
