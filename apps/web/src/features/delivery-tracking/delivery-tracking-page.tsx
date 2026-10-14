import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatBps } from '@default-project/budget-engine';
import { Card } from '../../ui/card';
import { cx, FOCUS } from '../../ui/cx';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { useSchedule } from '../project/use-schedule';
import { useToday } from '../project/use-today';
import { useProjects } from '../projects-list/use-projects';
import { DeliveryLogTable } from './delivery-log-table';
import { deliveryKpis } from './delivery-log';
import { ImportPanel } from './import-panel';
import { useDeliveries } from './use-deliveries';

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'risk' | 'ok';
}) {
  return (
    <Card padded={false} className="px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={cx(
          'text-xl font-semibold tabular-nums',
          tone === 'risk' && 'text-risk-600',
          tone === 'ok' && 'text-ok-600',
        )}
      >
        {value}
      </dd>
    </Card>
  );
}

/** `/deliveries`: upload supplier/site CSVs, see the result and the delivery log of a project. */
export function DeliveryTrackingPage() {
  const projects = useProjects();
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project') ?? projects.data?.[0]?.id ?? '';
  const today = useToday();

  const snapshot = useProjectSnapshot(projectId);
  const schedule = useSchedule(projectId);
  const deliveries = useDeliveries(projectId);
  const kpis = useMemo(
    () =>
      deliveries.data && snapshot.data
        ? deliveryKpis(
            deliveries.data,
            snapshot.data.itemsById,
            schedule,
            today,
          )
        : null,
    [deliveries.data, snapshot.data, schedule, today],
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Delivery tracking</h1>
          <p className="text-sm text-muted">
            Expected and delivered materials update dates and actual costs of
            the project.
          </p>
        </div>
        {projects.data && projects.data.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Project
            <select
              value={projectId}
              onChange={(e) => setParams({ project: e.target.value })}
              className={cx(
                'min-w-64 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink',
                FOCUS,
              )}
            >
              {projects.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {projects.isPending ? (
        <Card>
          <Skeleton lines={3} />
        </Card>
      ) : projects.isError ? (
        <Card>
          <ErrorState
            title="Could not load projects"
            error={projects.error}
            retry={() => void projects.refetch()}
          />
        </Card>
      ) : !projects.data.length ? (
        <Card>
          <EmptyState title="No projects yet" />
        </Card>
      ) : (
        <>
          <dl
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="Delivery KPIs"
          >
            <Kpi
              label="Delivered this month"
              value={kpis ? String(kpis.deliveredThisMonth) : '—'}
            />
            <Kpi
              label="On time"
              value={kpis?.onTimeBps == null ? '—' : formatBps(kpis.onTimeBps)}
              tone={
                kpis?.onTimeBps == null
                  ? undefined
                  : kpis.onTimeBps >= 8000
                    ? 'ok'
                    : 'risk'
              }
            />
            <Kpi
              label="Open expected"
              value={kpis ? String(kpis.openExpected) : '—'}
            />
            <Kpi
              label="Overdue items"
              value={kpis ? String(kpis.overdueItems) : '—'}
              tone={kpis?.overdueItems ? 'risk' : undefined}
            />
          </dl>

          <ImportPanel
            key={projectId}
            projectId={projectId}
            cache={snapshot.data}
          />

          <DeliveryLogTable
            deliveries={deliveries.data}
            isPending={deliveries.isPending}
            error={deliveries.error}
            retry={() => void deliveries.refetch()}
            cache={snapshot.data}
            today={today}
          />
        </>
      )}
    </div>
  );
}
