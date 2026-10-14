import { fold, matchRanges } from './fold';

// Same vectors as apps/api/src/search/fold.spec.ts: the two copies must not drift.
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

describe('matchRanges', () => {
  it('should return original offsets when the text has umlauts before the match', () => {
    const text = 'Jens Mühlberg';

    const [[start, end]] = matchRanges(text, 'berg');

    expect(text.slice(start, end)).toBe('berg');
    expect(matchRanges(text, 'xyz')).toEqual([]);
  });

  it('should include combining marks in the match when the text is decomposed', () => {
    const text = 'Mühlberg';

    const [[start, end]] = matchRanges(text, 'MÜHL');

    expect(text.slice(start, end)).toBe('Mühl');
  });

  it('should find every occurrence when the query repeats', () => {
    expect(matchRanges('Cable cable CABLE', 'cable')).toEqual([
      [0, 5],
      [6, 11],
      [12, 17],
    ]);
    expect(matchRanges('anything', '   ')).toEqual([]);
  });
});
