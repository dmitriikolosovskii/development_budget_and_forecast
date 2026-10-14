import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatEur } from '@default-project/budget-engine';
import { catalogSections, UNIT_LABELS, UNITS, type BoqComponent, type HouseSection, type Unit } from '@default-project/types';
import { Badge } from '../../ui/badge';
import { EditableTable, QtyCell, SelectCell, TextCell, type Column } from '../../ui/editable-table';
import { FlashValue } from '../../ui/flash-value';
import { HOUSE_SECTION_INFO } from './house-sections';
import { useBoqLink, useComponent, useComponentIds, usePlan } from './use-plan';
import { useCreateComponent, useDeleteComponent, useEditComponent } from './use-plan-edits';

const MATERIAL_OPTIONS = catalogSections('MATERIALS').map((s) => ({ value: s.section, label: s.name }));
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }));

function LinkedCount({ projectId, componentId }: { projectId: string; componentId: string }) {
  const link = useBoqLink(projectId, componentId);
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {link?.count ?? 0}
      {link?.unitMismatch && (
        <Badge tone="warn" title="A linked row uses another unit; the quantity is copied as is">
          unit
        </Badge>
      )}
    </span>
  );
}

function PlannedCost({ projectId, componentId }: { projectId: string; componentId: string }) {
  const cents = useBoqLink(projectId, componentId)?.plannedCents ?? 0;
  return (
    <span data-testid={`boq-planned-${componentId}`} className="tabular-nums">
      <FlashValue value={cents}>{formatEur(cents)}</FlashValue>
    </span>
  );
}

function boqColumns(projectId: string): Column<BoqComponent>[] {
  return [
    {
      id: 'code',
      header: 'Code',
      width: 'w-32',
      mobile: 'title',
      cell: (r, edit) => <TextCell label={`code ${r.code}`} value={r.code} onCommit={(code) => edit({ code })} />,
    },
    {
      id: 'name',
      header: 'Component',
      mobile: 'title',
      cell: (r, edit) => <TextCell label={`name ${r.code}`} value={r.name} onCommit={(name) => edit({ name })} />,
    },
    {
      id: 'qty',
      header: 'Qty',
      align: 'right',
      width: 'w-32',
      cell: (r, edit) => (
        <QtyCell label={`qty ${r.code}`} milli={r.qtyMilli} unit={r.unit} onCommit={(qtyMilli) => edit({ qtyMilli })} />
      ),
    },
    {
      id: 'unit',
      header: 'Unit',
      width: 'w-24',
      cell: (r, edit) => (
        <SelectCell<Unit>
          label={`unit ${r.code}`}
          value={r.unit as Unit}
          options={UNIT_OPTIONS}
          onCommit={(unit) => unit && edit({ unit })}
        />
      ),
    },
    {
      id: 'material',
      header: 'Material section',
      cell: (r, edit) => (
        <span className="flex items-center gap-1">
          <SelectCell
            label={`material section ${r.code}`}
            value={r.materialSection}
            options={MATERIAL_OPTIONS}
            allowEmpty
            onCommit={(materialSection) => edit({ materialSection })}
          />
          {r.materialSection && (
            <Link
              to={`/projects/${projectId}/materials/${r.materialSection}`}
              aria-label={`Open Building materials: ${r.materialSection}`}
              className="text-brand-600 hover:text-brand-500"
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            </Link>
          )}
        </span>
      ),
    },
    {
      id: 'linked',
      header: 'Linked items',
      align: 'right',
      width: 'w-24',
      cell: (r) => <LinkedCount projectId={projectId} componentId={r.id} />,
    },
    {
      id: 'planned',
      header: 'Planned cost',
      align: 'right',
      width: 'w-32',
      cell: (r) => <PlannedCost projectId={projectId} componentId={r.id} />,
    },
    {
      id: 'notes',
      header: 'Notes',
      mobile: 'hidden',
      cell: (r, edit) => <TextCell label={`notes ${r.code}`} value={r.notes} onCommit={(notes) => edit({ notes })} />,
    },
  ];
}

export interface BoqSectionProps {
  projectId: string;
  section: HouseSection;
}

/** The takeoff of one house section; a qty edit drives the linked MATERIAL rows (AC-08.4). */
export function BoqSection({ projectId, section }: BoqSectionProps) {
  const info = HOUSE_SECTION_INFO[section];
  const ids = useComponentIds(projectId, section);
  const plan = usePlan(projectId).data;
  const columns = useMemo(() => boqColumns(projectId), [projectId]);
  const edit = useEditComponent(projectId);
  const create = useCreateComponent(projectId);
  const remove = useDeleteComponent(projectId);
  const onDelete = useCallback((id: string) => void remove(id), [remove]);

  const onAdd = useCallback(() => {
    const prefix = `BOQ-${info.code}-`;
    const used = (plan?.components ?? [])
      .filter((c) => c.code.startsWith(prefix))
      .map((c) => Number(c.code.slice(prefix.length)) || 0);
    const next = String(Math.max(0, ...used) + 1).padStart(3, '0');
    void create({
      code: `${prefix}${next}`,
      houseSection: section,
      name: 'New component',
      unit: 'pcs',
      qtyMilli: 0,
      materialSection: info.materialSection,
      sortOrder: ids.length,
    });
  }, [create, ids.length, info, plan?.components, section]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{info.description}</p>
      <EditableTable
        caption={`${info.label} takeoff`}
        rowIds={ids}
        context={projectId}
        useRow={useComponent}
        columns={columns}
        onEdit={edit}
        onAdd={onAdd}
        addLabel="Add component"
        onDelete={onDelete}
        emptyText="No components in this section yet."
      />
    </div>
  );
}
