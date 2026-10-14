import { formatEur, itemPlannedCents } from '@default-project/budget-engine';
import type { CostItem, OrgRole } from '@default-project/types';
import {
  MoneyCell,
  OrgCell,
  QtyCell,
  StatusCell,
  TextCell,
  type Column,
} from '../../ui/editable-table';
import { workDurationDays } from './construction-model';
import { MaterialChips, ReadinessCell, WorkDateCell } from './work-cells';

// OrgCell's organisation-role filter (02's API); an expression, so jsx-a11y does not read it as an ARIA role.
const CONTRACTOR_ROLE: OrgRole = 'CONTRACTOR';

/** Module scope: a stable reference, so editing one row re-renders only that row. */
export const CONSTRUCTION_COLUMNS: readonly Column<CostItem>[] = [
  {
    id: 'code',
    header: 'Code',
    width: 'w-28',
    mobile: 'hidden',
    cell: (r) => <span className="text-muted">{r.code}</span>,
  },
  {
    id: 'name',
    header: 'Work item',
    mobile: 'title',
    cell: (r, edit) => (
      <TextCell
        value={r.name}
        label="work item"
        onCommit={(name) => edit({ name })}
      />
    ),
  },
  {
    id: 'qty',
    header: 'Volume',
    align: 'right',
    cell: (r, edit) => (
      <QtyCell
        milli={r.qtyMilli}
        unit={r.unit}
        label="volume"
        onCommit={(qtyMilli) => edit({ qtyMilli })}
      />
    ),
  },
  {
    id: 'rate',
    header: 'Rate',
    align: 'right',
    cell: (r, edit) => (
      <MoneyCell
        cents={r.unitPriceCents}
        label="rate"
        onCommit={(unitPriceCents) => edit({ unitPriceCents })}
      />
    ),
  },
  {
    id: 'planned',
    header: 'Planned',
    align: 'right',
    cell: (r) => <span>{formatEur(itemPlannedCents(r))}</span>,
  },
  {
    id: 'committed',
    header: 'Committed',
    align: 'right',
    cell: (r, edit) => (
      <MoneyCell
        cents={r.committedCents}
        label="committed"
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
        cents={r.actualCents}
        label="actual"
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
    id: 'contractor',
    header: 'Contractor',
    cell: (r, edit) => (
      <OrgCell
        orgId={r.contractorId}
        role={CONTRACTOR_ROLE}
        label="contractor"
        onCommit={(contractorId) => edit({ contractorId })}
      />
    ),
  },
  {
    id: 'start',
    header: 'Start',
    cell: (r, edit) => (
      <WorkDateCell
        field="startDate"
        startDate={r.startDate}
        endDate={r.endDate}
        onCommit={edit}
      />
    ),
  },
  {
    id: 'end',
    header: 'End',
    cell: (r, edit) => (
      <WorkDateCell
        field="endDate"
        startDate={r.startDate}
        endDate={r.endDate}
        onCommit={edit}
      />
    ),
  },
  {
    id: 'duration',
    header: 'Duration',
    align: 'right',
    cell: (r) => {
      const days = workDurationDays(r.startDate, r.endDate);
      return <span>{days === null ? '—' : `${days} d`}</span>;
    },
  },
  {
    id: 'materials',
    header: 'Materials',
    cell: (r) => <MaterialChips workId={r.id} workName={r.name} />,
  },
  {
    id: 'readiness',
    header: 'Readiness',
    cell: (r) => <ReadinessCell workId={r.id} />,
  },
];
