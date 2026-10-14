import {
  COST_CATEGORIES,
  type CashflowMonth,
  type CostCategory,
  type PortfolioAnalytics,
  type PortfolioProject,
  type Profitability,
  type Summary,
} from '@default-project/types';
import type { EngineSnapshot } from './engine-types';
import { computeProfitability } from './profitability';
import { finalizeSummary, summarizeProject, toBps } from './rollup';

export interface PortfolioSnapshot extends EngineSnapshot {
  project: {
    id: string;
    slug: string;
    name: string;
    city: string;
    status: PortfolioAnalytics['projects'][number]['status'];
    markupBps: number;
    startDate: string;
    endDate: string;
  };
}

/** A portfolio row plus the fields proposed in CR-11 (dates for the period filter, overrun line count). */
export interface PortfolioProjectExtended extends PortfolioProject {
  startDate: string;
  endDate: string;
  overrunLineCount: number;
}

export type PortfolioAggregate = Pick<
  PortfolioAnalytics,
  'totals' | 'byCategory' | 'profitability'
>;

const AMOUNT_KEYS = [
  'approved',
  'planned',
  'committed',
  'actual',
  'openCommitments',
  'exposure',
  'forecast',
] as const;
type Amounts = Record<(typeof AMOUNT_KEYS)[number], number>;

function sumSummaries(summaries: readonly Summary[]): Summary {
  const acc = Object.fromEntries(AMOUNT_KEYS.map((k) => [k, 0])) as Amounts;
  for (const s of summaries) for (const k of AMOUNT_KEYS) acc[k] += s[k];
  return finalizeSummary(acc);
}

/**
 * Portfolio profitability = the sum of each project's profitability fields; margin = Σ forecast profit / Σ contract price.
 * `computeProfitability(totals, markup)` is not used: projects have different markups (CR-11).
 */
function sumProfitability(items: readonly Profitability[]): Profitability {
  const sum = (k: keyof Profitability) =>
    items.reduce((acc, p) => acc + p[k], 0);
  const contractPrice = sum('contractPrice');
  const forecastProfit = sum('forecastProfit');
  return {
    approved: sum('approved'),
    contractPrice,
    plannedProfit: sum('plannedProfit'),
    forecastProfit,
    marginBps: toBps(forecastProfit, contractPrice),
    profitErosion: sum('profitErosion'),
  };
}

/** Totals, categories and profitability of any subset of portfolio rows (used by the API and the web filters). */
export function aggregatePortfolio(
  projects: readonly Pick<
    PortfolioProject,
    'summary' | 'byCategory' | 'profitability'
  >[],
): PortfolioAggregate {
  return {
    totals: sumSummaries(projects.map((p) => p.summary)),
    byCategory: Object.fromEntries(
      COST_CATEGORIES.map((c) => [
        c,
        sumSummaries(projects.map((p) => p.byCategory[c])),
      ]),
    ) as Record<CostCategory, Summary>,
    profitability: sumProfitability(projects.map((p) => p.profitability)),
  };
}

export function summarizePortfolioExtended(
  snapshots: readonly PortfolioSnapshot[],
): PortfolioAggregate & { projects: PortfolioProjectExtended[] } {
  const projects = snapshots.map((snap): PortfolioProjectExtended => {
    const s = summarizeProject(snap);
    const { project } = snap;
    return {
      projectId: project.id,
      slug: project.slug,
      name: project.name,
      city: project.city,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      summary: s.project,
      profitability: computeProfitability(s.project, project.markupBps),
      byCategory: s.byCategory,
      overrunLineCount: s.overrunLines.length,
    };
  });
  return { ...aggregatePortfolio(projects), projects };
}

/**
 * Portfolio rollup across projects (CONTRACTS §3 "Portfolio"); the API adds `cashflow`.
 * Templates are excluded by the caller.
 */
export function summarizePortfolio(
  snapshots: readonly PortfolioSnapshot[],
): Omit<PortfolioAnalytics, 'cashflow'> {
  return summarizePortfolioExtended(snapshots);
}

const monthIndex = (m: string) =>
  Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthOf = (i: number) =>
  `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

/**
 * Sums several monthly cash flows: monthly amounts are added (never cumulatives), the month list is continuous
 * from the first to the last input month (gaps are zero), cumulatives are recomputed as running sums.
 */
export function mergeCashflows(
  series: readonly (readonly CashflowMonth[])[],
): CashflowMonth[] {
  const byMonth = new Map<
    number,
    { planned: number; actual: number; forecast: number }
  >();
  for (const months of series) {
    for (const m of months) {
      const i = monthIndex(m.month);
      const acc = byMonth.get(i) ?? { planned: 0, actual: 0, forecast: 0 };
      acc.planned += m.planned;
      acc.actual += m.actual;
      acc.forecast += m.forecast;
      byMonth.set(i, acc);
    }
  }
  if (byMonth.size === 0) return [];
  const keys = [...byMonth.keys()];
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  const out: CashflowMonth[] = [];
  let cp = 0;
  let ca = 0;
  let cf = 0;
  for (let i = first; i <= last; i++) {
    const { planned, actual, forecast } = byMonth.get(i) ?? {
      planned: 0,
      actual: 0,
      forecast: 0,
    };
    cp += planned;
    ca += actual;
    cf += forecast;
    out.push({
      month: monthOf(i),
      planned,
      actual,
      forecast,
      cumulativePlanned: cp,
      cumulativeActual: ca,
      cumulativeForecast: cf,
    });
  }
  return out;
}

/** Keeps months in [from, to] ('YYYY-MM', inclusive). Cumulatives keep the history before `from`. */
export function clipCashflow(
  months: readonly CashflowMonth[],
  from: string,
  to: string,
): CashflowMonth[] {
  return months.filter((m) => m.month >= from && m.month <= to);
}
