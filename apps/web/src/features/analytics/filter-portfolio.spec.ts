import { makeAnalyticsProjects } from './portfolio-fixture';
import { filterPortfolio, overlapsYear, periodYears } from './filter-portfolio';

const projects = makeAnalyticsProjects();
const names = (r: { projects: { name: string }[] }) =>
  r.projects.map((p) => p.name);

describe('filterPortfolio', () => {
  it('should leave only Markranstädt when the status filter is COMPLETED [AC-11.5]', () => {
    const result = filterPortfolio(projects, {
      status: 'COMPLETED',
      period: 'ALL',
    });

    expect(names(result)).toEqual(['Bungalow Markranstädt']);
    expect(names(result)).not.toContain('Stadtvilla Taucha');
    expect(result.totals.approved).toBe(150_000);
  });

  it('should keep projects whose dates overlap the year, touching edges included [AC-11.8]', () => {
    expect(
      overlapsYear({ startDate: '2025-12-31', endDate: '2026-02-01' }, '2025'),
    ).toBe(true);
    expect(
      overlapsYear({ startDate: '2026-01-01', endDate: '2026-01-01' }, '2026'),
    ).toBe(true);
    expect(
      overlapsYear({ startDate: '2027-01-01', endDate: '2028-01-01' }, '2026'),
    ).toBe(false);

    expect(
      names(filterPortfolio(projects, { status: 'ALL', period: '2027' })),
    ).toEqual(['Stadtvilla Taucha', 'Villa Markkleeberg']);
    expect(
      names(filterPortfolio(projects, { status: 'ALL', period: '2026' })),
    ).toEqual(['Stadtvilla Taucha']);
  });

  it('should keep whole-life KPIs and clip only the cash flow, keeping earlier cumulatives [AC-11.8]', () => {
    const result = filterPortfolio(projects, { status: 'ALL', period: '2027' });

    // Taucha's whole budget counts although part of it is spent in 2026.
    expect(result.totals.approved).toBe(280_000 + 300_000);
    expect(result.cashflow[0].month).toBe('2027-01');
    expect(result.cashflow.at(-1)?.month).toBe('2027-06');
    // The 2026-05 Taucha amount stays in the cumulative of the first clipped month.
    expect(result.cashflow[0].cumulativePlanned).toBe(100_000);
    expect(result.cashflow.find((m) => m.month === '2026-05')).toBeUndefined();
  });

  it('should list every year covered by any project', () => {
    expect(periodYears(projects)).toEqual([
      '2024',
      '2025',
      '2026',
      '2027',
      '2028',
    ]);
  });
});
