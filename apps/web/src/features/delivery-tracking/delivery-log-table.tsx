import { useMemo, useState } from 'react';
import {
  formatDate,
  formatEur,
  formatQty,
} from '@default-project/budget-engine';
import type { Delivery } from '@default-project/types';
import { Badge, type Tone } from '../../ui/badge';
import { Card, SectionTitle } from '../../ui/card';
import { cx, FOCUS } from '../../ui/cx';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import type { ProjectCache } from '../project/project-cache';
import { planStatus, type PlanStatus } from './delivery-log';

type KindFilter = 'ALL' | Delivery['kind'];
type StatusFilter = 'ALL' | PlanStatus['kind'];

const STATUS_LABEL: Record<PlanStatus['kind'], string> = {
  ON_TIME: 'On time',
  LATE: 'Late',
  RECEIVED: 'Received',
  OVERDUE: 'Overdue',
  EXPECTED: 'Expected',
};
const STATUS_TONE: Record<PlanStatus['kind'], Tone> = {
  ON_TIME: 'ok',
  LATE: 'risk',
  RECEIVED: 'info',
  OVERDUE: 'risk',
  EXPECTED: 'muted',
};

const statusText = (s: PlanStatus) =>
  s.kind === 'LATE' ? `Late · ${s.days} d` : STATUS_LABEL[s.kind];

export interface DeliveryLogTableProps {
  deliveries: Delivery[] | undefined;
  isPending: boolean;
  error: Error | null;
  retry: () => void;
  cache: ProjectCache | undefined;
  today: string;
}

const SELECT = cx(
  'rounded-lg border border-line bg-surface px-2 py-1.5 text-sm',
  FOCUS,
);

export function DeliveryLogTable({
  deliveries,
  isPending,
  error,
  retry,
  cache,
  today,
}: DeliveryLogTableProps) {
  const [kind, setKind] = useState<KindFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [text, setText] = useState('');

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    return (deliveries ?? [])
      .map((d) => {
        const item = cache?.itemsById[d.costItemId];
        return { d, item, status: planStatus(d, item, today) };
      })
      .filter((r) => kind === 'ALL' || r.d.kind === kind)
      .filter((r) => status === 'ALL' || r.status.kind === status)
      .filter(
        (r) =>
          !q ||
          r.d.deliveryNoteNo.toLowerCase().includes(q) ||
          (r.item?.code.toLowerCase().includes(q) ?? false) ||
          (r.item?.name.toLowerCase().includes(q) ?? false),
      );
  }, [deliveries, cache, today, kind, status, text]);

  let body;
  if (isPending) body = <Skeleton lines={5} />;
  else if (error)
    body = (
      <ErrorState
        title="Could not load deliveries"
        error={error}
        retry={retry}
      />
    );
  else if (!deliveries?.length)
    body = (
      <EmptyState
        title="No deliveries yet"
        description="Upload a CSV to start the log."
      />
    );
  else
    body = (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Delivery log">
          <thead className="bg-subtle text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Note no.</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Invoice</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, item, status: s }) => (
              <tr key={d.id} className="border-t border-line">
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {formatDate(d.date)}
                </td>
                <td className="px-3 py-1.5">{d.deliveryNoteNo}</td>
                <td className="px-3 py-1.5">
                  {item ? (
                    <>
                      <span className="text-muted">{item.code}</span>{' '}
                      {item.name}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-1.5 text-muted">
                  {d.kind === 'DELIVERED' ? 'Delivered' : 'Expected'}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatQty(d.qtyMilli, item?.unit)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {d.invoiceCents === null ? '—' : formatEur(d.invoiceCents)}
                </td>
                <td className="px-3 py-1.5">
                  <Badge tone={STATUS_TONE[s.kind]}>{statusText(s)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted">
            No deliveries match the filters.
          </p>
        )}
      </div>
    );

  return (
    <Card>
      <SectionTitle
        subtitle="Status against the item's planned delivery date"
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Kind"
              className={SELECT}
              value={kind}
              onChange={(e) => setKind(e.target.value as KindFilter)}
            >
              <option value="ALL">All kinds</option>
              <option value="DELIVERED">Delivered</option>
              <option value="EXPECTED">Expected</option>
            </select>
            <select
              aria-label="Status"
              className={SELECT}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              {(Object.keys(STATUS_LABEL) as Array<PlanStatus['kind']>).map(
                (k) => (
                  <option key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </option>
                ),
              )}
            </select>
            <input
              type="search"
              aria-label="Search deliveries"
              placeholder="Code, item or note no."
              className={SELECT}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        }
      >
        Delivery log
      </SectionTitle>
      {body}
    </Card>
  );
}
