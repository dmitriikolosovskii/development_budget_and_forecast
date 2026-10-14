import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { projectListItemSchema, type ProjectListItem } from '@default-project/types';
import { apiGet } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

export async function fetchProjects(): Promise<ProjectListItem[]> {
  return z.array(projectListItemSchema).parse(await apiGet('/projects'));
}

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects(), queryFn: fetchProjects });
}
