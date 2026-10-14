import { portfolioProjectSchema } from './analytics';

// CR-11: optional per-project fields for the analytics period filter
const extension = portfolioProjectSchema.pick({
  startDate: true,
  endDate: true,
  overrunLineCount: true,
  cashflow: true,
  delivery: true,
});

describe('portfolioProjectSchema (CR-11 extension)', () => {
  it('should accept a project without the optional fields when an older API omits them', () => {
    expect(extension.safeParse({}).success).toBe(true);
  });

  it('should accept dates, counts, cash flow and delivery stats when they are present', () => {
    const result = extension.safeParse({
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      overrunLineCount: 3,
      cashflow: [
        {
          month: '2026-04',
          planned: 1000,
          actual: 0,
          forecast: 1000,
          cumulativePlanned: 1000,
          cumulativeActual: 0,
          cumulativeForecast: 1000,
        },
      ],
      delivery: { deliveredRows: 4, onTimeRows: 3, overdueItems: 1 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject a negative overrun count or a non-ISO date when present', () => {
    expect(extension.safeParse({ overrunLineCount: -1 }).success).toBe(false);
    expect(extension.safeParse({ startDate: '01.04.2026' }).success).toBe(false);
    expect(
      extension.safeParse({ delivery: { deliveredRows: 1.5, onTimeRows: 0, overdueItems: 0 } }).success,
    ).toBe(false);
  });
});
