import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '../../../ui';
import { ChartFrame, compactEur, tooltipEur } from './chart-frame';
import type { CategoryBarRow } from './chart-types';

export interface BudgetVsForecastChartProps {
  rows: CategoryBarRow[];
  title?: string;
  subtitle?: string;
}

/** Grouped bars: Approved / Actual / Open commitments / Forecast per row (category or project). */
export function BudgetVsForecastChart({
  rows,
  title = 'Budget vs forecast by category',
  subtitle,
}: BudgetVsForecastChartProps) {
  const empty = rows.every(
    (r) =>
      r.approved === 0 &&
      r.actual === 0 &&
      r.openCommitments === 0 &&
      r.forecast === 0,
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={empty}>
      <BarChart
        data={rows}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        barGap={2}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e3e8f0"
          vertical={false}
        />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={compactEur} tick={{ fontSize: 12 }} width={56} />
        <Tooltip formatter={tooltipEur} {...CHART_TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="approved"
          name="Approved"
          fill={CHART_COLORS.budget}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="actual"
          name="Actual"
          fill={CHART_COLORS.actual}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="openCommitments"
          name="Open commitments"
          fill={CHART_COLORS.commitments}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="forecast"
          name="Forecast"
          fill={CHART_COLORS.forecast}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartFrame>
  );
}
