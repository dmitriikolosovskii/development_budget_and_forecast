/** Query keys from CONTRACTS §6: the only keys features may use. */
export const queryKeys = {
  projects: () => ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  projectsAll: () => ['project'] as const,
  organizations: () => ['organizations'] as const,
  deliveries: (projectId: string) => ['deliveries', projectId] as const,
  analyticsPortfolio: () => ['analytics', 'portfolio'] as const,
  analytics: () => ['analytics'] as const,
  search: (q: string) => ['search', q] as const,
};
