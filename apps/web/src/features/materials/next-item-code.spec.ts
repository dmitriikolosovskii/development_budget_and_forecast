import { nextItemCode } from './next-item-code';

describe('nextItemCode', () => {
  it('should take max+1 and not reuse a gap when 001 and 003 exist [AC-04.9]', () => {
    expect(nextItemCode([{ code: 'MAT-WIN-001' }, { code: 'MAT-WIN-003' }], 'WIN')).toBe('MAT-WIN-004');
  });

  it('should count codes of the prefix in any line and ignore other prefixes and kinds [AC-04.9]', () => {
    const items = [{ code: 'MAT-ELE-007' }, { code: 'WRK-ELE-020' }, { code: 'MAT-WIN-030' }, { code: 'MAT-ELE-002' }];

    expect(nextItemCode(items, 'ELE')).toBe('MAT-ELE-008');
  });

  it('should start at 001 when the prefix has no rows, and grow past 999 [AC-04.9]', () => {
    expect(nextItemCode([], 'PAI')).toBe('MAT-PAI-001');
    expect(nextItemCode([{ code: 'MAT-PAI-999' }], 'PAI')).toBe('MAT-PAI-1000');
  });
});
