import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { budgetLineSchema, type BudgetLine } from '@default-project/types';
import { apiPatch, seg } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { autosaveEdit } from './autosave-edit';
import { applyLinePatch, cacheKey, type ProjectCache } from './project-cache';

/** Stable `(lineId, patch) => void` with the same semantics as useEditItem (e.g. `{ approvedCents }`). */
export function useEditBudgetLine(projectId: string): (lineId: string, patch: Partial<BudgetLine>) => void {
  const qc = useQueryClient();
  return useCallback(
    (lineId, patch) => {
      const key = queryKeys.project(projectId);
      autosaveEdit<BudgetLine>(
        qc,
        {
          queueKey: cacheKey.line(lineId),
          cancel: [key],
          read: () => qc.getQueryData<ProjectCache>(key)?.linesById[lineId],
          write: (p) => qc.setQueryData<ProjectCache>(key, (c) => c && applyLinePatch(c, lineId, p)),
          send: async (merged) =>
            budgetLineSchema.parse(
              await apiPatch(`/projects/${seg(projectId)}/budget-lines/${seg(lineId)}`, merged, { keepalive: true }),
            ),
        },
        patch,
      );
    },
    [qc, projectId],
  );
}
