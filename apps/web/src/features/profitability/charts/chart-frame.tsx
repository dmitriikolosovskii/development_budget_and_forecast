import type { ReactElement, ReactNode } from 'react';
import { formatEurWhole } from '@default-project/budget-engine';
import { Card, ChartCard, EmptyState, SectionTitle } from '../../../ui';

export interface ChartFrameProps {
  title: string;
  subtitle?: ReactNode;
  empty: boolean;
  emptyText?: string;
  height?: number;
  children: ReactElement;
}

/** ChartCard with a shared empty state (no crash, no blank axes). */
export function ChartFrame({
  title,
  subtitle,
  empty,
  emptyText = 'No data yet',
  height,
  children,
}: ChartFrameProps) {
  if (empty) {
    return (
      <Card data-testid="chart-empty">
        <SectionTitle subtitle={subtitle}>{title}</SectionTitle>
        <EmptyState
          title={emptyText}
          description="Add budget lines and cost items to see this chart."
        />
      </Card>
    );
  }
  return (
    <ChartCard title={title} subtitle={subtitle} height={height}>
      {children}
    </ChartCard>
  );
}

/** Axis ticks: 1234500 cents → "€12k". */
export function compactEur(cents: number): string {
  const eur = cents / 100;
  if (Math.abs(eur) >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}M`;
  if (Math.abs(eur) >= 1_000) return `€${Math.round(eur / 1_000)}k`;
  return `€${Math.round(eur)}`;
}

export const tooltipEur = (value: unknown) => formatEurWhole(Number(value));
