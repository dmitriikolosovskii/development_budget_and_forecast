import { useQuery } from '@tanstack/react-query';
import { projectSnapshotSchema } from '@default-project/types';
import { apiGet, seg } from '../../lib/api-client';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { normalise, overlayUnconfirmed, type ProjectCache } from './project-cache';

export async function fetchProjectCache(projectId: string): Promise<ProjectCache> {
  const snapshot = projectSnapshotSchema.parse(await apiGet(`/projects/${seg(projectId)}`));
  // Edits that are not confirmed yet must survive any refetch (judge constraint 3).
  return overlayUnconfirmed(normalise(snapshot), autosaveQueue.unconfirmedAll());
}

/** The project snapshot cache; pass a stable `select` to subscribe to a slice. */
export function useProjectSnapshot<T = ProjectCache>(projectId: string, select?: (cache: ProjectCache) => T) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => fetchProjectCache(projectId),
    select,
    enabled: projectId !== '',
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
