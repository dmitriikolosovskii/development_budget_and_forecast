import { Link } from 'react-router-dom';
import { formatBps, formatEurWhole } from '@default-project/budget-engine';
import type { CostCategory, Summary } from '@default-project/types';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { cx } from '../../ui/cx';
import { FlashValue } from '../../ui/flash-value';
import { Skeleton } from '../../ui/skeleton';
import { useProjectSummary } from './use-project-summary';

export interface BudgetHealthPanelProps {
  projectId: string;
  category?: CostCategory;
  lineId?: string;
}

const CATEGORY_TAB: Record<CostCategory, string> = {
  LAND: 'land',
  ARCHITECTURE: 'architecture',
  MATERIALS: 'materials',
  CONSTRUCTION: 'construction',
  MARKETING: 'marketing',
};

/** Link to a line's tab/section. */
export function lineHref(projectId: string, category: CostCategory, section: string): string {
  const tab = CATEGORY_TAB[category];
  const base = `/projects/${encodeURIComponent(projectId)}/${tab}`;
  return category === 'MATERIALS' || category === 'CONSTRUCTION' || category === 'MARKETING'
    ? `${base}/${encodeURIComponent(section)}`
    : base;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return part > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

function Bar({ s }: { s: Summary }) {
  const scale = Math.max(s.approved, s.forecast, 1);
  return (
    <div aria-hidden className="relative h-2.5 w-full overflow-hidden rounded-full bg-subtle">
      <div className="absolute inset-y-0 left-0 bg-[#f2a65a]/50 transition-all duration-300" style={{ width: `${pct(s.forecast, scale)}%` }} />
      <div className="absolute inset-y-0 left-0 bg-[#7cc8e8] transition-all duration-300" style={{ width: `${pct(s.exposure, scale)}%` }} />
      <div className="absolute inset-y-0 left-0 bg-brand-500 transition-all duration-300" style={{ width: `${pct(s.actual, scale)}%` }} />
      <div className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${pct(s.approved, scale)}%` }} />
    </div>
  );
}

/** The CFO's five answers for the current scope (project, category or line). */
export function BudgetHealthPanel({ projectId, category, lineId }: BudgetHealthPanelProps) {
  const rollup = useProjectSummary(projectId);
  if (!rollup) {
    return (
      <Card>
        <Skeleton lines={6} />
      </Card>
    );
  }
  const summary: Summary | undefined = lineId ? rollup.byLine[lineId] : category ? rollup.byCategory[category] : rollup.project;
  const overruns = rollup.overrunLines.filter((l) => (lineId ? l.lineId === lineId : !category || l.category === category));
  const scope = lineId ? rollup.byLine[lineId]?.name ?? 'Line' : category ? category.charAt(0) + category.slice(1).toLowerCase() : 'Project';
  if (!summary) return null;

  const rows: Array<[string, number, string?]> = [
    ['Approved budget', summary.approved],
    ['Spent (actual)', summary.actual, `${formatBps(summary.spentBps)} of budget`],
    ['Costs & obligations', summary.exposure, 'actual + open commitments'],
    ['Forecast (EAC)', summary.forecast, `${formatBps(summary.forecastVsApprovedBps)} of budget`],
  ];
  return (
    <Card className="space-y-4" aria-label="Budget health">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Budget health · {scope}</h2>
        <Badge tone={summary.overrun ? 'risk' : 'ok'}>{summary.overrun ? 'Over budget' : 'Within budget'}</Badge>
      </div>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value, hint]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">
              {label}
              {hint && <span className="block text-xs">{hint}</span>}
            </dt>
            <dd className="font-medium tabular-nums">
              <FlashValue value={value}>{formatEurWhole(value)}</FlashValue>
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
          <dt className="font-medium">Variance</dt>
          <dd className={cx('font-semibold tabular-nums', summary.variance < 0 ? 'text-risk-600' : 'text-ok-600')}>
            <FlashValue value={summary.variance}>{formatEurWhole(summary.variance)}</FlashValue>
          </dd>
        </div>
      </dl>
      <Bar s={summary} />
      {overruns.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Over budget</h3>
          <ul className="space-y-1 text-sm">
            {overruns.map((l) => (
              <li key={l.lineId}>
                <Link to={lineHref(projectId, l.category, l.section)} className="flex justify-between gap-2 rounded px-1 hover:bg-risk-50">
                  <span>{l.name}</span>
                  <span className="text-risk-600 tabular-nums">+{formatEurWhole(l.overrunCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
