import type { ProjectSnapshot, WizardInput } from '@default-project/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

/** Private to this feature (CR-12, CONTRACTS §6): the template never changes while the app runs. */
export const wizardTemplateKey = ['project-wizard', 'template'] as const;

/** `GET /api/projects/wizard/template`: the 144 m² template the estimate is computed from. */
export function useWizardTemplate() {
  return useQuery({
    queryKey: wizardTemplateKey,
    queryFn: () => apiGet<ProjectSnapshot>('/projects/wizard/template'),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** `POST /api/projects/wizard` → lists refresh, then the new project's Land tab opens. */
export function useCreateFromWizard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: WizardInput) =>
      apiPost<ProjectSnapshot>('/projects/wizard', input),
    onSuccess: async (snapshot) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics() }),
        queryClient.invalidateQueries({ queryKey: ['search'] }),
      ]);
      navigate(`/projects/${encodeURIComponent(snapshot.project.id)}/land`);
    },
  });
}
