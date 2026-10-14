import {
  formatBps,
  formatDate,
  formatEur,
  formatEurWhole,
  formatQty,
} from './format';

describe('format', () => {
  it('should format cents as euros with the en-IE locale', () => {
    expect(formatEur(123456)).toBe('€1,234.56');
    expect(formatEur(0)).toBe('€0.00');
    expect(formatEur(-123456)).toBe('-€1,234.56');
  });

  it('should format whole euros without cents', () => {
    expect(formatEurWhole(57386100)).toBe('€573,861');
  });

  it('should format milli-units with the unit label', () => {
    expect(formatQty(12500, 'm3')).toBe('12.5 m³');
    expect(formatQty(1234567)).toBe('1,234.567');
  });

  it('should format basis points as a percentage', () => {
    expect(formatBps(1500)).toBe('15%');
    expect(formatBps(1234)).toBe('12.34%');
    expect(formatBps(-250)).toBe('-2.5%');
  });

  it('should format an ISO date for display in UTC', () => {
    expect(formatDate('2026-11-03')).toBe('3 Nov 2026');
  });
});
