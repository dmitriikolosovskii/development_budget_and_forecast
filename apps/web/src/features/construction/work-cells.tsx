import { memo, useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Link2 } from 'lucide-react';
import type { CostItem } from '@default-project/types';
import { Badge, type Tone } from '../../ui/badge';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { Modal } from '../../ui/modal';
import { DateCell } from '../../ui/editable-table';
import { lineHref } from '../project/budget-health-panel';
import type { ProjectCache } from '../project/project-cache';
import { useEditItem } from '../project/use-edit-item';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { validateWorkDates } from './construction-model';
import {
  useLinkedMaterials,
  useWorkReadiness,
} from './use-construction-schedule';

const MATERIAL_TONE: Record<string, Tone> = {
  ON_TIME: 'ok',
  AT_RISK: 'warn',
  LATE_FOR_WORK: 'risk',
  OVERDUE: 'risk',
  DELIVERED: 'info',
  UNSCHEDULED: 'muted',
};

const MATERIAL_LABEL: Record<string, string> = {
  ON_TIME: 'on time',
  AT_RISK: 'at risk',
  LATE_FOR_WORK: 'late',
  OVERDUE: 'overdue',
  DELIVERED: 'delivered',
  UNSCHEDULED: 'unscheduled',
};

export interface WorkDateCellProps {
  field: 'startDate' | 'endDate';
  startDate: string | null;
  endDate: string | null;
  onCommit: (patch: Partial<CostItem>) => void;
}

/** Start/end editor: end before start shows "Invalid dates" and sends nothing. */
export function WorkDateCell({
  field,
  startDate,
  endDate,
  onCommit,
}: WorkDateCellProps) {
  const [error, setError] = useState<string | null>(null);
  const commit = (value: string | null) => {
    const problem =
      field === 'startDate'
        ? validateWorkDates(value, endDate)
        : validateWorkDates(startDate, value);
    setError(problem);
    if (!problem) onCommit({ [field]: value });
  };
  return (
    <span className="block">
      <DateCell
        value={field === 'startDate' ? startDate : endDate}
        onCommit={commit}
        label={field === 'startDate' ? 'start date' : 'end date'}
      />
      {error && (
        <span role="alert" className="mt-0.5 block text-xs text-risk-600">
          {error}
        </span>
      )}
    </span>
  );
}

const READINESS_TONE: Record<string, Tone> = {
  READY: 'ok',
  BLOCKED: 'risk',
  INVALID_DATES: 'warn',
};

/** Rightmost column; marks the row as conflicted (`data-conflict`) for the row tint. */
export const ReadinessCell = memo(function ReadinessCell({
  workId,
}: {
  workId: string;
}) {
  const { projectId = '' } = useParams();
  const readiness = useWorkReadiness(projectId, workId);
  if (!readiness) return <span className="text-muted">—</span>;
  const conflict = readiness.status !== 'READY';
  return (
    <span
      data-conflict={conflict || undefined}
      className="inline-flex items-center gap-1"
    >
      {conflict && (
        <AlertTriangle
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-risk-600"
        />
      )}
      <Badge tone={READINESS_TONE[readiness.status]} title={readiness.label}>
        {readiness.label}
      </Badge>
    </span>
  );
});

interface MaterialOption {
  id: string;
  code: string;
  name: string;
  sectionName: string;
  currentWorkId: string | null;
  currentWorkName: string | null;
}

const NO_OPTIONS: MaterialOption[] = [];

const selectMaterialOptions = (c: ProjectCache): MaterialOption[] =>
  c.items
    .filter((i) => i.kind === 'MATERIAL')
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      sectionName: c.linesById[m.budgetLineId]?.name ?? '',
      currentWorkId: m.requiredForWorkId,
      currentWorkName: m.requiredForWorkId
        ? (c.itemsById[m.requiredForWorkId]?.name ?? null)
        : null,
    }));

/** Multi-select over the project's MATERIAL rows; each toggle PATCHes the material's `requiredForWorkId`. */
export function LinkMaterialsModal({
  workId,
  workName,
  onClose,
}: {
  workId: string;
  workName: string;
  onClose: () => void;
}) {
  const { projectId = '' } = useParams();
  const options =
    useProjectSnapshot(projectId, selectMaterialOptions).data ?? NO_OPTIONS;
  const editItem = useEditItem(projectId);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) =>
          `${o.code} ${o.name} ${o.sectionName}`.toLowerCase().includes(q),
        )
      : options;
  }, [options, query]);

  return (
    <Modal open onClose={onClose} title={`Materials for ${workName}`}>
      <input
        aria-label="Filter materials"
        placeholder="Filter by code, name or section"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={cx(
          'mb-3 w-full rounded-lg border border-line px-3 py-1.5 text-sm',
          FOCUS,
        )}
      />
      <ul className="space-y-1">
        {shown.map((o) => {
          const checked = o.currentWorkId === workId;
          return (
            <li key={o.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    editItem(o.id, {
                      requiredForWorkId: e.target.checked ? workId : null,
                    })
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="text-ink">{o.name}</span>{' '}
                  <span className="text-muted">({o.code})</span>
                  <span className="block text-xs text-muted">
                    {o.sectionName}
                    {o.currentWorkName &&
                      !checked &&
                      ` · currently: ${o.currentWorkName}`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** Chips of the linked materials (click → the row in Materials) and a "Link materials" button. */
export const MaterialChips = memo(function MaterialChips({
  workId,
  workName,
}: {
  workId: string;
  workName: string;
}) {
  const { projectId = '' } = useParams();
  const materials = useLinkedMaterials(projectId, workId);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {materials.map((m) =>
        m.section ? (
          <Link
            key={m.id}
            to={`${lineHref(projectId, 'MATERIALS', m.section)}?highlight=${encodeURIComponent(m.id)}`}
            className={cx('rounded-full', FOCUS)}
          >
            <Badge
              tone={MATERIAL_TONE[m.status] ?? 'muted'}
              title={`${m.code}: ${MATERIAL_LABEL[m.status] ?? m.status}`}
            >
              {m.name} · {MATERIAL_LABEL[m.status] ?? m.status}
            </Badge>
          </Link>
        ) : null,
      )}
      <button
        type="button"
        aria-label={`Link materials to ${workName}`}
        onClick={() => setOpen(true)}
        className={cx('rounded p-0.5 text-muted hover:text-ink', SOFT, FOCUS)}
      >
        <Link2 aria-hidden className="h-3.5 w-3.5" />
      </button>
      {open && (
        <LinkMaterialsModal
          workId={workId}
          workName={workName}
          onClose={close}
        />
      )}
    </span>
  );
});
