import {
  centsSchema,
  isoDateSchema,
  qtyMilliSchema,
  MAX_INT_FIELD,
} from './money';

describe('centsSchema', () => {
  it('should accept zero and the 32-bit cap [AC-01.9]', () => {
    expect(centsSchema.parse(0)).toBe(0);
    expect(centsSchema.parse(MAX_INT_FIELD)).toBe(MAX_INT_FIELD);
  });

  it('should reject negative cents [AC-01.9]', () => {
    expect(centsSchema.safeParse(-1).success).toBe(false);
  });

  it('should reject fractional cents [AC-01.9]', () => {
    expect(centsSchema.safeParse(1.5).success).toBe(false);
  });

  it('should reject amounts above the 32-bit cap [AC-01.9]', () => {
    expect(centsSchema.safeParse(MAX_INT_FIELD + 1).success).toBe(false);
  });

  it('should reject a fractional quantity when milli-units are expected', () => {
    expect(qtyMilliSchema.safeParse(12.5).success).toBe(false);
    expect(qtyMilliSchema.parse(12500)).toBe(12500);
  });
});

describe('isoDateSchema', () => {
  it('should accept a real YYYY-MM-DD date, including a leap day [AC-01.9]', () => {
    expect(isoDateSchema.parse('2026-11-03')).toBe('2026-11-03');
    expect(isoDateSchema.parse('2028-02-29')).toBe('2028-02-29');
  });

  it.each([
    '2026-1-3',
    '2026/11/03',
    '03.11.2026',
    '2026-11-03T00:00:00Z',
    '2026-02-30',
    '',
  ])('should reject %p when it is not a YYYY-MM-DD date [AC-01.9]', (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(false);
  });
});
