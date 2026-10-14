import { useCallback, useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { findCatalogSection } from '@default-project/types';
import { useUiStore } from '../../lib/ui-store';
import { Badge } from '../../ui/badge';
import { EditableTable } from '../../ui/editable-table';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import { SubNav } from '../../ui/sub-nav';
import { BudgetHealthPanel } from '../project/budget-health-panel';
import { useBudgetLines } from '../project/use-budget-lines';
import { useCreateItem } from '../project/use-create-item';
import { useDeleteItem } from '../project/use-delete-item';
import { useEditItem } from '../project/use-edit-item';
import { useItem } from '../project/use-item';
import { useItemIds } from '../project/use-item-ids';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { useToday } from '../project/use-today';
import { CONSTRUCTION_COLUMNS } from './construction-columns';
import { ConstructionGantt } from './construction-gantt';
import {
  buildGanttModel,
  buildScheduleAlerts,
  conflictCountBySection,
  CONTINGENCY_SECTION,
  nextWorkCode,
  shiftWorkToDate,
} from './construction-model';
import { ContingencyPanel } from './contingency-panel';
import { ScheduleAlerts } from './schedule-alerts';
import { scheduleOf } from './use-construction-schedule';

/** "Construction" tab: works per section, schedule conflicts, mini Gantt, contingency reserve. */
export function ConstructionPage() {
  const { projectId = '', section } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const snapshot = useProjectSnapshot(projectId);
  const lines = useBudgetLines(projectId, 'CONSTRUCTION');
  const lastSection = useUiStore((s) => s.lastSection.construction);
  const setLastSection = useUiStore((s) => s.setLastSection);
  const editItem = useEditItem(projectId);
  const createItem = useCreateItem(projectId);
  const deleteItem = useDeleteItem(projectId);

  const line = lines.find((l) => l.section === section);
  const rowIds = useItemIds(projectId, line?.id ?? '');

  useEffect(() => {
    if (line) setLastSection('construction', line.section);
  }, [line, setLastSection]);

  const cache = snapshot.data;
  const derived = useMemo(() => {
    if (!cache) return null;
    const schedule = scheduleOf(cache.items, today);
    return {
      alerts: buildScheduleAlerts(cache, schedule),
      counts: conflictCountBySection(cache, schedule),
      gantt: buildGanttModel(cache, schedule, lines, today),
    };
  }, [cache, lines, today]);

  const onShift = useCallback(
    (workId: string, newStart: string) => {
      const work = cache?.itemsById[workId];
      if (work) editItem(workId, shiftWorkToDate(work, newStart));
    },
    [cache, editItem],
  );
  const onDelete = useCallback(
    (itemId: string) => void deleteItem(itemId).catch(() => undefined),
    [deleteItem],
  );
  const onAdd = useCallback(() => {
    if (!line || !cache) return;
    const prefix =
      findCatalogSection('CONSTRUCTION', line.section)?.codePrefix ?? 'WRK';
    void createItem({
      budgetLineId: line.id,
      kind: 'WORK',
      code: nextWorkCode(cache.items, prefix),
      name: 'New work item',
      unit: 'h',
      qtyMilli: 0,
      unitPriceCents: 0,
    }).catch(() => undefined);
  }, [cache, createItem, line]);

  if (snapshot.isPending) return <Skeleton lines={8} />;
  if (snapshot.isError || !cache || !derived)
    return (
      <ErrorState
        error={snapshot.error}
        retry={() => void snapshot.refetch()}
      />
    );
  if (lines.length === 0)
    return <EmptyState title="This project has no construction lines." />;

  if (!section) {
    const target = lines.some((l) => l.section === lastSection)
      ? lastSection
      : lines[0].section;
    return (
      <Navigate
        to={`/projects/${encodeURIComponent(projectId)}/construction/${target}`}
        replace
      />
    );
  }

  const subNavItems = lines.map((l) => {
    const n = derived.counts[l.section] ?? 0;
    return {
      id: l.section,
      label: l.name,
      badge:
        n > 0 && l.section !== CONTINGENCY_SECTION ? (
          <Badge
            tone="risk"
            title={`${n} schedule ${n === 1 ? 'conflict' : 'conflicts'}`}
          >
            {n}
          </Badge>
        ) : undefined,
    };
  });

  return (
    <div className="animate-fade-in space-y-4">
      <ScheduleAlerts
        projectId={projectId}
        alerts={derived.alerts}
        onShift={onShift}
      />
      <div className="flex flex-col gap-4 lg:flex-row">
        <SubNav
          label="Construction sections"
          items={subNavItems}
          active={section}
          onSelect={(id) =>
            navigate(
              `/projects/${encodeURIComponent(projectId)}/construction/${id}`,
            )
          }
        />
        <div className="min-w-0 flex-1 space-y-4">
          {!line ? (
            <EmptyState title="Unknown section." />
          ) : line.section === CONTINGENCY_SECTION ? (
            <ContingencyPanel projectId={projectId} lineId={line.id} />
          ) : (
            // Conflicted rows (a cell carries data-conflict) get the soft risk tint.
            <div className="[&_tr:has([data-conflict])_td]:bg-risk-50">
              <EditableTable
                caption={line.name}
                rowIds={rowIds}
                context={projectId}
                useRow={useItem}
                columns={CONSTRUCTION_COLUMNS}
                onEdit={editItem}
                onAdd={onAdd}
                addLabel="Add work item"
                onDelete={onDelete}
                emptyText="No work items in this section yet."
              />
            </div>
          )}
        </div>
        {line && (
          <aside className="lg:w-72 lg:shrink-0">
            <BudgetHealthPanel projectId={projectId} lineId={line.id} />
          </aside>
        )}
      </div>
      <ConstructionGantt model={derived.gantt} today={today} />
    </div>
  );
}
