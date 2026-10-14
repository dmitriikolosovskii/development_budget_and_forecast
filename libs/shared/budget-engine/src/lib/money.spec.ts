import {
  itemPlannedCents,
  parseEurToCents,
  parseQtyToMilli,
  roundHalfUp,
} from './money';

describe('roundHalfUp', () => {
  it('should round halves away from zero for positives', () => {
    expect(roundHalfUp(BigInt(5), BigInt(2))).toBe(3);
    expect(roundHalfUp(BigInt(7), BigInt(5))).toBe(1);
  });

  it('should be symmetric for negatives: -2.5 → -3 [AC-01.2]', () => {
    expect(roundHalfUp(BigInt(-5), BigInt(2))).toBe(-3);
    expect(roundHalfUp(BigInt(5), BigInt(-2))).toBe(-3);
    expect(roundHalfUp(BigInt(-3), BigInt(2))).toBe(-2);
    expect(roundHalfUp(BigInt(-7), BigInt(5))).toBe(-1);
  });

  it('should throw when the denominator is zero', () => {
    expect(() => roundHalfUp(BigInt(1), BigInt(0))).toThrow();
  });

  it('should throw when the result is not a safe integer [AC-01.1]', () => {
    expect(() =>
      roundHalfUp(BigInt(Number.MAX_SAFE_INTEGER) * BigInt(10), BigInt(1)),
    ).toThrow();
  });
});

describe('itemPlannedCents', () => {
  it('should round 1.5 × €0.03 = 4.5¢ up to 5¢ [AC-01.1]', () => {
    expect(itemPlannedCents({ qtyMilli: 1500, unitPriceCents: 3 })).toBe(5);
  });

  it('should round 0.333 × €1.00 = 33.3¢ down to 33¢ [AC-01.1]', () => {
    expect(itemPlannedCents({ qtyMilli: 333, unitPriceCents: 100 })).toBe(33);
  });

  it('should round 2.5¢ to 3¢ [AC-01.1]', () => {
    expect(itemPlannedCents({ qtyMilli: 500, unitPriceCents: 5 })).toBe(3);
  });

  it('should multiply 12.5 m³ × €192.50 to exactly €2,406.25 [AC-01.1]', () => {
    expect(itemPlannedCents({ qtyMilli: 12_500, unitPriceCents: 19_250 })).toBe(
      240_625,
    );
  });

  it('should stay exact at the DTO caps', () => {
    expect(
      itemPlannedCents({
        qtyMilli: 2_000_000_000,
        unitPriceCents: 2_000_000_000,
      }),
    ).toBe(4_000_000_000_000_000);
  });

  it('should throw when the result is not a safe integer [AC-01.1]', () => {
    expect(() =>
      itemPlannedCents({
        qtyMilli: Number.MAX_SAFE_INTEGER,
        unitPriceCents: 2000,
      }),
    ).toThrow();
  });
});

describe('parseEurToCents [AC-01.8]', () => {
  it.each([
    ['1,234.56', 123456],
    ['12', 1200],
    ['0.5', 50],
    ['0.05', 5],
    [' €1,234.5 ', 123450],
    ['1234567.89', 123456789],
  ])('should parse %p to %p cents [AC-01.8]', (input, cents) => {
    expect(parseEurToCents(input)).toBe(cents);
  });

  it.each(['0.005', 'abc', '', '1.2.3', '1e3', '12,5', '-1', '1,23.00', '.5'])(
    'should throw for %p [AC-01.8]',
    (input) => {
      expect(() => parseEurToCents(input)).toThrow();
    },
  );

  it('should throw when the amount is not a safe integer of cents', () => {
    expect(() => parseEurToCents('99999999999999999')).toThrow();
  });
});

describe('parseQtyToMilli', () => {
  it.each([
    ['12.345', 12345],
    ['0.333', 333],
    ['12.5', 12500],
    ['1,000', 1000000],
    ['7', 7000],
  ])('should parse %p to %p milli-units', (input, milli) => {
    expect(parseQtyToMilli(input)).toBe(milli);
  });

  it.each(['1.0005', 'x', '', '-2'])('should throw for %p', (input) => {
    expect(() => parseQtyToMilli(input)).toThrow();
  });
});
