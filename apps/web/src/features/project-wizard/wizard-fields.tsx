import {
  parseEurToCents,
  parseQtyToMilli,
} from '@default-project/budget-engine';
import { useEffect, useState, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { cx, FOCUS, SOFT } from '../../ui';

export const INPUT_CLASS = cx(
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink',
  SOFT,
  FOCUS,
);

/** A zod issue as a short sentence: empty text → "Required", NaN → "Enter a valid number". */
export function errorText(error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  if (error.type === 'invalid_type') return 'Enter a valid number';
  if (error.type === 'too_small' && /character/.test(error.message ?? ''))
    return 'Required';
  return error.message;
}

interface FieldProps {
  id: string;
  label: string;
  error?: FieldError;
  hint?: ReactNode;
  children: ReactNode;
}

export function Field({ id, label, error, hint, children }: FieldProps) {
  const message = errorText(error);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {message ? (
        <p role="alert" className="text-xs text-risk-600">
          {message}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Integer form values shown in human units: €→cents, %→bps, ratio→bps. Parsing is string-based (no floats). */
export const SCALES = {
  money: {
    parse: parseEurToCents,
    format: (v: number) => (v / 100).toFixed(2),
  },
  percent: { parse: parseEurToCents, format: (v: number) => String(v / 100) },
  ratio: {
    parse: (t: string) => parseQtyToMilli(t) * 10,
    format: (v: number) => String(v / 10_000),
  },
} as const;

interface ScaledInputProps {
  id: string;
  value: number | undefined;
  onChange: (value: number) => void;
  onBlur?: () => void;
  scale: keyof typeof SCALES;
  invalid?: boolean;
}

function tryParse(scale: keyof typeof SCALES, text: string): number {
  try {
    return SCALES[scale].parse(text);
  } catch {
    return Number.NaN;
  }
}

export function ScaledInput({
  id,
  value,
  onChange,
  onBlur,
  scale,
  invalid,
}: ScaledInputProps) {
  const shown = (v: number | undefined) =>
    v !== undefined && Number.isSafeInteger(v) ? SCALES[scale].format(v) : '';
  const [text, setText] = useState(() => shown(value));
  // Follow values set from outside (estimate re-sync), but never rewrite what the user is typing.
  useEffect(() => {
    if (
      value !== undefined &&
      Number.isSafeInteger(value) &&
      tryParse(scale, text) !== value
    )
      setText(shown(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      inputMode="decimal"
      aria-invalid={invalid || undefined}
      className={INPUT_CLASS}
      value={text}
      onBlur={onBlur}
      onChange={(e) => {
        setText(e.target.value);
        onChange(tryParse(scale, e.target.value));
      }}
    />
  );
}
