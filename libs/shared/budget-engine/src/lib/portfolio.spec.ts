import type { CashflowMonth, ProjectStatus } from '@default-project/types';
import {
  aggregatePortfolio,
  clipCashflow,
  mergeCashflows,
  summarizePortfolio,
  summarizePortfolioExtended,
  type PortfolioSnapshot,
} from './portfolio';
import { computeProfitability } from './profitability';
import { summarizeProject } from './rollup';
import { makeItem, makeLine } from './testing';

function snapshot(
  id: string,
  opts: {
    approved: number[];
    planned: number[];
    markupBps?: number;
    status?: ProjectStatus;
  },
): PortfolioSnapshot {
  const budgetLines = opts.approved.map((approvedCents, i) =>
    makeLine({
      id: `${id}-line-${i}`,
      projectId: id,
      category: i % 2 === 0 ? 'MATERIALS' : 'CONSTRUCTION',
      section: `s${i}`,
      name: `Line ${i}`,
      approvedCents,
    }),
  );
  const items = opts.planned.map((cents, i) =>
    makeItem({
      id: `${id}-item-${i}`,
      projectId: id,
      budgetLineId: budgetLines[i % budgetLines.length].id,
      qtyMilli: 1000,
      unitPriceCents: cents,
      actualCents: Math.floor(cents / 3),
      committedCents: Math.floor(cents / 2),
    }),
  );
  return {
    project: {
      id,
      slug: id,
      name: `Project ${id}`,
      city: 'Leipzig',
      status: opts.status ?? 'ACTIVE',
      markupBps: opts.markupBps ?? 1500,
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    },
    budgetLines,
    items,
  };
}

const month = (
  m: string,
  planned: number,
  actual: number,
  forecast: number,
): CashflowMonth => ({
  month: m,
  planned,
  actual,
  forecast,
  cumulativePlanned: 0,
  cumulativeActual: 0,
  cumulativeForecast: 0,
});

describe('summarizePortfolio', () => {
  const a = snapshot('a', {
    approved: [100_001, 50_003],
    planned: [99_999, 60_007, 1],
  });
  const b = snapshot('b', { approved: [333_333], planned: [333_334, 17] });

  it('should return totals equal to the exact-cent sums of each project summary [AC-11.1]', () => {
    const result = summarizePortfolio([a, b]);
    const sa = summarizeProject(a).project;
    const sb = summarizeProject(b).project;

    for (const k of [
      'approved',
      'planned',
      'committed',
      'actual',
      'openCommitments',
      'exposure',
      'forecast',
    ] as const) {
      expect(result.totals[k]).toBe(sa[k] + sb[k]);
    }
    expect(result.totals.variance).toBe(sa.variance + sb.variance);
    expect(result.byCategory.MATERIALS.forecast).toBe(
      summarizeProject(a).byCategory.MATERIALS.forecast +
        summarizeProject(b).byCategory.MATERIALS.forecast,
    );
    expect(result.projects.map((p) => p.projectId)).toEqual(['a', 'b']);
  });

  it('should leave out a project that the caller did not pass (templates are excluded by the caller) [AC-11.1]', () => {
    const result = summarizePortfolio([a]);

    expect(result.totals.approved).toBe(150_004);
    expect(result.totals.approved).not.toBe(150_004 + 333_333);
    expect(result.projects).toHaveLength(1);
  });

  it('should return zero totals and no rows when the portfolio is empty', () => {
    const result = summarizePortfolio([]);

    expect(result.projects).toEqual([]);
    expect(result.totals.forecast).toBe(0);
    expect(result.profitability.marginBps).toBe(0);
  });

  it('should count overrun lines and keep project dates in the extended rows', () => {
    const over = snapshot('o', { approved: [100, 100], planned: [500, 50] });

    const [row] = summarizePortfolioExtended([over]).projects;

    expect(row.overrunLineCount).toBe(1);
    expect(row.startDate).toBe('2026-04-01');
    expect(row.endDate).toBe('2027-03-31');
  });
});

