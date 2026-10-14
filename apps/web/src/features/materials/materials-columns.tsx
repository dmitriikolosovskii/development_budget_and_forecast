import type { CostItem } from '@default-project/types';
import { DateCell, MoneyCell, OrgCell, QtyCell, StatusCell, type Column } from '../../ui/editable-table';
import {
  ActualCell,
  DeleteMaterialButton,
  ItemNameCell,
  MaterialScheduleCell,
  NeededByCell,
  PlannedAmountCell,
} from './materials-cells';

/**
 * Columns of the materials table, left → right (BLOCK 04). Module scope = stable identity, so editing one
 * row never re-renders the others. Cells that need more than the row read narrow selectors themselves.
 */
export const MATERIAL_COLUMNS: readonly Column<CostItem>[] = [
  {
    id: 'code',
    header: 'Code',
    width: 'w-32',
    // The delete action lives here so that Schedule stays the rightmost column.
    cell: (r) => (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-xs whitespace-nowrap text-muted">{r.code}</span>
        <DeleteMaterialButton item={r} />
      </span>
    ),
  },
  { id: 'item', header: 'Item', mobile: 'title', cell: (r, edit) => <ItemNameCell item={r} edit={edit} /> },
  {
    id: 'qty',
    header: 'Qty',
    align: 'right',
    cell: (r, edit) => <QtyCell milli={r.qtyMilli} unit={r.unit} label={`quantity ${r.code}`} onCommit={(qtyMilli) => edit({ qtyMilli })} />,
  },
  {
    id: 'unitPrice',
    header: 'Unit price',
    align: 'right',
    cell: (r, edit) => (
      <MoneyCell cents={r.unitPriceCents} label={`unit price ${r.code}`} onCommit={(unitPriceCents) => edit({ unitPriceCents })} />
    ),
  },
  { id: 'planned', header: 'Planned amount', align: 'right', cell: (r) => <PlannedAmountCell item={r} /> },
  {
    id: 'committed',
    header: 'Committed',
    align: 'right',
    cell: (r, edit) => (
      <MoneyCell cents={r.committedCents} label={`committed ${r.code}`} onCommit={(committedCents) => edit({ committedCents })} />
    ),
  },
  { id: 'actual', header: 'Actual', align: 'right', cell: (r, edit) => <ActualCell item={r} edit={edit} /> },
  { id: 'status', header: 'Status', cell: (r, edit) => <StatusCell status={r.status} onCommit={(status) => edit({ status })} /> },
  {
    id: 'supplier',
    header: 'Supplier',
    cell: (r, edit) => (
      // eslint-disable-next-line jsx-a11y/aria-role -- OrgCell's `role` is an OrgRole picker filter, not an ARIA role
      <OrgCell orgId={r.supplierId} role="SUPPLIER" label={`supplier ${r.code}`} onCommit={(supplierId) => edit({ supplierId })} />
    ),
  },
  {
    id: 'installer',
    header: 'Installer',
    cell: (r, edit) => (
      // eslint-disable-next-line jsx-a11y/aria-role -- OrgCell's `role` is an OrgRole picker filter, not an ARIA role
      <OrgCell orgId={r.contractorId} role="CONTRACTOR" label={`installer ${r.code}`} onCommit={(contractorId) => edit({ contractorId })} />
    ),
  },
  {
    id: 'deliveryDate',
    header: 'Delivery',
    cell: (r, edit) => <DateCell value={r.deliveryDate} label={`${r.code} delivery date`} onCommit={(deliveryDate) => edit({ deliveryDate })} />,
  },
  { id: 'neededBy', header: 'Needed by', mobile: 'hidden', cell: (r) => <NeededByCell item={r} /> },
  { id: 'schedule', header: 'Schedule', cell: (r) => <MaterialScheduleCell item={r} /> },
];
