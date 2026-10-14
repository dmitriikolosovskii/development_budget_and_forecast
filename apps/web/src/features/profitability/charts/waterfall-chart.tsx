import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEurWhole } from '@default-project/budget-engine';
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '../../../ui';
import { ChartFrame, compactEur } from './chart-frame';
import type { WaterfallStep } from './chart-types';

function stepColor(s: WaterfallStep): string {
  if (s.kind === 'total')
    return s.key === 'contractPrice'
      ? CHART_COLORS.profit
      : CHART_COLORS.actual;
  if (s.key === 'profit')
    return s.delta < 0 ? CHART_COLORS.overrun : CHART_COLORS.profit;
  return s.kind === 'up' ? CHART_COLORS.overrun : CHART_COLORS.profit;
}

export interface WaterfallChartProps {
  steps: WaterfallStep[];
  title?: string;
  subtitle?: string;
}

/** Waterfall as a stacked bar with an invisible base. */
export function WaterfallChart({
  steps,
  title = 'From approved budget to forecast',
  subtitle,
}: WaterfallChartProps) {
  const empty = steps.every((s) => s.height === 0);
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={empty}>
      <BarChart data={steps} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e3e8f0"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={48}
        />
        <YAxis tickFormatter={compactEur} tick={{ fontSize: 12 }} width={56} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(_v, name, item) => {
            const s = item.payload as WaterfallStep;
            if (name !== 'height') return null;
            return [
              s.kind === 'total'
                ? formatEurWhole(s.delta)
                : `${s.delta > 0 ? '+' : ''}${formatEurWhole(s.delta)}`,
              s.label,
            ];
          }}
        />
        <Bar
          dataKey="base"
          stackId="w"
          fill="transparent"
          isAnimationActive={false}
        />
        <Bar dataKey="height" stackId="w" radius={[4, 4, 0, 0]}>
          {steps.map((s) => (
            <Cell key={s.key} fill={stepColor(s)} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
