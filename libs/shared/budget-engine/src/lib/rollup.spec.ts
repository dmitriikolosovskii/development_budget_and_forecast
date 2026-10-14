import {
  COST_CATEGORIES,
  type CostCategory,
  type ItemStatus,
} from '@default-project/types';
import {
  itemExposure,
  itemForecastCents,
  itemOpenCommitment,
  summarizeProject,
} from './rollup';
import { itemPlannedCents } from './money';
import { makeItem, makeLine } from './testing';

// planned = qty 1.000 × price → price in cents
const row = (
  status: ItemStatus,
  planned: number,
  committed: number,
  actual: number,
) =>
  makeItem({
    status,
    qtyMilli: 1000,
    unitPriceCents: planned,
    committedCents: committed,
    actualCents: actual,
  });

describe('itemForecastCents', () => {
  it('should use actual when the row is DONE [AC-01.3]', () => {
    expect(itemForecastCents(row('DONE', 120, 100, 70))).toBe(70);
  });

  it('should use max(actual, committed) when the row is CONTRACTED [AC-01.3]', () => {
    expect(itemForecastCents(row('CONTRACTED', 999, 80, 50))).toBe(80);
    expect(itemForecastCents(row('CONTRACTED', 999, 80, 90))).toBe(90);
  });

  it('should count the uncontracted remainder when PLANNED/PARTIAL with committed < planned [AC-01.3]', () => {
    expect(itemForecastCents(row('PLANNED', 100, 60, 10))).toBe(100);
    expect(itemForecastCents(row('PARTIAL', 100, 60, 10))).toBe(100);
  });

  it('should use committed when it exceeds planned [AC-01.3]', () => {
    expect(itemForecastCents(row('PLANNED', 100, 150, 0))).toBe(150);
  });

  it('should use actual when it exceeds everything else [AC-01.3]', () => {
    expect(itemForecastCents(row('PARTIAL', 100, 60, 200))).toBe(200);
  });

  it('should derive open commitment and exposure from committed and actual', () => {
    expect(itemOpenCommitment(row('PARTIAL', 0, 80, 30))).toBe(50);
    expect(itemOpenCommitment(row('PARTIAL', 0, 30, 80))).toBe(0);
    expect(itemExposure(row('PARTIAL', 0, 80, 30))).toBe(80);
  });
});

