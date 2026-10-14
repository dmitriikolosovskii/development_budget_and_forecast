import { useMemo } from 'react';
import {
  computeProfitability,
  monthlyCashflow,
  summarizeProject,
} from '@default-project/budget-engine';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { useToday } from '../project/use-today';

/**
 * Everything the Profitability tab shows, derived from the shared snapshot cache (nothing stored here).
 * Summary and cash flow depend only on items/lines, so moving the markup slider recomputes only profitability.
 */
export function useProfitability(projectId: string) {
  const query = useProjectSnapshot(projectId);
  const today = useToday();
  const cache = query.data;
  const items = cache?.items;
  const budgetLines = cache?.budgetLines;
  const markupBps = cache?.project.markupBps;

  const rollup = useMemo(
    () =>
      items && budgetLines
        ? summarizeProject({ items, budgetLines })
        : undefined,
    [items, budgetLines],
  );
  const cashflow = useMemo(
    () =>
      items && budgetLines
        ? monthlyCashflow({ items, budgetLines }, today)
        : undefined,
    [items, budgetLines, today],
  );
  const profitability = useMemo(
    () =>
      rollup && markupBps !== undefined
        ? computeProfitability(rollup.project, markupBps)
        : undefined,
    [rollup, markupBps],
  );

  return { query, today, markupBps, rollup, cashflow, profitability };
}
