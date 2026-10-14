import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { organizationSchema, type Organization } from '@default-project/types';
import { apiGet } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

export async function fetchOrganizations(): Promise<Organization[]> {
  return z.array(organizationSchema).parse(await apiGet('/organizations'));
}

/** Every organisation (all projects), for supplier/installer pickers. */
export function useOrganizations() {
  return useQuery({ queryKey: queryKeys.organizations(), queryFn: fetchOrganizations, staleTime: 60_000 });
}
