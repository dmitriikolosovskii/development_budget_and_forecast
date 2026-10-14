import { summarizeProject } from '@default-project/budget-engine';
import { useProjectSnapshot } from './use-project-snapshot';
import type { ProjectCache } from './project-cache';

export type ProjectRollup = ReturnType<typeof summarizeProject>;

// Module-level select: TanStack memoises it per cache version.
const selectSummary = (c: ProjectCache): ProjectRollup => summarizeProject(c);

/** Engine rollups (project, byCategory, byLine, overrunLines); undefined while loading. */
export function useProjectSummary(projectId: string): ProjectRollup | undefined {
  return useProjectSnapshot(projectId, selectSummary).data;
}
