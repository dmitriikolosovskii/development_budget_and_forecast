/**
 * Case- and diacritic-insensitive form of a string: `Mühlberg` → `muhlberg`, `aroTHERM` → `arotherm`.
 * Same code and test vectors as `apps/web/src/features/search/fold.ts` (libs/shared/types is frozen).
 * Known gap: no German transliteration (`ß` ≠ `ss`, `ue` ≠ `ü`).
 */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
