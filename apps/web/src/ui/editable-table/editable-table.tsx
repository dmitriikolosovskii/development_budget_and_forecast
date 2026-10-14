import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useIsMobile } from '../../lib/use-media-query';
import { Sheet } from '../modal';
import { cx, FOCUS, SOFT } from '../cx';
import { EmptyState } from '../states';

export const HIGHLIGHT_MS = 2000;

export interface Column<Row> {
  id: string;
  header: ReactNode;
  /** `edit` is bound to the row: `edit({ qtyMilli })`. */
  cell: (row: Row, edit: (patch: Partial<Row>) => void) => ReactNode;
  align?: 'left' | 'right';
  /** Tailwind width class, e.g. `w-28`. */
  width?: string;
  /** Card layout on < 640 px; default `field`. */
  mobile?: 'title' | 'field' | 'hidden';
}

export interface EditableTableProps<Row extends { id: string }, Ctx> {
  caption: string;
  rowIds: readonly string[];
  /** Passed to `useRow` (e.g. the projectId). */
  context: Ctx;
  /** A real hook, called inside each memo row as `useRow(context, rowId)`. */
  useRow: (context: Ctx, rowId: string) => Row | undefined;
  /** Must be stable (module scope or useMemo), otherwise every row re-renders. */
  columns: readonly Column<Row>[];
  /** Must be stable (e.g. from useEditItem). */
  onEdit?: (rowId: string, patch: Partial<Row>) => void;
  /** Footer cells by column id (totals). Kept out of `columns` so changing totals never re-renders rows. */
  footer?: Partial<Record<string, ReactNode>>;
  onAdd?: () => void;
  addLabel?: string;
  onDelete?: (rowId: string) => void;
  emptyText?: string;
}

interface RowProps<Row extends { id: string }, Ctx> {
  rowId: string;
  context: Ctx;
  useRow: (context: Ctx, rowId: string) => Row | undefined;
  columns: readonly Column<Row>[];
  onEdit?: (rowId: string, patch: Partial<Row>) => void;
  onDelete?: (rowId: string) => void;
  highlighted: boolean;
  mobile: boolean;
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (asking) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-muted">Delete?</span>
        <button type="button" onClick={onConfirm} className={cx('rounded px-1.5 py-0.5 text-risk-600 hover:bg-risk-50', FOCUS)}>
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
      aria-label="Delete row"
      onClick={() => setAsking(true)}
      className={cx('rounded p-1 text-muted hover:bg-risk-50 hover:text-risk-600', SOFT, FOCUS)}
    >
      <Trash2 aria-hidden className="h-4 w-4" />
    </button>
  );
}

function useHighlightEffect(highlighted: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);
  return ref;
}

function RowView<Row extends { id: string }, Ctx>({
  rowId,
  context,
  useRow,
  columns,
  onEdit,
  onDelete,
  highlighted,
  mobile,
}: RowProps<Row, Ctx>) {
  const row = useRow(context, rowId);
  const edit = useCallback((patch: Partial<Row>) => onEdit?.(rowId, patch), [onEdit, rowId]);
  const ref = useHighlightEffect(highlighted);
  const [sheetOpen, setSheetOpen] = useState(false);
  if (!row) return null;

  if (mobile) {
    const title = columns.filter((c) => c.mobile === 'title');
    const fields = columns.filter((c) => (c.mobile ?? 'field') === 'field');
    return (
      <article
        ref={(el) => {
          ref.current = el;
        }}
        data-row-id={rowId}
        data-highlighted={highlighted || undefined}
        className={cx('rounded-xl border border-line bg-surface p-3', highlighted && 'animate-highlight')}
      >
        <div className="mb-2 flex items-start justify-between gap-2 font-medium">
          <div className="min-w-0">{title.map((c) => <div key={c.id}>{c.cell(row, edit)}</div>)}</div>
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <button
                type="button"
                aria-label="Edit row"
                onClick={() => setSheetOpen(true)}
                className={cx('rounded p-1 text-muted hover:bg-subtle', FOCUS)}
              >
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
            )}
            {onDelete && <DeleteButton onConfirm={() => onDelete(rowId)} />}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          {fields.map((c) => (
            <div key={c.id} className="contents">
              <dt className="text-muted">{c.header}</dt>
              <dd className="text-right">{c.cell(row, edit)}</dd>
            </div>
          ))}
        </dl>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Edit row">
          <dl className="space-y-3 text-sm">
            {columns
              .filter((c) => c.mobile !== 'hidden')
              .map((c) => (
                <div key={c.id}>
                  <dt className="mb-1 text-muted">{c.header}</dt>
                  <dd>{c.cell(row, edit)}</dd>
                </div>
              ))}
          </dl>
        </Sheet>
      </article>
    );
  }

  return (
    <tr
      ref={(el) => {
        ref.current = el;
      }}
      data-row-id={rowId}
      data-highlighted={highlighted || undefined}
      className={cx('border-t border-line hover:bg-subtle/60', SOFT, highlighted && 'animate-highlight')}
    >
      {columns.map((c, i) => (
        <td
          key={c.id}
          className={cx(
            'px-3 py-2 align-middle',
            c.width,
            c.align === 'right' && 'text-right tabular-nums',
            i === 0 && 'sticky left-0 bg-surface',
          )}
        >
          {c.cell(row, edit)}
        </td>
      ))}
      {onDelete && (
        <td className="w-20 px-2 py-2 text-right">
          <DeleteButton onConfirm={() => onDelete(rowId)} />
        </td>
      )}
    </tr>
  );
}

