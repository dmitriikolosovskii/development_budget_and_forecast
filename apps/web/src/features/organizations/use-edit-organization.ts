import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { organizationSchema, type Organization } from '@default-project/types';
import { apiPatch, seg } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { autosaveEdit } from '../project/autosave-edit';
import { applyOrgPatch, cacheKey, type ProjectCache } from '../project/project-cache';

/** Stable `(orgId, patch) => void`; updates `['organizations']` and every cached project. */
export function useEditOrganization(): (orgId: string, patch: Partial<Organization>) => void {
  const qc = useQueryClient();
  return useCallback(
    (orgId, patch) => {
      const read = () =>
        qc.getQueryData<Organization[]>(queryKeys.organizations())?.find((o) => o.id === orgId) ??
        qc
          .getQueriesData<ProjectCache>({ queryKey: queryKeys.projectsAll() })
          .map(([, c]) => c?.orgsById[orgId])
          .find(Boolean);
      autosaveEdit<Organization>(
        qc,
        {
          queueKey: cacheKey.org(orgId),
          cancel: [queryKeys.organizations(), queryKeys.projectsAll()],
          read,
          write: (p) => {
            qc.setQueryData<Organization[]>(queryKeys.organizations(), (list) =>
              list?.map((o) => (o.id === orgId ? { ...o, ...p, id: o.id } : o)),
            );
            qc.setQueriesData<ProjectCache>({ queryKey: queryKeys.projectsAll() }, (c) => c && applyOrgPatch(c, orgId, p));
          },
          send: async (merged) =>
            organizationSchema.parse(await apiPatch(`/organizations/${seg(orgId)}`, merged, { keepalive: true })),
        },
        patch,
      );
    },
    [qc],
  );
}
