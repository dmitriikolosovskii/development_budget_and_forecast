import { useCallback } from 'react';
import { Link, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { ErrorState } from '../../ui/states';
import { KpiStrip } from '../../ui/kpi-strip';
import { Skeleton } from '../../ui/skeleton';
import { Tabs } from '../../ui/tabs';
import { useUiStore } from '../../lib/ui-store';
import { OrganizationModal } from '../organizations/organization-modal';
import { PROJECT_TABS } from './tabs-config';
import { useProjectSnapshot } from './use-project-snapshot';
import { useProjectSummary } from './use-project-summary';
import type { ProjectCache } from './project-cache';

const selectProject = (c: ProjectCache) => c.project;

const STATUS_TONE = { PLANNING: 'info', ACTIVE: 'brand', COMPLETED: 'ok' } as const;

/** Layout for /projects/:projectId/*: header, KPI strip, tabs, `?org=` modal. */
export function ProjectPage() {
  const { projectId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const lastSection = useUiStore((s) => s.lastSection);
  const query = useProjectSnapshot(projectId, selectProject);
  const rollup = useProjectSummary(projectId);
  const orgId = params.get('org');
  const closeOrg = useCallback(
    () =>
      setParams((p) => {
        p.delete('org');
        return p;
      }),
    [setParams],
  );

  if (query.isError) {
    return <ErrorState title="Could not load the project" error={query.error} retry={() => void query.refetch()} />;
  }
  const project = query.data;
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const tabs = PROJECT_TABS.map((t) => {
    const remembered = t.sectionTab ? lastSection[t.sectionTab] : undefined;
    const match = `${base}/${t.path}`;
    return { label: t.label, match, to: remembered ? `${match}/${encodeURIComponent(remembered)}` : match };
  });

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumbs" className="flex items-center gap-1 text-sm text-muted">
        <Link to="/projects" className="hover:text-ink">
          Current projects
        </Link>
        <ChevronRight aria-hidden className="h-4 w-4" />
        <span className="text-ink">{project?.name ?? '…'}</span>
      </nav>
      <header className="space-y-3">
        {project ? (
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink sm:text-2xl">{project.name}</h1>
            <Badge tone={STATUS_TONE[project.status]}>{project.status.toLowerCase()}</Badge>
            <span className="text-sm text-muted">
              {project.code} · {project.city} · {project.clientName}
            </span>
          </div>
        ) : (
          <Skeleton className="h-7 w-72" />
        )}
        <KpiStrip summary={rollup?.project} overrunCount={rollup?.overrunLines.length} />
      </header>
      <Tabs items={tabs} label="Project sections" />
      <div key={projectId} className="animate-fade-in">
        <Outlet />
      </div>
      {orgId && <OrganizationModal orgId={orgId} projectId={projectId} onClose={closeOrg} />}
    </div>
  );
}
