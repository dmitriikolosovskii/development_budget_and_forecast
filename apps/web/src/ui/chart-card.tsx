import type { ReactElement, ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { Card, SectionTitle } from './card';

/** Fixed chart colours (DESIGN-SYSTEM §1). */
export const CHART_COLORS = {
  budget: '#9db4ff',
  actual: '#5b7cfa',
  commitments: '#7cc8e8',
  forecast: '#f2a65a',
  overrun: '#d1495b',
  profit: '#1f9d6b',
} as const;

export const CATEGORY_COLORS = {
  LAND: '#8fb9a8',
  ARCHITECTURE: '#b49fdc',
  MATERIALS: '#f2c38b',
  CONSTRUCTION: '#7fa7e6',
  MARKETING: '#f19fb5',
} as const;

/** Shared tooltip/legend styling for recharts. */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: { borderRadius: 12, border: '1px solid #e3e8f0', boxShadow: '0 4px 16px rgb(31 42 61 / 0.06)', fontSize: 12 },
};

export interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** A single recharts chart element; wrapped in ResponsiveContainer. */
  children: ReactElement;
  height?: number;
}

export function ChartCard({ title, subtitle, actions, children, height = 280 }: ChartCardProps) {
  return (
    <Card>
      <SectionTitle subtitle={subtitle} actions={actions}>
        {title}
      </SectionTitle>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
