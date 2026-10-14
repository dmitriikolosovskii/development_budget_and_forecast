import { formatBps, formatEurWhole } from '@default-project/budget-engine';
import type { Summary } from '@default-project/types';
import { Badge } from './badge';
import { cx } from './cx';
import { FlashValue } from './flash-value';
import { Skeleton } from './skeleton';

export interface KpiStripProps {
  summary: Summary | undefined;
  /** Number of budget lines over budget ("N lines over budget"). */
  overrunCount?: number;
}

interface Kpi {
  label: string;
  value: number;
  hint?: string;
  tone?: 'ok' | 'risk';
}

/** The CFO's five answers: Budget · Spent · Open commitments · Forecast (EAC) · Variance. */
export function KpiStrip({ summary, overrunCount }: KpiStripProps) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-3">
            <Skeleton lines={2} />
          </div>
        ))}
      </div>
    );
  }
  const kpis: Kpi[] = [
    { label: 'Budget', value: summary.approved },
    { label: 'Spent', value: summary.actual, hint: `${formatBps(summary.spentBps)} of budget` },
    { label: 'Open commitments', value: summary.openCommitments },
    { label: 'Forecast (EAC)', value: summary.forecast, hint: `${formatBps(summary.forecastVsApprovedBps)} of budget` },
    { label: 'Variance', value: summary.variance, tone: summary.variance < 0 ? 'risk' : 'ok' },
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-soft)]">
            <dt className="text-xs font-medium text-muted">{k.label}</dt>
            <dd
              className={cx(
                'mt-1 text-lg font-semibold tabular-nums',
                k.tone === 'risk' && 'text-risk-600',
                k.tone === 'ok' && 'text-ok-600',
              )}
            >
              <FlashValue value={k.value}>{formatEurWhole(k.value)}</FlashValue>
            </dd>
            {k.hint && <p className="text-xs text-muted">{k.hint}</p>}
          </div>
        ))}
      </dl>
      {overrunCount !== undefined && overrunCount > 0 && (
        <div className="mt-2">
          <Badge tone="risk">
            {overrunCount} {overrunCount === 1 ? 'line' : 'lines'} over budget
          </Badge>
        </div>
      )}
    </div>
  );
}
