import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts';
import { CATEGORY_COLORS, CHART_TOOLTIP_STYLE } from '../../../ui';
import { ChartFrame, tooltipEur } from './chart-frame';
import type { DonutSlice } from './chart-types';

const FALLBACK = [
  '#9db4ff',
  '#7cc8e8',
  '#f2a65a',
  '#b49fdc',
  '#8fb9a8',
  '#f19fb5',
  '#7fa7e6',
  '#f2c38b',
];

function sliceColor(slice: DonutSlice, i: number): string {
  return (
    slice.color ??
    CATEGORY_COLORS[slice.key as keyof typeof CATEGORY_COLORS] ??
    FALLBACK[i % FALLBACK.length]
  );
}

export interface CostStructureDonutProps {
  slices: DonutSlice[];
  title?: string;
  subtitle?: string;
}

/** Donut of a cost split (EAC by category by default). Empty when there are no slices or they sum to 0. */
export function CostStructureDonut({
  slices,
  title = 'Cost structure (forecast)',
  subtitle,
}: CostStructureDonutProps) {
  const visible = slices.filter((s) => s.value > 0);
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={visible.length === 0}>
      <PieChart>
        <Pie
          data={visible}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
        >
          {visible.map((s, i) => (
            <Cell key={s.key} fill={sliceColor(s, i)} />
          ))}
        </Pie>
        <Tooltip formatter={tooltipEur} {...CHART_TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ChartFrame>
  );
}
