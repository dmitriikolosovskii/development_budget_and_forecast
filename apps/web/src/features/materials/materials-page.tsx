import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import { useUiStore } from '../../lib/ui-store';
import { Badge } from '../../ui/badge';
import { EditableTable } from '../../ui/editable-table';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import { SubNav, type SubNavItem } from '../../ui/sub-nav';
import { BudgetHealthPanel } from '../project/budget-health-panel';
import { useCreateItem } from '../project/use-create-item';
import { useEditItem } from '../project/use-edit-item';
import { useItem } from '../project/use-item';
import { useItemIds } from '../project/use-item-ids';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { useProjectSummary } from '../project/use-project-summary';
import type { ProjectCache } from '../project/project-cache';
import { MATERIAL_COLUMNS } from './materials-columns';
import { SectionBudget, sectionTotals } from './materials-footer';
import { MaterialsOverview } from './materials-overview';
import { codePrefixOf, selectMaterialLines, useLateCountsByLine } from './use-materials';
import { nextItemCode } from './next-item-code';

/** Adds a MATERIAL row with the next free code; one create at a time, one retry on a code conflict (409). */
function useAddMaterial(projectId: string, lineId: string | undefined, section: string | undefined) {
  const qc = useQueryClient();
  const createItem = useCreateItem(projectId);
  const pending = useRef(false);
  return useCallback(async () => {
    const prefix = section ? codePrefixOf(section) : undefined;
    if (!lineId || !prefix || pending.current) return;
    pending.current = true;
    const create = () => {
      const items = qc.getQueryData<ProjectCache>(queryKeys.project(projectId))?.items ?? [];
      return createItem({
        budgetLineId: lineId,
        kind: 'MATERIAL',
        code: nextItemCode(items, prefix),
        name: 'New material',
        unit: 'pcs',
        qtyMilli: 0,
        unitPriceCents: 0,
      });
    };
    try {
      await create().catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 409) return create();
        throw error;
      });
    } catch {
      // useCreateItem already removed the temp row and showed a toast.
    } finally {
      pending.current = false;
    }
  }, [qc, createItem, projectId, lineId, section]);
}

/** `/projects/:projectId/materials/:section?` — SubNav · editable MATERIAL rows · Budget health. */
export function MaterialsPage() {
  const { projectId = '', section } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const remembered = useUiStore((s) => s.lastSection.materials);
  const setLastSection = useUiStore((s) => s.setLastSection);

  const linesQuery = useProjectSnapshot(projectId, selectMaterialLines);
  const lines = useMemo(() => linesQuery.data ?? [], [linesQuery.data]);
  const line = lines.find((l) => l.section === section);
  const rollup = useProjectSummary(projectId);
  const lateByLine = useLateCountsByLine(projectId);
  const rowIds = useItemIds(projectId, line?.id ?? '');
  const editItem = useEditItem(projectId);
  const addMaterial = useAddMaterial(projectId, line?.id, line?.section);

  useEffect(() => {
    if (line) setLastSection('materials', line.section);
  }, [line, setLastSection]);

  const navItems: SubNavItem[] = useMemo(
    () =>
      lines.map((l) => {
        const overrun = rollup?.byLine[l.id]?.overrun ?? false;
        const late = lateByLine[l.id] ?? 0;
        return {
          id: l.section,
          label: l.name,
          badge:
            overrun || late > 0 ? (
              <span className="flex gap-1">
                {overrun && (
                  <Badge tone="risk" title="Forecast above the approved budget">
                    Over
                  </Badge>
                )}
                {late > 0 && (
                  <Badge tone="warn" title="Materials late for work or overdue">
                    {late} late
                  </Badge>
                )}
              </span>
            ) : undefined,
        };
      }),
    [lines, rollup, lateByLine],
  );

  if (linesQuery.isError) {
    return <ErrorState title="Could not load building materials" error={linesQuery.error} retry={() => void linesQuery.refetch()} />;
  }
  if (linesQuery.isPending) return <Skeleton lines={8} />;
  if (lines.length === 0) return <EmptyState title="This project has no building material sections." />;

  if (!line) {
    // No (or an unknown) section: the remembered one if it still exists, otherwise the first; keep ?highlight/?org.
    const target = lines.find((l) => l.section === remembered) ?? lines[0];
    const base = `/projects/${encodeURIComponent(projectId)}/materials`;
    return <Navigate to={`${base}/${encodeURIComponent(target.section)}${search}`} replace />;
  }

  const lineSummary = rollup?.byLine[line.id];

  return (
    <div className="space-y-4">
      <MaterialsOverview projectId={projectId} />
      <div className="flex flex-col gap-4 lg:flex-row">
        <SubNav
          label="Material sections"
          items={navItems}
          active={line.section}
          onSelect={(id) => navigate(`/projects/${encodeURIComponent(projectId)}/materials/${encodeURIComponent(id)}`)}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-4 2xl:flex-row">
          <section aria-label={line.name} className="min-w-0 flex-1 space-y-3 animate-fade-in" key={line.id}>
            <h2 className="text-lg font-semibold">{line.name}</h2>
            <EditableTable
              caption={line.name}
              rowIds={rowIds}
              context={projectId}
              useRow={useItem}
              columns={MATERIAL_COLUMNS}
              onEdit={editItem}
              footer={sectionTotals(lineSummary)}
              onAdd={() => void addMaterial()}
              addLabel="Add material"
              emptyText="No materials in this section yet."
            />
            <SectionBudget projectId={projectId} lineId={line.id} summary={lineSummary} />
          </section>
          <aside className="2xl:sticky 2xl:top-4 2xl:w-80 2xl:self-start">
            <BudgetHealthPanel projectId={projectId} lineId={line.id} />
          </aside>
        </div>
      </div>
    </div>
  );
}
