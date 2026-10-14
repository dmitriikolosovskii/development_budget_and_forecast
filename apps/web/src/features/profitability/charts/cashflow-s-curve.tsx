import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '../../../ui';
import { ChartFrame, compactEur, tooltipEur } from './chart-frame';
import type { CashflowPoint } from './chart-types';

export interface CashflowSCurveProps {
  months: CashflowPoint[];
  /** 'YYYY-MM'; the "Today" line is drawn only when this month is in range. */
  todayMonth?: string;
  title?: string;
  subtitle?: string;
}

/** Cumulative planned / actual / forecast (lines) over monthly forecast and actual (bars). */
export function CashflowSCurve({
  months,
  todayMonth,
  title = 'Cash flow',
  subtitle,
}: CashflowSCurveProps) {
  const showToday = !!todayMonth && months.some((m) => m.month === todayMonth);
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      empty={months.length === 0}
      emptyText="No scheduled costs yet"
      height={300}
    >
      <ComposedChart
        data={months}
        margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e3e8f0"
          vertical={false}
        />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={compactEur} tick={{ fontSize: 12 }} width={56} />
        <Tooltip formatter={tooltipEur} {...CHART_TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="forecast"
          name="Monthly forecast"
          fill={CHART_COLORS.forecast}
          opacity={0.35}
        />
        <Bar
          dataKey="actual"
          name="Monthly actual"
          fill={CHART_COLORS.actual}
          opacity={0.35}
        />
        <Line
          type="monotone"
          dataKey="cumulativePlanned"
          name="Cumulative planned"
          stroke={CHART_COLORS.budget}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="cumulativeForecast"
          name="Cumulative forecast"
          stroke={CHART_COLORS.forecast}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="cumulativeActual"
          name="Cumulative actual"
          stroke={CHART_COLORS.actual}
          strokeWidth={2}
          dot={false}
        />
        {showToday && (
          <ReferenceLine
            x={todayMonth}
            stroke={CHART_COLORS.overrun}
            strokeDasharray="4 4"
            label={{ value: 'Today', fontSize: 11, position: 'top' }}
          />
        )}
      </ComposedChart>
    </ChartFrame>
  );
}
