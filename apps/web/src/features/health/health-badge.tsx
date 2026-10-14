import { useHealth } from './use-health';

export function HealthBadge() {
  const { data, isPending, isError } = useHealth();

  if (isPending) return <p role="status">API: checking…</p>;
  if (isError) return <p role="status">API: unavailable</p>;
  return <p role="status">API: {data.status}, DB: {data.db}</p>;
}
