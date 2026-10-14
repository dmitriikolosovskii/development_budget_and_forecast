import { useMutation, useQueryClient } from '@tanstack/react-query';
import { landParcelSchema } from '@default-project/types';
import { apiPatch, seg } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { showToast } from '../../lib/toast-store';
import { invalidateRollups } from '../project/autosave-edit';
import type { ProjectCache } from '../project/project-cache';

/** "Add land details": an empty PATCH creates the parcel with blank values (owner decision). */
export function useCreateLand(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      landParcelSchema.parse(
        await apiPatch(`/projects/${seg(projectId)}/land`, {}),
      ),
    onSuccess: (land) => {
      qc.setQueryData<ProjectCache>(
        queryKeys.project(projectId),
        (c) =>
          c && { ...c, land: { ...land, utilities: c.land?.utilities ?? [] } },
      );
      invalidateRollups(qc);
    },
    onError: (error) =>
      showToast(`Land details were not created: ${error.message}`, 'risk'),
  });
}