const MemoRow = memo(RowView) as typeof RowView;

/** Highlighted row id from `?highlight=`, cleared after 2 s. */
function useFlash(): string | null {
  const [params] = useSearchParams();
  const target = params.get('highlight');
  const [flash, setFlash] = useState<string | null>(target);
  useEffect(() => {
    setFlash(target);
    if (!target) return;
    const timer = setTimeout(() => setFlash(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [target]);
  return flash;
}

/** Editable table with memo rows (one edit re-renders one row), cards on mobile, ?highlight support. */
export function EditableTable<Row extends { id: string }, Ctx>({
  caption,
  rowIds,
  context,
  useRow,
  columns,
  onEdit,
  footer,
  onAdd,
  addLabel = 'Add row',
  onDelete,
  emptyText = 'No rows yet.',
}: EditableTableProps<Row, Ctx>) {
  const mobile = useIsMobile();
  const flash = useFlash();
  const hasFooter = !!footer && columns.some((c) => footer[c.id] !== undefined);

  const addButton = onAdd && (
    <button
      type="button"
      onClick={onAdd}
      className={cx('inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50', SOFT, FOCUS)}
    >
      <Plus aria-hidden className="h-4 w-4" />
      {addLabel}
    </button>
  );

  const rows = rowIds.map((id) => (
    <MemoRow
      key={id}
      rowId={id}
      context={context}
      useRow={useRow}
      columns={columns}
      onEdit={onEdit}
      onDelete={onDelete}
      highlighted={flash === id}
      mobile={mobile}
    />
  ));

  if (mobile) {
    return (
      <section aria-label={caption} className="space-y-2">
        {rowIds.length === 0 ? <EmptyState title={emptyText} /> : rows}
        {hasFooter && (
          <dl className="grid grid-cols-2 gap-1 rounded-xl bg-subtle p-3 text-sm font-medium">
            {columns
              .filter((c) => footer?.[c.id] !== undefined)
              .map((c) => (
                <div key={c.id} className="contents">
                  <dt className="text-muted">{c.header}</dt>
                  <dd className="text-right">{footer?.[c.id]}</dd>
                </div>
              ))}
          </dl>
        )}
        {addButton}
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-subtle text-left text-xs font-semibold tracking-wide text-muted uppercase">
          <tr>
            {columns.map((c, i) => (
              <th
                key={c.id}
                scope="col"
                className={cx('px-3 py-2 whitespace-nowrap', c.width, c.align === 'right' && 'text-right', i === 0 && 'sticky left-0 bg-subtle')}
              >
                {c.header}
              </th>
            ))}
            {onDelete && (
              <th scope="col" className="w-20 px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rowIds.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onDelete ? 1 : 0)}>
                <EmptyState title={emptyText} />
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
        {hasFooter && (
          <tfoot className="border-t-2 border-line bg-subtle font-semibold">
            <tr>
              {columns.map((c) => (
                <td key={c.id} className={cx('px-3 py-2', c.align === 'right' && 'text-right tabular-nums')}>
                  {footer?.[c.id]}
                </td>
              ))}
              {onDelete && <td />}
            </tr>
          </tfoot>
        )}
      </table>
      {addButton && <div className="border-t border-line p-2">{addButton}</div>}
    </div>
  );
}
