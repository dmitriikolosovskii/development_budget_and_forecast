import type { CostItem } from '@default-project/types';
import { monthlyCashflow } from './cashflow';
import { summarizeProject } from './rollup';
import { makeItem, makeLine } from './testing';

const TODAY = '2026-10-14';
const line = makeLine({ id: 'line-1', category: 'CONSTRUCTION' });
const snap = (...items: CostItem[]) => ({ budgetLines: [line], items });
// planned = qty 1.000 × price → price in cents
const work = (
  cents: number,
  startDate: string | null,
  endDate: string | null,
  extra: Partial<CostItem> = {},
) =>
  makeItem({
    kind: 'WORK',
    unitPriceCents: cents,
    startDate,
    endDate,
    ...extra,
  });
const material = (
  cents: number,
  deliveryDate: string | null,
  extra: Partial<CostItem> = {},
) =>
  makeItem({ kind: 'MATERIAL', unitPriceCents: cents, deliveryDate, ...extra });

const byMonth = (cf: ReturnType<typeof monthlyCashflow>) =>
  Object.fromEntries(cf.months.map((m) => [m.month, m]));

describe('monthlyCashflow', () => {
  it('should split a 3-month work item evenly with the cent remainder in the first month [AC-06.1]', () => {
    const cf = monthlyCashflow(
      snap(work(10000, '2026-01-15', '2026-03-10')),
      TODAY,
    );

    expect(cf.months.map((m) => [m.month, m.planned, m.forecast])).toEqual([
      ['2026-01', 3334, 3334],
      ['2026-02', 3333, 3333],
      ['2026-03', 3333, 3333],
    ]);
    expect(cf.months.reduce((s, m) => s + m.planned, 0)).toBe(10000);
    expect(cf.unscheduled).toEqual({ planned: 0, forecast: 0 });
  });

  it('should put a MATERIAL into its delivery month and actual into the deliveredDate month [AC-06.1]', () => {
    const cf = monthlyCashflow(
      snap(
        material(5000, '2026-03-20', {
          actualCents: 4800,
          deliveredDate: '2026-04-02',
          status: 'DONE',
        }),
      ),
      TODAY,
    );
    const m = byMonth(cf);

    expect(m['2026-03']).toMatchObject({
      planned: 5000,
      forecast: 4800,
      actual: 0,
    });
    expect(m['2026-04']).toMatchObject({
      planned: 0,
      forecast: 0,
      actual: 4800,
    });
  });

  it('should send actual to endDate, then startDate, then the today month when deliveredDate is missing [AC-06.1]', () => {
    const cf = monthlyCashflow(
      snap(
        work(100, '2026-01-05', '2026-02-05', { actualCents: 10 }),
        work(100, '2026-03-05', null, { actualCents: 20 }),
        makeItem({ kind: 'SERVICE', unitPriceCents: 100, actualCents: 30 }),
      ),
      TODAY,
    );
    const m = byMonth(cf);

    expect(m['2026-02'].actual).toBe(10);
    expect(m['2026-03'].actual).toBe(20);
    expect(m['2026-10'].actual).toBe(30);
    expect(m['2026-01'].actual).toBe(0);
  });

  it('should put rows without plan dates into unscheduled [AC-06.1]', () => {
    const cf = monthlyCashflow(
      snap(makeItem({ kind: 'SERVICE', unitPriceCents: 700 })),
      TODAY,
    );

    expect(cf.unscheduled).toEqual({ planned: 700, forecast: 700 });
    expect(cf.months).toEqual([]);
  });

  it('should list continuous months with zeros and monotonic cumulatives when there are gaps [AC-06.1]', () => {
    const cf = monthlyCashflow(
      snap(
        material(100, '2026-01-10', {
          actualCents: 50,
          deliveredDate: '2026-01-10',
        }),
        material(300, '2026-04-10'),
      ),
      TODAY,
    );

    expect(cf.months.map((m) => m.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
    expect(cf.months[1]).toMatchObject({
      planned: 0,
      actual: 0,
      forecast: 0,
      cumulativePlanned: 100,
    });
    expect(cf.months.map((m) => m.cumulativePlanned)).toEqual([
      100, 100, 100, 400,
    ]);
    expect(cf.months.map((m) => m.cumulativeActual)).toEqual([50, 50, 50, 50]);
    expect(cf.months.map((m) => m.cumulativeForecast)).toEqual([
      100, 100, 100, 400,
    ]);
  });

  it('should fall back to deliveredDate for a MATERIAL without deliveryDate [AC-06.1]', () => {
    const cf = monthlyCashflow(
      snap(
        material(900, null, { deliveredDate: '2026-05-03', actualCents: 900 }),
      ),
      TODAY,
    );

    expect(byMonth(cf)['2026-05']).toMatchObject({ planned: 900, actual: 900 });
    expect(cf.unscheduled.planned).toBe(0);
  });

  it('should preserve project planned, forecast and actual to the cent across months and unscheduled [AC-06.8]', () => {
    const s = snap(
      work(100001, '2026-02-01', '2026-08-31', {
        committedCents: 120000,
        status: 'PARTIAL',
        actualCents: 40000,
      }),
      work(7, '2026-05-01', '2026-07-01'),
      material(33333, '2026-06-30', {
        committedCents: 30000,
        status: 'CONTRACTED',
        actualCents: 30000,
        deliveredDate: '2026-07-01',
      }),
      makeItem({ kind: 'SERVICE', unitPriceCents: 999, actualCents: 111 }),
      material(12345, null, { qtyMilli: 2500 }),
    );
    const cf = monthlyCashflow(s, TODAY);
    const total = summarizeProject(s).project;
    const sum = (k: 'planned' | 'forecast' | 'actual') =>
      cf.months.reduce((a, m) => a + m[k], 0);

    expect(sum('planned') + cf.unscheduled.planned).toBe(total.planned);
    expect(sum('forecast') + cf.unscheduled.forecast).toBe(total.forecast);
    expect(sum('actual')).toBe(total.actual);
    const last = cf.months[cf.months.length - 1];
    expect(last.cumulativePlanned).toBe(sum('planned'));
    expect(last.cumulativeForecast).toBe(sum('forecast'));
    expect(last.cumulativeActual).toBe(total.actual);
  });

  it('should put everything into the start month when endDate is before startDate [AC-06.9]', () => {
    const cf = monthlyCashflow(
      snap(work(600, '2026-05-10', '2026-03-01')),
      TODAY,
    );

    expect(cf.months).toEqual([
      expect.objectContaining({
        month: '2026-05',
        planned: 600,
        forecast: 600,
      }),
    ]);
  });

  it('should use the single month when a work item has only one date [AC-06.9]', () => {
    const cf = monthlyCashflow(snap(work(400, null, '2026-07-31')), TODAY);

    expect(cf.months).toEqual([
      expect.objectContaining({ month: '2026-07', planned: 400 }),
    ]);
  });

  it('should roll over the year boundary and keep Feb 29 in February [AC-06.10]', () => {
    const cf = monthlyCashflow(
      snap(work(300, '2026-11-15', '2027-01-10'), material(50, '2028-02-29')),
      TODAY,
    );
    const m = byMonth(cf);

    expect(cf.months.slice(0, 3).map((x) => [x.month, x.planned])).toEqual([
      ['2026-11', 100],
      ['2026-12', 100],
      ['2027-01', 100],
    ]);
    expect(m['2028-02'].planned).toBe(50);
    expect(cf.months).toHaveLength(16); // 2026-11 … 2028-02, no gaps
  });

  it('should return no months and zero unscheduled when the snapshot is empty [AC-06.11]', () => {
    expect(monthlyCashflow(snap(), TODAY)).toEqual({
      months: [],
      unscheduled: { planned: 0, forecast: 0 },
    });
  });
});