// Deterministic PRNG (mulberry32) so the property test is reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('summarizeProject', () => {
  it('should be additive row → line → category → project over 500 random rows [AC-01.4]', () => {
    const rand = rng(42);
    const int = (max: number) => Math.floor(rand() * max);
    const statuses: ItemStatus[] = ['PLANNED', 'PARTIAL', 'CONTRACTED', 'DONE'];
    const lines = COST_CATEGORIES.flatMap((category, ci) =>
      [0, 1, 2].map((j) =>
        makeLine({
          id: `L${ci}-${j}`,
          category,
          section: `s${j}`,
          approvedCents: int(5_000_000),
        }),
      ),
    );
    const items = Array.from({ length: 500 }, (_, i) =>
      makeItem({
        id: `I${i}`,
        budgetLineId: lines[int(lines.length)].id,
        status: statuses[int(4)],
        qtyMilli: int(100_000),
        unitPriceCents: int(100_000),
        committedCents: int(3_000_000),
        actualCents: int(3_000_000),
      }),
    );

    const s = summarizeProject({ budgetLines: lines, items });
    const fields = [
      'approved',
      'planned',
      'committed',
      'actual',
      'openCommitments',
      'exposure',
      'forecast',
    ] as const;

    const rowValues = (r: (typeof items)[number]) => {
      const open = Math.max(r.committedCents - r.actualCents, 0);
      return {
        approved: 0,
        planned: itemPlannedCents(r),
        committed: r.committedCents,
        actual: r.actualCents,
        openCommitments: open,
        exposure: r.actualCents + open,
        forecast: itemForecastCents(r),
      };
    };
    for (const line of lines) {
      const rows = items
        .filter((i) => i.budgetLineId === line.id)
        .map(rowValues);
      for (const f of fields) {
        const expected =
          f === 'approved'
            ? line.approvedCents
            : rows.reduce((a, r) => a + r[f], 0);
        expect([line.id, f, s.byLine[line.id][f]]).toEqual([
          line.id,
          f,
          expected,
        ]);
      }
    }
    for (const f of fields) {
      for (const c of COST_CATEGORIES) {
        const lineSum = lines
          .filter((l) => l.category === c)
          .reduce((a, l) => a + s.byLine[l.id][f], 0);
        expect(s.byCategory[c][f]).toBe(lineSum);
      }
      const catSum = COST_CATEGORIES.reduce(
        (a, c: CostCategory) => a + s.byCategory[c][f],
        0,
      );
      expect(s.project[f]).toBe(catSum);
      expect(Number.isInteger(s.project[f])).toBe(true);
    }
  });

  it('should return zeros and 0 bps when the project is empty', () => {
    const s = summarizeProject({ budgetLines: [], items: [] });
    expect(s.project).toMatchObject({
      approved: 0,
      forecast: 0,
      spentBps: 0,
      forecastVsApprovedBps: 0,
      overrun: false,
    });
    expect(Object.keys(s.byCategory)).toEqual([...COST_CATEGORIES]);
  });

  it('should not flag an overrun when forecast equals approved [AC-01.5]', () => {
    const line = makeLine({ id: 'L', approvedCents: 100 });
    const s = summarizeProject({
      budgetLines: [line],
      items: [row('PLANNED', 100, 0, 0)].map((i) => ({
        ...i,
        budgetLineId: 'L',
      })),
    });
    expect(s.byLine['L']).toMatchObject({ overrun: false, variance: 0 });
    expect(s.overrunLines).toEqual([]);
  });

  it('should flag an overrun with negative variance when forecast exceeds approved by 1¢ [AC-01.5]', () => {
    const line = makeLine({ id: 'L', approvedCents: 100 });
    const s = summarizeProject({
      budgetLines: [line],
      items: [{ ...row('PLANNED', 101, 0, 0), budgetLineId: 'L' }],
    });
    expect(s.byLine['L']).toMatchObject({
      overrun: true,
      variance: -1,
      forecastVsApprovedBps: 10100,
    });
  });

  it('should sort overrun lines by overrun desc, then by name [AC-01.5]', () => {
    const lines = [
      makeLine({ id: 'A', name: 'A', approvedCents: 0 }),
      makeLine({ id: 'B', name: 'B', approvedCents: 0 }),
      makeLine({ id: 'C', name: 'C', approvedCents: 0 }),
      makeLine({ id: 'D', name: 'D', approvedCents: 0 }),
    ];
    const over = (lineId: string, cents: number) => ({
      ...row('DONE', 0, 0, cents),
      budgetLineId: lineId,
    });
    const s = summarizeProject({
      budgetLines: lines,
      items: [over('A', 50), over('B', 200), over('C', 10), over('D', 50)],
    });
    expect(s.overrunLines.map((l) => [l.lineId, l.overrunCents])).toEqual([
      ['B', 200],
      ['A', 50],
      ['D', 50],
      ['C', 10],
    ]);
  });

  it('should compute spent and forecast bps against approved', () => {
    const line = makeLine({ id: 'L', approvedCents: 300 });
    const s = summarizeProject({
      budgetLines: [line],
      items: [{ ...row('CONTRACTED', 0, 200, 100), budgetLineId: 'L' }],
    });
    expect(s.project).toMatchObject({
      actual: 100,
      spentBps: 3333,
      forecast: 200,
      forecastVsApprovedBps: 6667,
      exposure: 200,
      openCommitments: 100,
    });
  });
});
