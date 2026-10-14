import { useQuery } from '@tanstack/react-query';
import { healthStatusSchema, type HealthStatus } from '@default-project/types';

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return healthStatusSchema.parse(await response.json());
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: fetchHealth });
}
