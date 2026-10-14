import {
  aggregatePortfolio,
  clipCashflow,
  mergeCashflows,
  type PortfolioAggregate,
} from '@default-project/budget-engine';
import type { CashflowMonth, ProjectStatus } from '@default-project/types';
import type { AnalyticsProject } from './analytics-schema';

export type StatusFilter = 'ALL' | ProjectStatus;
/** 'ALL' or a calendar year 'YYYY'. */
export type PeriodFilter = string;

export interface PortfolioFilters {
  status: StatusFilter;
  period: PeriodFilter;
}

export interface FilteredPortfolio extends PortfolioAggregate {
  projects: AnalyticsProject[];
  cashflow: CashflowMonth[];
}

/** Years covered by any project's [startDate, endDate], ascending. */
export function periodYears(
  projects: readonly Pick<AnalyticsProject, 'startDate' | 'endDate'>[],
): string[] {
  const years = new Set<number>();
  for (const p of projects) {
    const from = Number(p.startDate.slice(0, 4));
    const to = Math.max(from, Number(p.endDate.slice(0, 4)));
    for (let y = from; y <= to; y++) years.add(y);
  }
  return [...years].sort((a, b) => a - b).map(String);
}

/** A project belongs to year Y when its dates overlap Y (touching an edge counts). */
export function overlapsYear(
  p: Pick<AnalyticsProject, 'startDate' | 'endDate'>,
  year: string,
): boolean {
  return p.startDate <= `${year}-12-31` && p.endDate >= `${year}-01-01`;
}

/**
 * Owner's rule: status and period select projects; KPIs cover the selected projects over their whole life;
 * only the cash flow is clipped to the period (cumulatives keep the earlier history).
 */
export function filterPortfolio(
  projects: readonly AnalyticsProject[],
  filters: PortfolioFilters,
): FilteredPortfolio {
  const selected = projects.filter(
    (p) =>
      (filters.status === 'ALL' || p.status === filters.status) &&
      (filters.period === 'ALL' || overlapsYear(p, filters.period)),
  );
  const merged = mergeCashflows(selected.map((p) => p.cashflow));
  const cashflow =
    filters.period === 'ALL'
      ? merged
      : clipCashflow(merged, `${filters.period}-01`, `${filters.period}-12`);
  return { ...aggregatePortfolio(selected), projects: selected, cashflow };
}
