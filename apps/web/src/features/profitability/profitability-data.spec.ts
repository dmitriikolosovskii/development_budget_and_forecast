import {
  computeProfitability,
  makeItem,
  makeLine,
  summarizeProject,
} from '@default-project/budget-engine';
import type { CostItem } from '@default-project/types';
import {
  categoryRows,
  costSlices,
  marginTone,
  overrunRows,
  parseMarkupPercent,
  waterfallData,
} from './profitability-data';

// planned = qty 1.000 × price → price in cents
const item = (lineId: string, cents: number, extra: Partial<CostItem> = {}) =>
  makeItem({ budgetLineId: lineId, unitPriceCents: cents, ...extra });

function fixture() {
  const lines = [
    makeLine({
      id: 'land',
      category: 'LAND',
      section: 'purchase',
      name: 'Land purchase',
      approvedCents: 100_000,
    }),
    makeLine({
      id: 'con',
      category: 'MATERIALS',
      section: 'concrete',
      name: 'Concrete & reinforcement',
      approvedCents: 50_000,
    }),
    makeLine({
      id: 'ele',
      category: 'MATERIALS',
      section: 'electrical',
      name: 'Electrical',
      approvedCents: 30_000,
    }),
    makeLine({
      id: 'ctg',
      category: 'CONSTRUCTION',
      section: 'contingency',
      name: 'Contingency reserve',
      approvedCents: 0,
    }),
  ];
  const items = [
    item('land', 90_000), // saving 10,000
    item('con', 65_000), // overrun 15,000
    item('ele', 31_000), // overrun 1,000
    item('ctg', 2_000), // overrun on a 0-approved line
  ];
  return summarizeProject({ budgetLines: lines, items });
}

describe('waterfallData', () => {
  it('should start at approved, reach EAC after the categories and end at the contract price [AC-06.12]', () => {
    const rollup = fixture();
    const p = computeProfitability(rollup.project, 1500);
    const steps = waterfallData(rollup, p);

    expect(steps[0]).toMatchObject({
      key: 'approved',
      kind: 'total',
      base: 0,
      height: 180_000,
    });
    const eac = steps.find((s) => s.key === 'forecast');
    expect(eac).toMatchObject({
      kind: 'total',
      base: 0,
      height: rollup.project.forecast,
    });
    // running value after the five category steps equals EAC
    const cats = steps.slice(1, 6);
    expect(
      rollup.project.approved + cats.reduce((s, c) => s + c.delta, 0),
    ).toBe(rollup.project.forecast);
    const last = steps[steps.length - 1];
    expect(last).toMatchObject({
      key: 'contractPrice',
      kind: 'total',
      base: 0,
      height: p.contractPrice,
    });
    const profit = steps.find((s) => s.key === 'profit');
    expect(profit?.delta).toBe(p.forecastProfit);
  });

  it('should float a negative step on the lower value with height |delta| [AC-06.12]', () => {
    const rollup = fixture();
    const steps = waterfallData(
      rollup,
      computeProfitability(rollup.project, 1500),
    );
    const land = steps.find((s) => s.key === 'LAND');

    expect(land).toMatchObject({
      kind: 'down',
      delta: -10_000,
      base: 170_000,
      height: 10_000,
    });
    const materials = steps.find((s) => s.key === 'MATERIALS');
    expect(materials).toMatchObject({
      kind: 'up',
      delta: 16_000,
      base: 170_000,
      height: 16_000,
    });
  });

  it('should show a negative profit step as a loss when the forecast exceeds the contract price [AC-06.12]', () => {
    const rollup = fixture();
    const p = computeProfitability(rollup.project, 0); // contract price = approved < forecast
    const profit = waterfallData(rollup, p).find((s) => s.key === 'profit');

    expect(p.forecastProfit).toBeLessThan(0);
    expect(profit).toMatchObject({
      kind: 'down',
      base: p.contractPrice,
      height: -p.forecastProfit,
    });
  });
});

describe('overrunRows', () => {
  it('should join overrun lines with their approved and forecast and show "—" for a 0-approved line [AC-06.13]', () => {
    const rows = overrunRows(fixture());

    expect(rows.map((r) => r.lineId)).toEqual(['con', 'ctg', 'ele']);
    expect(rows[0]).toMatchObject({
      approved: 50_000,
      forecast: 65_000,
      overrunCents: 15_000,
      overrunBps: 3000,
    });
    expect(rows[1].overrunBps).toBeNull();
  });
});

describe('category rows and slices', () => {
  it('should give one row per category and slices from the forecast', () => {
    const rollup = fixture();

    expect(categoryRows(rollup).map((r) => r.key)).toEqual([
      'LAND',
      'ARCHITECTURE',
      'MATERIALS',
      'CONSTRUCTION',
      'MARKETING',
    ]);
    expect(costSlices(rollup).find((s) => s.key === 'MATERIALS')?.value).toBe(
      96_000,
    );
  });
});

describe('marginTone', () => {
  it('should be risk when profit is negative and ok otherwise [AC-06.13]', () => {
    expect(marginTone(-1)).toBe('risk');
    expect(marginTone(0)).toBe('ok');
  });
});

describe('parseMarkupPercent', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12,5 %', 1250],
    ['0', 0],
    ['30', 3000],
    ['45', 3000],
    ['12.3', 1250],
    ['12.2', 1200],
    ['7.75', 800],
  ])(
    'should parse %s as %i bps (clamped to 0–30 %%, snapped to 0.5 %%) [AC-06.2]',
    (input, bps) => {
      expect(parseMarkupPercent(input)).toBe(bps);
    },
  );

  it.each(['', 'abc', '-3', '1.234', '12..5'])(
    'should reject %s [AC-06.2]',
    (input) => {
      expect(parseMarkupPercent(input)).toBeNull();
    },
  );
});
