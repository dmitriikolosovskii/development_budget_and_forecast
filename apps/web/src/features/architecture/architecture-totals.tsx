import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { formatEur, formatEurWhole, itemPlannedCents } from '@default-project/budget-engine';
import { HOUSE_SECTIONS, type BudgetLine, type CostItem } from '@default-project/types';
import { CATEGORY_COLORS, CHART_TOOLTIP_STYLE, ChartCard } from '../../ui/chart-card';
import { EditableTable, MoneyCell, OrgCell, StatusCell, TextCell, type Column } from '../../ui/editable-table';
import { useBudgetLines } from '../project/use-budget-lines';
import { useEditItem } from '../project/use-edit-item';
import { useItem } from '../project/use-item';
import { useItemIds } from '../project/use-item-ids';
import { HOUSE_SECTION_INFO } from './house-sections';
import { useSectionCosts } from './use-plan';

/** Planned cost per house section (Σ planned of the linked MATERIAL rows). */
export function HouseSectionCostChart({ projectId }: { projectId: string }) {
  const costs = useSectionCosts(projectId) ?? {};
  const data = HOUSE_SECTIONS.map((s) => ({ section: HOUSE_SECTION_INFO[s].label, planned: (costs[s] ?? 0) / 100 }));
  const total = HOUSE_SECTIONS.reduce((sum, s) => sum + (costs[s] ?? 0), 0);
  return (
    <ChartCard title="Planned materials by house section" subtitle={`Linked takeoff rows: ${formatEurWhole(total)}`} height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={(v: number) => formatEurWhole(Math.round(v * 100))} fontSize={11} />
        <YAxis type="category" dataKey="section" width={130} fontSize={11} />
        <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => formatEur(Math.round(Number(v) * 100))} />
        <Bar dataKey="planned" name="Planned" fill={CATEGORY_COLORS.MATERIALS} radius={[0, 6, 6, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartCard>
  );
}

const COST_COLUMNS: Column<CostItem>[] = [
  { id: 'code', header: 'Code', width: 'w-28', mobile: 'title', cell: (r) => <span className="text-muted">{r.code}</span> },
  {
    id: 'name',
    header: 'Item',
    mobile: 'title',
    cell: (r, edit) => <TextCell label={`name ${r.code}`} value={r.name} onCommit={(name) => edit({ name })} />,
  },
  {
    id: 'contractor',
    header: 'Consultant',
    cell: (r, edit) => <OrgCell orgId={r.contractorId} label={`consultant ${r.code}`} onCommit={(contractorId) => edit({ contractorId })} />,
  },
  {
    id: 'price',
    header: 'Planned',
    align: 'right',
    width: 'w-32',
    cell: (r, edit) =>
      r.qtyMilli === 1000 ? (
        <MoneyCell label={`planned ${r.code}`} cents={r.unitPriceCents} onCommit={(unitPriceCents) => edit({ unitPriceCents })} />
      ) : (
        <span className="tabular-nums">{formatEur(itemPlannedCents(r))}</span>
      ),
  },
  {
    id: 'committed',
    header: 'Committed',
    align: 'right',
    width: 'w-32',
    cell: (r, edit) => <MoneyCell label={`committed ${r.code}`} cents={r.committedCents} onCommit={(committedCents) => edit({ committedCents })} />,
  },
  {
    id: 'actual',
    header: 'Actual',
    align: 'right',
    width: 'w-32',
    cell: (r, edit) => <MoneyCell label={`actual ${r.code}`} cents={r.actualCents} onCommit={(actualCents) => edit({ actualCents })} />,
  },
  { id: 'status', header: 'Status', width: 'w-32', cell: (r, edit) => <StatusCell status={r.status} onCommit={(status) => edit({ status })} /> },
];

function CostLineTable({ projectId, line }: { projectId: string; line: BudgetLine }) {
  const ids = useItemIds(projectId, line.id);
  const edit = useEditItem(projectId);
  return (
    <EditableTable
      caption={`${line.name} · approved ${formatEurWhole(line.approvedCents)}`}
      rowIds={ids}
      context={projectId}
      useRow={useItem}
      columns={COST_COLUMNS}
      onEdit={edit}
      emptyText="No cost items in this line."
    />
  );
}

/** ARCHITECTURE category costs (design incl. HOAI LPH 1–9, engineering, permits, insurance). */
export function ArchitectureCosts({ projectId }: { projectId: string }) {
  const lines = useBudgetLines(projectId, 'ARCHITECTURE');
  return (
    <div className="space-y-4">
      {lines.map((line) => (
        <CostLineTable key={line.id} projectId={projectId} line={line} />
      ))}
    </div>
  );
}
