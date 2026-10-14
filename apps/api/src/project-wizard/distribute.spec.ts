import { distribute } from './distribute';

describe('distribute', () => {
  it('should split 100,000.01 € over three equal lines exactly to the cent [AC-12.1]', () => {
    const shares = distribute(10_000_001, [1, 1, 1]);

    expect(shares.reduce((a, b) => a + b, 0)).toBe(10_000_001);
    expect(shares).toEqual([3_333_335, 3_333_333, 3_333_333]);
    expect(shares.every((s) => Number.isInteger(s) && s >= 0)).toBe(true);
  });

  it('should give the leftover cents to the largest line when weights differ [AC-12.1]', () => {
    const shares = distribute(1_000, [1, 5, 1]);

    expect(shares.reduce((a, b) => a + b, 0)).toBe(1_000);
    expect(shares).toEqual([142, 716, 142]);
  });

  it('should return the weights unchanged when the total equals their sum [AC-12.1]', () => {
    expect(distribute(2_934_001, [2_000_000, 934_000, 1])).toEqual([
      2_000_000, 934_000, 1,
    ]);
  });

  it('should put everything on the first line when every weight is 0 [AC-12.1]', () => {
    expect(distribute(500, [0, 0])).toEqual([500, 0]);
    expect(distribute(0, [0, 0])).toEqual([0, 0]);
  });

  it('should reject a negative or fractional total', () => {
    expect(() => distribute(-1, [1])).toThrow(RangeError);
    expect(() => distribute(1.5, [1])).toThrow(RangeError);
  });
});
