import { fold } from './fold';

// Same vectors as apps/web/src/features/search/fold.spec.ts: the two copies must not drift.
describe('fold', () => {
  it.each([
    ['AROTHERM', 'arotherm'],
    ['aroTHERM', 'arotherm'],
    ['Mühlberg', 'muhlberg'],
    ['MÜHLBERG', 'muhlberg'],
    ['Mühlberg', 'muhlberg'],
    ['Markranstädt', 'markranstadt'],
  ])(
    'should fold %s to %s when comparing case- and diacritic-insensitively',
    (input, expected) => {
      expect(fold(input)).toBe(expected);
    },
  );

  it('should keep ß when folding (no transliteration)', () => {
    expect(fold('Straße')).toBe('straße');
    expect(fold('Straße')).not.toBe('strasse');
  });
});
