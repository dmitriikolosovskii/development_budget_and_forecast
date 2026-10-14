import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEurWhole } from '@default-project/budget-engine';
import { COST_CATEGORIES } from '@default-project/types';
import {
  CATEGORY_COLORS,
  CHART_TOOLTIP_STYLE,
  ChartCard,
} from '../../ui/chart-card';
import { Card, SectionTitle } from '../../ui/card';
import { EmptyState } from '../../ui/states';
import type { AnalyticsProject } from './analytics-schema';
import { CATEGORY_LABELS } from './overrun-heatmap';

export interface CategoryStackChartProps {
  projects: readonly AnalyticsProject[];
}

const TITLE = 'Cost structure by category';

/** Forecast (EAC) of each project stacked by cost category. */
export function CategoryStackChart({ projects }: CategoryStackChartProps) {
  const data = projects.map((p) => ({
    name: p.name,
    ...Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, p.byCategory[c].forecast]),
    ),
  }));
  if (data.length === 0 || projects.every((p) => p.summary.forecast === 0)) {
    return (
      <Card>
        <SectionTitle>{TITLE}</SectionTitle>
        <EmptyState title="No costs to show" />
      </Card>
    );
  }
  return (
    <ChartCard title={TITLE} subtitle="Forecast (EAC) per project">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v: number) => formatEurWhole(v)}
          width={96}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(v) => formatEurWhole(Number(v))}
        />
        <Legend />
        {COST_CATEGORIES.map((c) => (
          <Bar
            key={c}
            dataKey={c}
            name={CATEGORY_LABELS[c]}
            stackId="eac"
            fill={CATEGORY_COLORS[c]}
          />
        ))}
      </BarChart>
    </ChartCard>
  );
}
