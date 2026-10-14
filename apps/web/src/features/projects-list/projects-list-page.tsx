import { Link } from 'react-router-dom';
import { Calculator, MapPin } from 'lucide-react';
import { formatBps, formatEurWhole } from '@default-project/budget-engine';
import type { ProjectListItem } from '@default-project/types';
import { Badge } from '../../ui/badge';
import { Card, SectionTitle } from '../../ui/card';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { EmptyState, ErrorState } from '../../ui/states';
import { Skeleton } from '../../ui/skeleton';
import { useProjects } from './use-projects';

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'risk' | 'ok' }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx('font-semibold tabular-nums', tone === 'risk' && 'text-risk-600', tone === 'ok' && 'text-ok-600')}>{value}</dd>
    </div>
  );
}

function ProjectCard({ p }: { p: ProjectListItem }) {
  return (
    <Link
      to={`/projects/${encodeURIComponent(p.id)}`}
      className={cx('block rounded-[var(--radius-card)] hover:-translate-y-0.5', SOFT, FOCUS)}
      aria-label={p.name}
    >
      <Card className="h-full hover:border-brand-100">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-ink">{p.name}</h2>
            <p className="flex items-center gap-1 text-sm text-muted">
              <MapPin aria-hidden className="h-3.5 w-3.5" />
              {p.city} · {p.code}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone="brand">{p.status.toLowerCase()}</Badge>
            {p.summary.overrun && <Badge tone="risk">Over budget</Badge>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Budget" value={formatEurWhole(p.summary.approved)} />
          <Metric label="Forecast (EAC)" value={formatEurWhole(p.summary.forecast)} />
          <Metric label="Variance" value={formatEurWhole(p.summary.variance)} tone={p.summary.variance < 0 ? 'risk' : 'ok'} />
          <Metric
            label={`Profit (${formatBps(p.profitability.marginBps)})`}
            value={formatEurWhole(p.profitability.forecastProfit)}
            tone={p.profitability.forecastProfit < 0 ? 'risk' : undefined}
          />
        </dl>
      </Card>
    </Link>
  );
}

export function ProjectsListPage() {
  const projects = useProjects();
  const calculate = (
    <Link
      to="/projects/new"
      className={cx('inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600', SOFT, FOCUS)}
    >
      <Calculator aria-hidden className="h-4 w-4" />
      Calculate project
    </Link>
  );

  let body;
  if (projects.isPending) {
    body = (
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <Skeleton lines={4} />
          </Card>
        ))}
      </div>
    );
  } else if (projects.isError) {
    body = <ErrorState title="Could not load projects" error={projects.error} retry={() => void projects.refetch()} />;
  } else if (projects.data.length === 0) {
    body = <EmptyState title="No projects yet" description="Calculate a project to get started." action={calculate} />;
  } else {
    body = (
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {projects.data.map((p) => (
          <ProjectCard key={p.id} p={p} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionTitle subtitle="Budget, forecast and profit of every project" actions={calculate}>
        <span className="text-xl">Current projects</span>
      </SectionTitle>
      {body}
    </div>
  );
}
