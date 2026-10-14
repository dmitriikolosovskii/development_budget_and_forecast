import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatEur, itemPlannedCents } from '@default-project/budget-engine';
import type { CostItem } from '@default-project/types';
import { Card, SectionTitle } from '../../../ui/card';
import {
  EditableTable,
  MoneyCell,
  QtyCell,
  StatusCell,
  TextCell,
  type Column,
} from '../../../ui/editable-table';
import { SubNav } from '../../../ui/sub-nav';
import { BudgetHealthPanel } from '../../project/budget-health-panel';
import type { ProjectCache } from '../../project/project-cache';
import { useBudgetLines } from '../../project/use-budget-lines';
import { useEditItem } from '../../project/use-edit-item';
import { useItem } from '../../project/use-item';
import { useItemIds } from '../../project/use-item-ids';
import { useProjectSnapshot } from '../../project/use-project-snapshot';
import { useProjectSummary } from '../../project/use-project-summary';

const COLUMNS: Column<CostItem>[] = [
  {
    id: 'code',
    header: 'Code',
    width: 'w-28',
    mobile: 'hidden',
    cell: (r) => <span className="text-muted">{r.code}</span>,
  },
  {
    id: 'name',
    header: 'Item',
    mobile: 'title',
    cell: (r, edit) => (
      <TextCell
        value={r.name}
        label="item name"
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
        cents={r.unitPriceCents}
        label="unit price"
        onCommit={(unitPriceCents) => edit({ unitPriceCents })}
      />
    ),
  },
  {
    id: 'planned',
    header: 'Planned',
    align: 'right',
    cell: (r) => <MoneyCell cents={itemPlannedCents(r)} label="planned" />,
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
];

/** LAND cost lines (purchase, acquisition costs, site development, surveys) + the CFO's answers for LAND. */
export function LandCostsSection({ projectId }: { projectId: string }) {
  const lines = useBudgetLines(projectId, 'LAND');
  const [params] = useSearchParams();
  const highlight = params.get('highlight');
  // Search (13) links LAND rows as `/land?highlight=<itemId>`: open the section that holds the row.
  const selectHighlightLine = useCallback(
    (c: ProjectCache) =>
      (highlight ? c.itemsById[highlight]?.budgetLineId : undefined) ?? null,
    [highlight],
  );
  const { data: highlightLineId = null } = useProjectSnapshot(
    projectId,
    selectHighlightLine,
  );
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (highlightLineId) setSelected(highlightLineId);
  }, [highlightLineId]);

  const activeId = lines.some((l) => l.id === selected)
    ? selected
    : (lines[0]?.id ?? null);
  const line = lines.find((l) => l.id === activeId);
  const ids = useItemIds(projectId, activeId ?? '');
  const editItem = useEditItem(projectId);
  const rollup = useProjectSummary(projectId);
  const lineSummary = activeId ? rollup?.byLine[activeId] : undefined;

  return (
    <section
      aria-label="Land costs"
      className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]"
    >
      <Card>
        <SectionTitle subtitle="Purchase, taxes & notary, utility connections, surveys">
          Land costs
        </SectionTitle>
        {lines.length === 0 ? (
          <p className="text-sm text-muted">
            This project has no LAND budget lines.
          </p>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            <SubNav
              label="Land cost sections"
              items={lines.map((l) => ({ id: l.id, label: l.name }))}
              active={activeId ?? undefined}
              onSelect={setSelected}
            />
            <div className="min-w-0 flex-1 animate-[fade-in_180ms]">
              <EditableTable
                caption={line?.name ?? ''}
                rowIds={ids}
                context={projectId}
                useRow={useItem}
                columns={COLUMNS}
                onEdit={editItem}
                footer={
                  lineSummary
                    ? {
                        planned: formatEur(lineSummary.planned),
                        actual: formatEur(lineSummary.actual),
                      }
                    : undefined
                }
              />
            </div>
          </div>
        )}
      </Card>
      <BudgetHealthPanel projectId={projectId} category="LAND" />
    </section>
  );
}
