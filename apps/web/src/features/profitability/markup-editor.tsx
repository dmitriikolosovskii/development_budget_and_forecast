import { useEffect, useId, useState } from 'react';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import {
  MARKUP_MAX_BPS,
  MARKUP_STEP_BPS,
  parseMarkupPercent,
} from './profitability-data';

export interface MarkupEditorProps {
  markupBps: number;
  onChange: (markupBps: number) => void;
}

const toText = (bps: number) => (bps / 100).toFixed(1);

/** Company markup: a % input (string draft, no float parsing) + a 0–30 % slider in bps, step 0.5 %. */
export function MarkupEditor({ markupBps, onChange }: MarkupEditorProps) {
  const id = useId();
  const [draft, setDraft] = useState(toText(markupBps));
  const [editing, setEditing] = useState(false);
  const invalid = parseMarkupPercent(draft) === null;

  useEffect(() => {
    if (!editing) setDraft(toText(markupBps));
  }, [markupBps, editing]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          id={id}
          aria-label="Company markup %"
          inputMode="decimal"
          value={draft}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false);
            setDraft(toText(markupBps));
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            const bps = parseMarkupPercent(e.target.value);
            if (bps !== null && bps !== markupBps) onChange(bps);
          }}
          className={cx(
            'w-20 rounded-lg border bg-surface px-2 py-1 text-right text-xl font-semibold text-ink',
            invalid ? 'border-risk-600' : 'border-line',
            SOFT,
            FOCUS,
          )}
        />
        <span className="text-xl font-semibold text-muted">%</span>
      </div>
      <input
        type="range"
        aria-label="Company markup slider"
        min={0}
        max={MARKUP_MAX_BPS}
        step={MARKUP_STEP_BPS}
        value={markupBps}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        className="w-full accent-brand-500"
      />
      {invalid && (
        <p role="alert" className="text-xs text-risk-600">
          Enter a percentage between 0 and 30
        </p>
      )}
    </div>
  );
}
