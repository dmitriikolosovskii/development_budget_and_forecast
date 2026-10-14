import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  utilityConnectionSchema,
  type UtilityConnection,
  type UtilityType,
} from '@default-project/types';
import { apiPatch, seg } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { autosaveEdit } from '../project/autosave-edit';
import type { ProjectCache } from '../project/project-cache';
import {
  applyUtilityPatch,
  blankUtility,
  landKey,
  type UtilityFields,
} from './land-cache';

/** Stable `(type, patch) => void`: upserts one utility row, autosaved under `utility:<projectId>:<type>`. */
export function useEditUtility(
  projectId: string,
): (type: UtilityType, patch: Partial<UtilityFields>) => void {
  const qc = useQueryClient();
  return useCallback(
    (type, patch) => {
      const key = queryKeys.project(projectId);
      autosaveEdit<UtilityConnection>(
        qc,
        {
          queueKey: landKey.utility(projectId, type),
          cancel: [key],
          read: () => {
            const land = qc.getQueryData<ProjectCache>(key)?.land;
            if (!land) return undefined;
            return (
              land.utilities.find((u) => u.type === type) ??
              blankUtility(land.id, type)
            );
          },
          write: (p) =>
            qc.setQueryData<ProjectCache>(
              key,
              (c) => c && applyUtilityPatch(c, type, p),
            ),
          send: async (merged) =>
            utilityConnectionSchema.parse(
              await apiPatch(
                `/projects/${seg(projectId)}/land/utilities/${seg(type)}`,
                merged,
                { keepalive: true },
              ),
            ),
        },
        patch,
      );
    },
    [qc, projectId],
  );
}
