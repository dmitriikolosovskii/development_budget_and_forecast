import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { projectSchema, type Project } from '@default-project/types';
import { apiPatch, seg } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { autosaveEdit } from './autosave-edit';
import { applyProjectPatch, cacheKey, type ProjectCache } from './project-cache';

/** Stable `(patch) => void` for project fields (name, city, status, dates, markupBps). */
export function useEditProject(projectId: string): (patch: Partial<Project>) => void {
  const qc = useQueryClient();
  return useCallback(
    (patch) => {
      const key = queryKeys.project(projectId);
      autosaveEdit<Project>(
        qc,
        {
          queueKey: cacheKey.project(projectId),
          cancel: [key],
          read: () => qc.getQueryData<ProjectCache>(key)?.project,
          write: (p) => qc.setQueryData<ProjectCache>(key, (c) => c && applyProjectPatch(c, p)),
          send: async (merged) =>
            projectSchema.parse(await apiPatch(`/projects/${seg(projectId)}`, merged, { keepalive: true })),
        },
        patch,
      );
    },
    [qc, projectId],
  );
}