describe('aggregatePortfolio profitability', () => {
  it('should sum per-project profitability and derive margin from the sums when markups differ [AC-11.6]', () => {
    const p1 = snapshot('p1', {
      approved: [1_000_000],
      planned: [1_100_000],
      markupBps: 1500,
    });
    const p2 = snapshot('p2', {
      approved: [333_333],
      planned: [300_001],
      markupBps: 1200,
    });
    const rows = summarizePortfolioExtended([p1, p2]).projects;

    const { profitability, totals } = aggregatePortfolio(rows);

    const [r1, r2] = rows.map((r) => r.profitability);
    expect(profitability.contractPrice).toBe(
      r1.contractPrice + r2.contractPrice,
    );
    expect(profitability.forecastProfit).toBe(
      r1.forecastProfit + r2.forecastProfit,
    );
    expect(profitability.plannedProfit).toBe(
      r1.plannedProfit + r2.plannedProfit,
    );
    expect(profitability.profitErosion).toBe(
      r1.profitErosion + r2.profitErosion,
    );
    // 1,150,000 + 373,333 = 1,523,333; profit 50,000 + 73,332 = 123,332 → 809.6… bps → 810
    expect(profitability.marginBps).toBe(810);
    expect(profitability).not.toEqual(computeProfitability(totals, 1500));
    expect(profitability).not.toEqual(computeProfitability(totals, 1200));
  });

  it('should give margin 0 without NaN when the contract price sum is 0 [AC-11.6]', () => {
    const empty = snapshot('e', { approved: [0], planned: [] });

    const { profitability } = aggregatePortfolio(
      summarizePortfolioExtended([empty]).projects,
    );

    expect(profitability.marginBps).toBe(0);
  });
});

describe('mergeCashflows', () => {
  it('should fill gaps between disjoint ranges and recompute cumulatives as running sums [AC-11.7]', () => {
    const p1 = [month('2025-11', 100, 50, 110), month('2025-12', 200, 0, 190)];
    const p2 = [month('2026-02', 1, 2, 3)];

    const merged = mergeCashflows([p1, p2]);

    expect(merged.map((m) => m.month)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(merged[2]).toMatchObject({
      planned: 0,
      actual: 0,
      forecast: 0,
      cumulativePlanned: 300,
    });
    expect(merged[3]).toMatchObject({
      cumulativePlanned: 301,
      cumulativeActual: 52,
      cumulativeForecast: 303,
    });
  });

  it('should add monthly amounts of overlapping months and never the input cumulatives [AC-11.7]', () => {
    const p1 = [{ ...month('2026-03', 10, 1, 10), cumulativePlanned: 999 }];
    const p2 = [{ ...month('2026-03', 5, 0, 7), cumulativePlanned: 555 }];

    const [only] = mergeCashflows([p1, p2]);

    expect(only).toMatchObject({
      planned: 15,
      actual: 1,
      forecast: 17,
      cumulativePlanned: 15,
    });
    expect(only.cumulativePlanned).not.toBe(999 + 555);
  });

  it('should keep exact cents: the sum of merged months equals the sum of inputs [AC-11.7]', () => {
    const p1 = [
      month('2026-01', 33_334, 1, 33_334),
      month('2026-02', 33_333, 0, 33_333),
    ];
    const p2 = [month('2026-02', 1, 1, 1), month('2026-05', 7, 0, 9)];

    const merged = mergeCashflows([p1, p2]);

    expect(merged.reduce((s, m) => s + m.planned, 0)).toBe(66_675);
    expect(merged.at(-1)?.cumulativeForecast).toBe(66_677);
  });

  it('should return [] when there are no months [AC-11.7]', () => {
    expect(mergeCashflows([])).toEqual([]);
    expect(mergeCashflows([[], []])).toEqual([]);
  });
});

describe('clipCashflow', () => {
  it('should keep only months inside the period and keep the cumulative history [AC-11.8]', () => {
    const merged = mergeCashflows([
      [
        month('2025-12', 100, 0, 100),
        month('2026-01', 10, 0, 10),
        month('2027-01', 1, 0, 1),
      ],
    ]);

    const clipped = clipCashflow(merged, '2026-01', '2026-12');

    expect(clipped.map((m) => m.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
    expect(clipped[0].cumulativePlanned).toBe(110);
    expect(clipped[0].cumulativePlanned).not.toBe(10);
  });
});
