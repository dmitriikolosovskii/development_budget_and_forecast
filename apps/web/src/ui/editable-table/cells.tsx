import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { formatDate, formatEur, formatQty, parseEurToCents, parseQtyToMilli } from '@default-project/budget-engine';
import { ITEM_STATUSES, type ItemStatus, type OrgRole, type ScheduleResult } from '@default-project/types';
import { autosaveQueue } from '../../lib/autosave-queue';
import { useOrganizations } from '../../features/organizations/use-organizations';
import { useProjectSnapshot } from '../../features/project/use-project-snapshot';
import type { ProjectCache } from '../../features/project/project-cache';
import { Badge, type Tone } from '../badge';
import { cx, FOCUS, SOFT } from '../cx';
import { FlashValue } from '../flash-value';

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface InlineEditorProps<T> {
  display: ReactNode;
  /** Text shown in the input when editing starts. */
  initial: string;
  parse: (text: string) => ParseResult<T>;
  onCommit?: (value: T) => void;
  label: string;
  align?: 'left' | 'right';
  inputType?: 'text' | 'date';
  inputMode?: 'decimal' | 'text';
}

/** Display ↔ input. Enter/blur commit, Esc cancels; invalid input shows a message and commits nothing. */
function InlineEditor<T>({ display, initial, parse, onCommit, label, align, inputType = 'text', inputMode }: InlineEditorProps<T>) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!onCommit) return <span className={cx(align === 'right' && 'tabular-nums')}>{display}</span>;

  const start = () => {
    setText(initial);
    setError(null);
    setEditing(true);
  };
  const commit = (): boolean => {
    if (text === initial) {
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
        onClick={start}
        className={cx(
          'w-full rounded-md px-1.5 py-0.5 hover:bg-brand-50',
          align === 'right' ? 'text-right tabular-nums' : 'text-left',
          SOFT,
          FOCUS,
        )}
      >
        {display}
      </button>
    );
  }
  return (
    <span className="block">
      <input
        ref={inputRef}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        type={inputType}
        inputMode={inputMode}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Blur flushes the autosave queue (CONTRACTS §6).
          if (commit()) void autosaveQueue.flush();
        }}
        className={cx(
          'w-full min-w-20 rounded-md border bg-surface px-1.5 py-0.5',
          align === 'right' && 'text-right tabular-nums',
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

const fromThrowing =
  <T,>(fn: (s: string) => T, message: string) =>
  (text: string): ParseResult<T> => {
    try {
      return { ok: true, value: fn(text) };
    } catch {
      return { ok: false, error: message };
    }
  };

export interface TextCellProps {
  value: string | null;
  onCommit?: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function TextCell({ value, onCommit, label = 'text', placeholder = '—' }: TextCellProps) {
  const parse = useCallback(
    (t: string): ParseResult<string> => (t.trim() ? { ok: true, value: t.trim() } : { ok: false, error: 'Required' }),
    [],
  );
  return (
    <InlineEditor
      display={value || <span className="text-muted">{placeholder}</span>}
      initial={value ?? ''}
      parse={parse}
      onCommit={onCommit}
      label={label}
    />
  );
}

const parseMoney = fromThrowing(parseEurToCents, 'Enter an amount like 1,234.56');

export interface MoneyCellProps {
  cents: number;
  onCommit?: (cents: number) => void;
  label?: string;
}

/** Money in cents; parsed as a string (never via float), negatives rejected. */
export function MoneyCell({ cents, onCommit, label = 'amount' }: MoneyCellProps) {
  return (
    <InlineEditor
      display={<FlashValue value={cents}>{formatEur(cents)}</FlashValue>}
      initial={(cents / 100).toFixed(2)}
      parse={parseMoney}
      onCommit={onCommit}
      label={label}
      align="right"
      inputMode="decimal"
    />
  );
}

const parseQty = fromThrowing(parseQtyToMilli, 'Enter a quantity like 12.5');

export interface QtyCellProps {
  milli: number;
  unit?: string;
  onCommit?: (milli: number) => void;
  label?: string;
}

export function QtyCell({ milli, unit, onCommit, label = 'quantity' }: QtyCellProps) {
  return (
    <InlineEditor
      display={formatQty(milli, unit)}
      initial={String(milli / 1000)}
      parse={parseQty}
      onCommit={onCommit}
      label={label}
      align="right"
      inputMode="decimal"
    />
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface DateCellProps {
  value: string | null;
  /** `null` clears the date. */
  onCommit?: (value: string | null) => void;
  label?: string;
}

export function DateCell({ value, onCommit, label = 'date' }: DateCellProps) {
  const parse = useCallback((t: string): ParseResult<string | null> => {
    if (!t) return { ok: true, value: null };
    return ISO_DATE.test(t) ? { ok: true, value: t } : { ok: false, error: 'Use YYYY-MM-DD' };
  }, []);
  return (
    <InlineEditor
      display={value ? formatDate(value) : <span className="text-muted">—</span>}
      initial={value ?? ''}
      parse={parse}
      onCommit={onCommit}
      label={label}
      inputType="date"
    />
  );
}

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

export interface SelectCellProps<V extends string> {
  value: V | null;
  options: readonly SelectOption<V>[];
  onCommit?: (value: V | null) => void;
  label?: string;
  /** Adds an empty choice that commits `null`. */
  allowEmpty?: boolean;
}

export function SelectCell<V extends string>({ value, options, onCommit, label = 'value', allowEmpty }: SelectCellProps<V>) {
  if (!onCommit) return <span>{options.find((o) => o.value === value)?.label ?? '—'}</span>;
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onCommit((e.target.value || null) as V | null)}
      className={cx('w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-line', SOFT, FOCUS)}
    >
      {(allowEmpty || value === null) && <option value="">—</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  PLANNED: 'Planned',
  PARTIAL: 'Partially contracted',
  CONTRACTED: 'Contracted',
  DONE: 'Done',
};
const STATUS_TONE: Record<ItemStatus, Tone> = { PLANNED: 'muted', PARTIAL: 'info', CONTRACTED: 'brand', DONE: 'ok' };
const STATUS_OPTIONS = ITEM_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export interface StatusCellProps {
  status: ItemStatus;
  onCommit?: (status: ItemStatus) => void;
}

export function StatusCell({ status, onCommit }: StatusCellProps) {
  if (!onCommit) return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
  return (
    <SelectCell
      value={status}
      options={STATUS_OPTIONS}
      label="status"
      onCommit={(v) => v && onCommit(v)}
    />
  );
}

export interface OrgCellProps {
  orgId: string | null;
  /** Filters the picker. */
  role?: OrgRole;
  /** Enables the picker (pencil); `null` clears. */
  onCommit?: (orgId: string | null) => void;
  label?: string;
}

/** Organisation name; click opens OrganizationModal via `?org=<id>` (ProjectPage). */
export function OrgCell({ orgId, role, onCommit, label = 'organisation' }: OrgCellProps) {
  const { projectId = '' } = useParams();
  const [, setParams] = useSearchParams();
  const [picking, setPicking] = useState(false);
  const selectName = useCallback((c: ProjectCache) => (orgId ? c.orgsById[orgId]?.name : undefined), [orgId]);
  const fromProject = useProjectSnapshot(projectId, selectName).data;
  const orgs = useOrganizations();
  const name = fromProject ?? orgs.data?.find((o) => o.id === orgId)?.name;

  if (picking && onCommit) {
    const options = (orgs.data ?? [])
      .filter((o) => !role || o.role === role || o.id === orgId)
      .map((o) => ({ value: o.id, label: o.name }));
    return (
      <SelectCell
        value={orgId}
        options={options}
        allowEmpty
        label={label}
        onCommit={(v) => {
          onCommit(v);
          setPicking(false);
        }}
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {orgId ? (
        <button
          type="button"
          onClick={() =>
            setParams((p) => {
              p.set('org', orgId);
              return p;
            })
          }
          className={cx('rounded text-left text-brand-600 hover:underline', FOCUS)}
        >
          {name ?? 'Organisation'}
        </button>
      ) : (
        <span className="text-muted">—</span>
      )}
      {onCommit && (
        <button
          type="button"
          aria-label={`Change ${label}`}
          onClick={() => setPicking(true)}
          className={cx('rounded p-0.5 text-muted hover:text-ink', FOCUS)}
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

/** Label + tone per schedule status (DESIGN-SYSTEM §5). */
export function scheduleLabel(result: ScheduleResult): { label: string; tone: Tone } {
  if (result.kind === 'WORK') {
    if (result.status === 'BLOCKED') return { label: `Blocked · ${result.worstDelayDays} d`, tone: 'risk' };
    if (result.status === 'INVALID_DATES') return { label: 'Invalid dates', tone: 'warn' };
    return { label: 'Ready', tone: 'ok' };
  }
  switch (result.status) {
    case 'DELIVERED':
      return { label: 'Delivered', tone: 'info' };
    case 'UNSCHEDULED':
      return { label: 'Unscheduled', tone: 'muted' };
    case 'LATE_FOR_WORK':
      return { label: `Late for work · ${result.delayDays ?? 0} d`, tone: 'risk' };
    case 'OVERDUE':
      return { label: 'Overdue', tone: 'risk' };
    case 'AT_RISK':
      return { label: `At risk · ${result.slackDays ?? 0} d`, tone: 'warn' };
    default:
      return { label: 'On time', tone: 'ok' };
  }
}

export function ScheduleBadge({ result }: { result: ScheduleResult }) {
  const { label, tone } = scheduleLabel(result);
  return <Badge tone={tone}>{label}</Badge>;
}

export interface ScheduleFlagCellProps {
  result: ScheduleResult | undefined;
}

export function ScheduleFlagCell({ result }: ScheduleFlagCellProps) {
  if (!result) return <span className="text-muted">—</span>;
  return <ScheduleBadge result={result} />;
}
