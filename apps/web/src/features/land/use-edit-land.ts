import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { landParcelSchema, type LandParcel } from '@default-project/types';
import { apiPatch, seg } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { autosaveEdit } from '../project/autosave-edit';
import type { ProjectCache } from '../project/project-cache';
import {
  applyLandPatch,
  landKey,
  landScalars,
  type LandFields,
} from './land-cache';

/** Stable `(patch) => void` for parcel fields: optimistic, autosaved under `land:<projectId>`. */
export function useEditLand(
  projectId: string,
): (patch: Partial<LandFields>) => void {
  const qc = useQueryClient();
  return useCallback(
    (patch) => {
      const key = queryKeys.project(projectId);
      autosaveEdit<LandParcel>(
        qc,
        {
          queueKey: landKey.land(projectId),
          cancel: [key],
          read: () => {
            const land = qc.getQueryData<ProjectCache>(key)?.land;
            return land ? landScalars(land) : undefined;
          },
          write: (p) =>
            qc.setQueryData<ProjectCache>(
              key,
              (c) => c && applyLandPatch(c, p),
            ),
          send: async (merged) =>
            landParcelSchema.parse(
              await apiPatch(`/projects/${seg(projectId)}/land`, merged, {
                keepalive: true,
              }),
            ),
        },
        patch,
      );
    },
    [qc, projectId],
  );
}
