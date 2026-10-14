import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  formatBps,
  formatEur,
  parseEurToCents,
} from '@default-project/budget-engine';
import { autosaveQueue } from '../../lib/autosave-queue';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { formatCmAsM } from './land-calc';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export interface InlineFieldProps<T> {
  /** Accessible name: the button is "Edit <label>", the input is "<label>". */
  label: string;
  value: T;
  display: (value: T) => ReactNode;
  /** Text in the input when editing starts. */
  toText: (value: T) => string;
  parse: (text: string) => Parsed<T>;
  onCommit: (value: T) => void;
  inputMode?: 'decimal' | 'numeric' | 'text';
}

/**
 * Display ↔ input for one parcel field (the same interaction as 02's table cells):
 * Enter commits into the 400 ms autosave queue, blur commits and flushes, Esc cancels,
 * invalid input shows an alert and commits nothing.
 */
export function InlineField<T>({
  label,
  value,
  display,
  toText,
  parse,
  onCommit,
  inputMode,
}: InlineFieldProps<T>) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = (): boolean => {
    if (text === toText(value)) {
      setEditing(false);
      return true;
    }
    const result = parse(text);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    onCommit(result.value);
    setEditing(false);
    return true;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
      setError(null);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        onClick={() => {
          setText(toText(value));
          setError(null);
          setEditing(true);
        }}
        className={cx(
          'w-full rounded-md px-1.5 py-0.5 text-left hover:bg-brand-50',
          SOFT,
          FOCUS,
        )}
      >
        {display(value)}
      </button>
    );
  }
  return (
    <span className="block">
      <input
        ref={inputRef}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        inputMode={inputMode}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (commit()) void autosaveQueue.flush();
        }}
        className={cx(
          'w-full min-w-20 rounded-md border bg-surface px-1.5 py-0.5',
          error ? 'border-risk-600' : 'border-brand-500',
          FOCUS,
        )}
      />
      {error && (
        <span role="alert" className="mt-0.5 block text-xs text-risk-600">
          {error}
        </span>
      )}
    </span>
  );
}

const NOT_SET = <span className="text-muted">not set</span>;

/** "2 decimals → ×100" without floats: metres → cm, percent → bps (engine parser, own message). */
function parseHundredths(text: string, error: string): Parsed<number> {
  try {
    return { ok: true, value: parseEurToCents(text) };
  } catch {
    return { ok: false, error };
  }
}

function withMax(
  result: Parsed<number>,
  max: number,
  error: string,
): Parsed<number> {
  return result.ok && result.value > max ? { ok: false, error } : result;
}

interface FieldBase<T> {
  label: string;
  value: T;
  onCommit: (value: T) => void;
}

/** Required text (blank → "Required"); `nullable` lets an empty input clear the value. */
export function TextField({
  label,
  value,
  onCommit,
  nullable = false,
}: FieldBase<string | null> & { nullable?: boolean }) {
  return (
    <InlineField<string | null>
      label={label}
      value={value}
      display={(v) => (v ? v : NOT_SET)}
      toText={(v) => v ?? ''}
      parse={(t) => {
        const trimmed = t.trim();
        if (trimmed)
          return trimmed.length > 200
            ? { ok: false, error: 'At most 200 characters' }
            : { ok: true, value: trimmed };
        return nullable
          ? { ok: true, value: null }
          : { ok: false, error: 'Required' };
      }}
      onCommit={onCommit}
    />
  );
}

/** Whole number with a unit; zero shows as "not set" when `zeroIsUnset`; `nullable` clears on empty. */
export function IntField({
  label,
  value,
  onCommit,
  unit,
  max,
  nullable = false,
  zeroIsUnset = false,
}: FieldBase<number | null> & {
  unit: string;
  max: number;
  nullable?: boolean;
  zeroIsUnset?: boolean;
}) {
  return (
    <InlineField<number | null>
      label={label}
      value={value}
      display={(v) =>
        v === null || (zeroIsUnset && v === 0)
          ? NOT_SET
          : `${v.toLocaleString('en-GB')} ${unit}`
      }
      toText={(v) => (v === null ? '' : String(v))}
      parse={(t) => {
        const s = t.trim().replace(/[,\s]/g, '');
        if (!s)
          return nullable
            ? { ok: true, value: null }
            : { ok: false, error: 'Required' };
        if (!/^\d+$/.test(s))
          return { ok: false, error: 'Enter a whole number like 150' };
        const n = Number(s);
        return n > max
          ? { ok: false, error: `At most ${max.toLocaleString('en-GB')}` }
          : { ok: true, value: n };
      }}
      onCommit={onCommit}
      inputMode="numeric"
    />
  );
}

/** Money per unit in cents ("260.00"). */
export function MoneyField({
  label,
  value,
  onCommit,
  max,
}: FieldBase<number> & { max: number }) {
  return (
    <InlineField<number>
      label={label}
      value={value}
      display={(v) => (v === 0 ? NOT_SET : formatEur(v))}
      toText={(v) => (v / 100).toFixed(2)}
      parse={(t) =>
        withMax(
          parseHundredths(t, 'Enter an amount like 1,234.56'),
          max,
          'Amount is too large',
        )
      }
      onCommit={onCommit}
      inputMode="decimal"
    />
  );
}

/** Percent stored as basis points ("40" → 4000 bps). */
export function PercentField({
  label,
  value,
  onCommit,
  max,
}: FieldBase<number> & { max: number }) {
  return (
    <InlineField<number>
      label={label}
      value={value}
      display={(v) => (v === 0 ? NOT_SET : formatBps(v))}
      toText={(v) => (v / 100).toFixed(2)}
      parse={(t) =>
        withMax(
          parseHundredths(t.replace('%', ''), 'Enter a percent like 40'),
          max,
          `At most ${max / 100} %`,
        )
      }
      onCommit={onCommit}
      inputMode="decimal"
    />
  );
}

/** Length stored in cm, edited in metres ("26" → 2600 cm). */
export function MetresField({
  label,
  value,
  onCommit,
  max,
}: FieldBase<number> & { max: number }) {
  return (
    <InlineField<number>
      label={label}
      value={value}
      display={(v) => (v === 0 ? NOT_SET : formatCmAsM(v))}
      toText={(v) => (v / 100).toFixed(2)}
      parse={(t) =>
        withMax(
          parseHundredths(t.replace(/m$/i, ''), 'Enter metres like 26.5'),
          max,
          'Too long',
        )
      }
      onCommit={onCommit}
      inputMode="decimal"
    />
  );
}

/** Latitude/longitude in decimal degrees. */
export function CoordinateField({
  label,
  value,
  onCommit,
  limit,
}: FieldBase<number> & { limit: 90 | 180 }) {
  return (
    <InlineField<number>
      label={label}
      value={value}
      display={(v) => v.toFixed(6)}
      toText={(v) => String(v)}
      parse={(t) => {
        const s = t.trim();
        if (!/^-?\d{1,3}(\.\d{1,8})?$/.test(s))
          return { ok: false, error: 'Enter decimal degrees like 51.3801' };
        const n = Number(s);
        return Math.abs(n) > limit
          ? { ok: false, error: `Between -${limit} and ${limit}` }
          : { ok: true, value: n };
      }}
      onCommit={onCommit}
      inputMode="decimal"
    />
  );
}

/** Label/value row inside a section card. */
export function FieldRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 py-1.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-center sm:gap-3">
      <dt className="text-sm text-muted">
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
