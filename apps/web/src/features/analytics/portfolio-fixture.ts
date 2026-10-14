import {
  makeItem,
  makeLine,
  mergeCashflows,
  summarizePortfolioExtended,
  type PortfolioSnapshot,
} from '@default-project/budget-engine';
import type {
  CashflowMonth,
  CostCategory,
  ProjectStatus,
} from '@default-project/types';
import type { AnalyticsProject, AnalyticsResponse } from './analytics-schema';

interface Spec {
  id: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  /** [category, approved, planned] */
  lines: Array<[CostCategory, number, number]>;
  months: Array<[string, number]>;
}

const month = (m: string, cents: number): CashflowMonth => ({
  month: m,
  planned: cents,
  actual: 0,
  forecast: cents,
  cumulativePlanned: 0,
  cumulativeActual: 0,
  cumulativeForecast: 0,
});

/** Test-only portfolio shaped like the seed (03 HANDOFF): Markranstädt COMPLETED, Taucha ACTIVE, Markkleeberg PLANNING. */
export const SPECS: Spec[] = [
  {
    id: 'p-mark',
    name: 'Bungalow Markranstädt',
    status: 'COMPLETED',
    startDate: '2024-10-01',
    endDate: '2025-09-30',
    lines: [
      ['MATERIALS', 100_000, 101_000],
      ['CONSTRUCTION', 50_000, 49_000],
    ],
    months: [
      ['2024-11', 60_000],
      ['2025-06', 90_000],
    ],
  },
  {
    id: 'p-taucha',
    name: 'Stadtvilla Taucha',
    status: 'ACTIVE',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    lines: [
      ['MATERIALS', 200_000, 210_000],
      ['LAND', 80_000, 80_000],
    ],
    months: [
      ['2026-05', 100_000],
      ['2027-02', 190_000],
    ],
  },
  {
    id: 'p-kleeberg',
    name: 'Villa Markkleeberg',
    status: 'PLANNING',
    startDate: '2027-04-01',
    endDate: '2028-03-31',
    lines: [['CONSTRUCTION', 300_000, 250_000]],
    months: [['2027-06', 250_000]],
  },
];

export function makeAnalyticsProjects(
  specs: Spec[] = SPECS,
): AnalyticsProject[] {
  const snapshots: PortfolioSnapshot[] = specs.map((s) => {
    const budgetLines = s.lines.map(([category, approvedCents], i) =>
      makeLine({
        id: `${s.id}-l${i}`,
        projectId: s.id,
        category,
        section: `s${i}`,
        name: `${category} ${i}`,
        approvedCents,
      }),
    );
    const items = s.lines.map(([, , planned], i) =>
      makeItem({
        id: `${s.id}-i${i}`,
        projectId: s.id,
        budgetLineId: `${s.id}-l${i}`,
        unitPriceCents: planned,
      }),
    );
    return {
      project: {
        id: s.id,
        slug: s.id,
        name: s.name,
        city: 'Leipzig',
        status: s.status,
        markupBps: 1500,
        startDate: s.startDate,
        endDate: s.endDate,
      },
      budgetLines,
      items,
    };
  });
  return summarizePortfolioExtended(snapshots).projects.map((row, i) => ({
    ...row,
    cashflow: mergeCashflows([specs[i].months.map(([m, c]) => month(m, c))]),
    delivery: {
      deliveredRows: 2,
      onTimeRows: 1,
      overdueItems: i === 1 ? 1 : 0,
    },
  }));
}

export function makeAnalyticsResponse(
  projects: AnalyticsProject[] = makeAnalyticsProjects(),
): AnalyticsResponse {
  const base = summarizePortfolioExtended([]);
  return {
    totals: base.totals,
    profitability: base.profitability,
    byCategory: base.byCategory,
    projects,
    cashflow: mergeCashflows(projects.map((p) => p.cashflow)),
  };
}
