import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Trash2 } from 'lucide-react';
import { formatDate, formatEur, itemPlannedCents } from '@default-project/budget-engine';
import type { CostItem } from '@default-project/types';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { FlashValue } from '../../ui/flash-value';
import { MoneyCell, ScheduleFlagCell, TextCell } from '../../ui/editable-table';
import { useDeleteItem } from '../project/use-delete-item';
import { useHasDeliveredDeliveries, useItemSchedule, useNeededBy } from './use-materials';

type Edit = (patch: Partial<CostItem>) => void;

export const LOCKED_ACTUAL_HINT = 'Managed by delivery tracking';
export const DELETE_BLOCKED_HINT = 'Has recorded deliveries';

export function ItemNameCell({ item, edit }: { item: CostItem; edit: Edit }) {
  return (
    <div className="min-w-48">
      <TextCell value={item.name} label={`name ${item.code}`} onCommit={(name) => edit({ name })} />
      {item.description && <p className="px-1.5 text-xs text-muted">{item.description}</p>}
    </div>
  );
}

/** qty × unit price, rounded half-up once by the engine. */
export function PlannedAmountCell({ item }: { item: CostItem }) {
  const cents = itemPlannedCents(item);
  return (
    <span data-testid={`planned-${item.id}`} className="tabular-nums">
      <FlashValue value={cents}>{formatEur(cents)}</FlashValue>
    </span>
  );
}

/** Actual is read-only (lock + tooltip) once delivery tracking has recorded a DELIVERED delivery. */
export function ActualCell({ item, edit }: { item: CostItem; edit: Edit }) {
  const locked = useHasDeliveredDeliveries(item.projectId, item.id);
  if (locked) {
    return (
      <span className="inline-flex items-center justify-end gap-1" title={LOCKED_ACTUAL_HINT}>
        <Lock aria-label={LOCKED_ACTUAL_HINT} className="h-3.5 w-3.5 text-muted" />
        <MoneyCell cents={item.actualCents} label={`actual ${item.code}`} />
      </span>
    );
  }
  return (
    <MoneyCell cents={item.actualCents} label={`actual ${item.code}`} onCommit={(actualCents) => edit({ actualCents })} />
  );
}

/** Start of the linked work (read-only; 05 owns the link), linking to that row in Construction. */
export function NeededByCell({ item }: { item: CostItem }) {
  const need = useNeededBy(item.projectId, item.requiredForWorkId);
  if (!need) return <span className="text-muted">—</span>;
  const label = need.startDate ? formatDate(need.startDate) : 'No start date';
  if (!need.section) return <span>{label}</span>;
  const href = `/projects/${encodeURIComponent(item.projectId)}/construction/${encodeURIComponent(need.section)}?highlight=${encodeURIComponent(need.workId)}`;
  return (
    <Link to={href} title={need.workName} className={cx('whitespace-nowrap text-brand-600 hover:underline', FOCUS)}>
      {label}
    </Link>
  );
}

/** Rightmost column: the engine's schedule verdict for this row. */
export function MaterialScheduleCell({ item }: { item: CostItem }) {
  const result = useItemSchedule(item.projectId, item.id);
  return <ScheduleFlagCell result={result} />;
}

/** Inline confirmation (never `window.confirm`); disabled when the row has recorded deliveries. */
export function DeleteMaterialButton({ item }: { item: CostItem }) {
  const deleteItem = useDeleteItem(item.projectId);
  const blocked = useHasDeliveredDeliveries(item.projectId, item.id);
  const [asking, setAsking] = useState(false);

  if (blocked) {
    return (
      <span title={DELETE_BLOCKED_HINT} className="inline-flex">
        <button type="button" disabled aria-label={`Delete ${item.code} (${DELETE_BLOCKED_HINT})`} className="cursor-not-allowed rounded p-1 text-muted/50">
          <Trash2 aria-hidden className="h-4 w-4" />
        </button>
      </span>
    );
  }
  if (asking) {
    return (
      <span role="dialog" aria-label={`Delete ${item.code}?`} className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
        <span className="text-muted">Delete?</span>
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            deleteItem(item.id).catch(() => undefined); // the hook restores the row and shows a toast
          }}
          className={cx('rounded px-1.5 py-0.5 text-risk-600 hover:bg-risk-50', FOCUS)}
        >
          Yes
        </button>
        <button type="button" onClick={() => setAsking(false)} className={cx('rounded px-1.5 py-0.5 text-muted hover:bg-subtle', FOCUS)}>
          No
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Delete ${item.code}`}
      onClick={() => setAsking(true)}
      className={cx('rounded p-1 text-muted hover:bg-risk-50 hover:text-risk-600', SOFT, FOCUS)}
    >
      <Trash2 aria-hidden className="h-4 w-4" />
    </button>
  );
}
