/**
 * Case- and diacritic-insensitive form of a string: `Mühlberg` → `muhlberg`, `aroTHERM` → `arotherm`.
 * Same code and test vectors as `apps/api/src/search/fold.ts` (libs/shared/types is frozen).
 */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Ranges `[start, end)` in the ORIGINAL text whose folded form contains the folded query. */
export function matchRanges(
  text: string,
  query: string,
): Array<[number, number]> {
  const needle = fold(query.trim());
  if (!needle) return [];
  // Fold code point by code point, remembering where each folded unit came from.
  let folded = '';
  const origin: number[] = [];
  let offset = 0;
  for (const ch of text) {
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) origin.push(offset);
    folded += f;
    offset += ch.length;
  }
  const ranges: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const start = folded.indexOf(needle, from);
    if (start < 0) break;
    const end = start + needle.length;
    // The end runs up to the next kept character, so trailing combining marks stay inside the match.
    ranges.push([
      origin[start],
      end < folded.length ? origin[end] : text.length,
    ]);
    from = end;
  }
  return ranges;
}
