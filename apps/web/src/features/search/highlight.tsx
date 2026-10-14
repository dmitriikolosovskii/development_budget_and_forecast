import { useMemo } from 'react';
import { matchRanges } from './fold';

export interface HighlightProps {
  text: string;
  query: string;
}

/** Wraps every case/diacritic-insensitive match in `<mark>`; plain React text, never innerHTML. */
export function Highlight({ text, query }: HighlightProps) {
  const parts = useMemo(() => {
    const out: Array<{ text: string; hit: boolean }> = [];
    let last = 0;
    for (const [start, end] of matchRanges(text, query)) {
      if (start > last) out.push({ text: text.slice(last, start), hit: false });
      out.push({ text: text.slice(start, end), hit: true });
      last = end;
    }
    if (last < text.length) out.push({ text: text.slice(last), hit: false });
    return out;
  }, [text, query]);

  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded bg-brand-100 px-0.5 text-ink">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
