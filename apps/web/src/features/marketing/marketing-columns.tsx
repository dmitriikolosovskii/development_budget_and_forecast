import { formatEur, itemPlannedCents } from '@default-project/budget-engine';
import type { CostItem } from '@default-project/types';
import { Badge } from '../../ui/badge';
import {
  DateCell,
  MoneyCell,
  OrgCell,
  QtyCell,
  StatusCell,
  TextCell,
  type Column,
} from '../../ui/editable-table';
import { useToday } from '../project/use-today';
import { campaignPhase, PHASE_LABEL } from './marketing-model';

/** "Running now" / "Planned" / "Finished" by dates against the demo "today" (AC-09.3). */
export function PhaseBadge({
  start,
  end,
}: {
  start: string | null;
  end: string | null;
}) {
  const today = useToday();
  const { label, tone } = PHASE_LABEL[campaignPhase(start, end, today)];
  return <Badge tone={tone}>{label}</Badge>;
}

// OrgCell's `role` is the organisation-role filter of the picker, not an ARIA role (spread keeps jsx-a11y quiet).
const AGENCY_PICKER = { role: 'AGENCY' } as const;

/** Module-level, so the memo rows of EditableTable keep their identity. */
export const MARKETING_COLUMNS: Column<CostItem>[] = [
  {
    id: 'code',
    header: 'Code',
    width: 'w-28',
    mobile: 'hidden',
    cell: (r) => <span className="font-mono text-xs text-muted">{r.code}</span>,
  },
  {
    id: 'name',
    header: 'Activity',
    mobile: 'title',
    cell: (r, edit) => (
      <TextCell
        label={`Activity ${r.code}`}
        value={r.name}
        onCommit={(name) => edit({ name })}
      />
    ),
  },
  {
    id: 'qty',
    header: 'Qty',
    align: 'right',
    cell: (r, edit) => (
      <QtyCell
        label={`Qty ${r.code}`}
        milli={r.qtyMilli}
        unit={r.unit}
        onCommit={(qtyMilli) => edit({ qtyMilli })}
      />
    ),
  },
  {
    id: 'price',
    header: 'Unit price',
    align: 'right',
    cell: (r, edit) => (
      <MoneyCell
        label={`Unit price ${r.code}`}
        cents={r.unitPriceCents}
        onCommit={(unitPriceCents) => edit({ unitPriceCents })}
      />
    ),
  },
  {
    id: 'planned',
    header: 'Planned',
    align: 'right',
    cell: (r) => (
      <span className="tabular-nums">{formatEur(itemPlannedCents(r))}</span>
    ),
  },
  {
    id: 'committed',
    header: 'Committed',
    align: 'right',
    cell: (r, edit) => (
      <MoneyCell
        label={`Committed ${r.code}`}
        cents={r.committedCents}
        onCommit={(committedCents) => edit({ committedCents })}
      />
    ),
  },
  {
    id: 'actual',
    header: 'Actual',
    align: 'right',
    cell: (r, edit) => (
      <MoneyCell
        label={`Actual ${r.code}`}
        cents={r.actualCents}
        onCommit={(actualCents) => edit({ actualCents })}
      />
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (r, edit) => (
      <StatusCell status={r.status} onCommit={(status) => edit({ status })} />
    ),
  },
  {
    id: 'agency',
    header: 'Agency / vendor',
    cell: (r, edit) => (
      <OrgCell
        label={`Agency ${r.code}`}
        orgId={r.contractorId}
        {...AGENCY_PICKER}
        onCommit={(contractorId) => edit({ contractorId })}
      />
    ),
  },
  {
    id: 'start',
    header: 'Start',
    cell: (r, edit) => (
      <DateCell
        label={`Start ${r.code}`}
        value={r.startDate}
        onCommit={(startDate) => edit({ startDate })}
      />
    ),
  },
  {
    id: 'end',
    header: 'End',
    cell: (r, edit) => (
      <DateCell
        label={`End ${r.code}`}
        value={r.endDate}
        onCommit={(endDate) => edit({ endDate })}
      />
    ),
  },
  {
    id: 'phase',
    header: 'Campaign',
    cell: (r) => <PhaseBadge start={r.startDate} end={r.endDate} />,
  },
];
