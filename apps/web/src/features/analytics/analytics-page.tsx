import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import { formatBps, toBps } from '@default-project/budget-engine';
import { PROJECT_STATUSES } from '@default-project/types';
import { Card, SectionTitle } from '../../ui/card';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import { BudgetVsForecastChart, CashflowSCurve } from '../profitability/charts';
import { useToday } from '../project/use-today';
import { CategoryStackChart } from './category-stack-chart';
import {
  filterPortfolio,
  periodYears,
  type StatusFilter,
} from './filter-portfolio';
import { OverrunHeatmap } from './overrun-heatmap';
import { PortfolioKpis } from './portfolio-kpis';
import { ProjectsTable } from './projects-table';
import { usePortfolio } from './use-portfolio';
import type { AnalyticsProject } from './analytics-schema';

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'All statuses',
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1 text-sm',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-600'
          : 'border-line text-muted hover:text-ink',
        SOFT,
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}

function DeliveryKpis({ projects }: { projects: readonly AnalyticsProject[] }) {
  const delivered = projects.reduce((s, p) => s + p.delivery.deliveredRows, 0);
  const onTime = projects.reduce((s, p) => s + p.delivery.onTimeRows, 0);
  const overdue = projects.reduce((s, p) => s + p.delivery.overdueItems, 0);
  return (
    <Card>
      <SectionTitle subtitle="Delivered rows of items with a planned delivery date">
        Deliveries
      </SectionTitle>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted">On time</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {delivered === 0 ? '—' : formatBps(toBps(onTime, delivered))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Overdue items</dt>
          <dd
            className={cx(
              'text-lg font-semibold tabular-nums',
              overdue > 0 ? 'text-risk-600' : 'text-ok-600',
            )}
          >
            {overdue}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

const calculateLink = (
  <Link
    to="/projects/new"
    className={cx(
      'inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600',
      SOFT,
      FOCUS,
    )}
  >
    <Calculator aria-hidden className="h-4 w-4" />
    Calculate project
  </Link>
);

/** `/analytics`: the CFO's answers across the whole portfolio and a comparison of projects. */
export function AnalyticsPage() {
  const portfolio = usePortfolio();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const status: StatusFilter = PROJECT_STATUSES.includes(statusParam as never)
    ? (statusParam as StatusFilter)
    : 'ALL';
  const period = params.get('period') ?? 'ALL';

  const all = portfolio.data?.projects;
  const years = useMemo(() => periodYears(all ?? []), [all]);
  const view = useMemo(
    () => (all ? filterPortfolio(all, { status, period }) : undefined),
    [all, status, period],
  );

  const setFilter = (key: 'status' | 'period', value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'ALL') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  let body: ReactNode;
  if (portfolio.isPending) {
    body = (
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton lines={2} />
          </Card>
        ))}
      </div>
    );
  } else if (portfolio.isError) {
    body = (
      <Card>
        <ErrorState
          title="Could not load the portfolio"
          error={portfolio.error}
          retry={() => void portfolio.refetch()}
        />
      </Card>
    );
  } else if (!view || (all ?? []).length === 0) {
    body = (
      <Card>
        <EmptyState
          title="No projects yet"
          description="Calculate your first project to see portfolio analytics."
          action={calculateLink}
        />
      </Card>
    );
  } else {
    body = (
      <>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            Status
            <select
              value={status}
              onChange={(e) => setFilter('status', e.target.value)}
              className={cx(
                'rounded-lg border border-line bg-surface px-2 py-1 text-ink',
                FOCUS,
              )}
            >
              {(['ALL', ...PROJECT_STATUSES] as StatusFilter[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <div
            role="group"
            aria-label="Period"
            className="flex flex-wrap gap-2"
          >
            <Chip
              active={period === 'ALL'}
              onClick={() => setFilter('period', 'ALL')}
            >
              All periods
            </Chip>
            {years.map((y) => (
              <Chip
                key={y}
                active={period === y}
                onClick={() => setFilter('period', y)}
              >
                {y}
              </Chip>
            ))}
          </div>
        </div>
        {view.projects.length === 0 ? (
          <Card>
            <EmptyState
              title="No projects match the filters"
              action={
                <button
                  type="button"
                  onClick={() => setParams({}, { replace: true })}
                  className={cx(
                    'text-sm text-brand-600 hover:underline',
                    FOCUS,
                  )}
                >
                  Reset filters
                </button>
              }
            />
          </Card>
        ) : (
          <>
            <PortfolioKpis
              totals={view.totals}
              profitability={view.profitability}
              overBudget={view.projects.filter((p) => p.summary.overrun).length}
              projectCount={view.projects.length}
            />
            <BudgetVsForecastChart
              title="Budget vs forecast by project"
              rows={view.projects.map((p) => ({
                key: p.projectId,
                label: p.name,
                approved: p.summary.approved,
                actual: p.summary.actual,
                openCommitments: p.summary.openCommitments,
                forecast: p.summary.forecast,
              }))}
            />
            <Card padded={false}>
              <div className="p-4 sm:p-5">
                <SectionTitle subtitle="Click a project to open its Profitability tab">
                  Projects
                </SectionTitle>
              </div>
              <ProjectsTable projects={view.projects} />
            </Card>
            <div className="grid gap-4 2xl:grid-cols-2">
              <CategoryStackChart projects={view.projects} />
              <Card>
                <SectionTitle subtitle="Variance % of the approved budget; red = overrun">
                  Overrun heatmap
                </SectionTitle>
                <OverrunHeatmap projects={view.projects} />
              </Card>
            </div>
            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <CashflowSCurve
                title="Portfolio cash flow"
                subtitle={
                  period === 'ALL'
                    ? 'All periods'
                    : `Clipped to ${period}; cumulatives include earlier months`
                }
                months={view.cashflow}
                todayMonth={today.slice(0, 7)}
              />
              <DeliveryKpis projects={view.projects} />
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-ink">Analytics</h1>
        <p className="text-sm text-muted">
          The whole portfolio: budget, spend, commitments, forecast and
          overruns. Amounts are net (excl. VAT).
        </p>
      </div>
      {body}
    </div>
  );
}
