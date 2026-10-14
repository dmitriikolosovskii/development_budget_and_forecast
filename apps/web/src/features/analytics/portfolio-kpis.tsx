import { formatBps, formatEurWhole } from '@default-project/budget-engine';
import type { Profitability, Summary } from '@default-project/types';
import { Card } from '../../ui/card';
import { cx } from '../../ui/cx';

interface KpiProps {
  label: string;
  value: string;
  tone?: 'ok' | 'risk';
}

function Kpi({ label, value, tone }: KpiProps) {
  return (
    <Card>
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={cx(
          'mt-1 text-lg font-semibold tabular-nums',
          tone === 'risk' && 'text-risk-600',
          tone === 'ok' && 'text-ok-600',
        )}
      >
        {value}
      </dd>
    </Card>
  );
}

export interface PortfolioKpisProps {
  totals: Summary;
  profitability: Profitability;
  overBudget: number;
  projectCount: number;
}

/** The CFO's answers for the selected projects (whole life). */
export function PortfolioKpis({
  totals,
  profitability,
  overBudget,
  projectCount,
}: PortfolioKpisProps) {
  return (
    <dl
      aria-label="Portfolio KPIs"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-8"
    >
      <Kpi label="Approved" value={formatEurWhole(totals.approved)} />
      <Kpi label="Spent" value={formatEurWhole(totals.actual)} />
      <Kpi
        label="Open commitments"
        value={formatEurWhole(totals.openCommitments)}
      />
      <Kpi label="Forecast (EAC)" value={formatEurWhole(totals.forecast)} />
      <Kpi
        label="Variance"
        value={formatEurWhole(totals.variance)}
        tone={totals.variance < 0 ? 'risk' : 'ok'}
      />
      <Kpi
        label="Forecast profit"
        value={formatEurWhole(profitability.forecastProfit)}
        tone={profitability.forecastProfit < 0 ? 'risk' : undefined}
      />
      <Kpi label="Average margin" value={formatBps(profitability.marginBps)} />
      <Kpi
        label="Projects over budget"
        value={`${overBudget} of ${projectCount}`}
        tone={overBudget > 0 ? 'risk' : 'ok'}
      />
    </dl>
  );
}
