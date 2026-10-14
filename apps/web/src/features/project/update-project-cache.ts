import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-keys';
import type { ProjectCache } from './project-cache';

/**
 * Applies a pure reducer from `project-cache.ts` to a cached project, e.g.
 * `updateProjectCache(qc, id, (c) => applyItemsPatch(c, patches))` or `(c) => ({ ...c, plan })`.
 * Use the reducers so the indices stay consistent; skip rows where `autosaveQueue.has('item:<id>')`.
 */
export function updateProjectCache(
  qc: QueryClient,
  projectId: string,
  update: (cache: ProjectCache) => ProjectCache,
): void {
  qc.setQueryData<ProjectCache>(queryKeys.project(projectId), (c) => c && update(c));
}
