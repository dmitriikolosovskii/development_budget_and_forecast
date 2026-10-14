import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { costItemSchema, type CostItem, type CreateCostItemInput } from '@default-project/types';
import { apiPost, seg } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { showToast } from '../../lib/toast-store';
import { invalidateRollups } from './autosave-edit';
import { removeItem, replaceItem, upsertItem, type ProjectCache } from './project-cache';

let tempSeq = 0;

function tempRow(projectId: string, id: string, input: CreateCostItemInput): CostItem {
  const now = new Date().toISOString();
  return {
    description: null,
    committedCents: 0,
    actualCents: 0,
    status: 'PLANNED',
    supplierId: null,
    contractorId: null,
    deliveryDate: null,
    deliveredDate: null,
    startDate: null,
    endDate: null,
    requiredForWorkId: null,
    boqComponentId: null,
    sortOrder: 0,
    notes: null,
    ...input,
    id,
    projectId,
    createdAt: now,
    updatedAt: now,
  };
}

/** `(input) => Promise<CostItem>`: a temp row appears at once and is swapped for the server row. */
export function useCreateItem(projectId: string): (input: CreateCostItemInput) => Promise<CostItem> {
  const qc = useQueryClient();
  return useCallback(
    async (input) => {
      const key = queryKeys.project(projectId);
      const tempId = `tmp-${++tempSeq}`;
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<ProjectCache>(key, (c) => c && upsertItem(c, tempRow(projectId, tempId, input)));
      try {
        const server = costItemSchema.parse(await apiPost(`/projects/${seg(projectId)}/items`, input));
        qc.setQueryData<ProjectCache>(key, (c) => c && replaceItem(c, tempId, server));
        invalidateRollups(qc);
        return server;
      } catch (error) {
        qc.setQueryData<ProjectCache>(key, (c) => c && removeItem(c, tempId));
        showToast(`Could not add the row: ${error instanceof Error ? error.message : 'unknown error'}`, 'risk');
        throw error;
      }
    },
    [qc, projectId],
  );
}
