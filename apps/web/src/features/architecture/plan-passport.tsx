import { useState, type ReactNode } from 'react';
import type { ArchitecturePlan, UpdatePlanInput } from '@default-project/types';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { OrgCell, TextCell } from '../../ui/editable-table';
import { FlashValue } from '../../ui/flash-value';
import { formatAreaM2, livingAreaCm2 } from './plan-geometry';
import { usePlan } from './use-plan';
import { useEditPlan } from './use-plan-edits';

type IntKey =
  | 'storeys'
  | 'roofPitchDeg'
  | 'occupants'
  | 'footprintWidthCm'
  | 'footprintDepthCm'
  | 'siteOffsetXcm'
  | 'siteOffsetYcm';

const INT_LIMITS: Record<IntKey, [min: number, max: number]> = {
  storeys: [1, 2],
  roofPitchDeg: [0, 90],
  occupants: [0, 50],
  footprintWidthCm: [1, 100_000],
  footprintDepthCm: [1, 100_000],
  siteOffsetXcm: [-100_000, 100_000],
  siteOffsetYcm: [-100_000, 100_000],
};

/** Whole-number field: commits on Enter/blur, rejects out-of-range input with a message. */
function IntField({ label, value, field, onCommit, suffix }: { label: string; value: number; field: IntKey; onCommit: (patch: UpdatePlanInput) => void; suffix?: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [min, max] = INT_LIMITS[field];
  const commit = () => {
    if (text === null) return;
    const n = Number(text);
    if (!/^-?\d+$/.test(text.trim()) || n < min || n > max) {
      setError(`Whole number ${min}–${max}`);
      return;
    }
    setText(null);
    setError(null);
    if (n !== value) onCommit({ [field]: n });
  };
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1">
        <input
          aria-label={label}
          inputMode="numeric"
          value={text ?? String(value)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          aria-invalid={error ? true : undefined}
          className={cx('w-24 rounded-md border border-transparent px-1.5 py-0.5 text-right tabular-nums hover:border-line', error && 'border-risk-600', SOFT, FOCUS)}
        />
        {suffix && <span className="text-muted">{suffix}</span>}
      </span>
      {error && (
        <span role="alert" className="text-xs text-risk-600">
          {error}
        </span>
      )}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

type TextKey = 'name' | 'style' | 'roofType' | 'energyStandard' | 'heatingSystem';

export interface PlanPassportProps {
  projectId: string;
}

/** The house project passport; living area is always Σ rooms (AC-08.2). */
export function PlanPassport({ projectId }: PlanPassportProps) {
  const plan = usePlan(projectId).data;
  const edit = useEditPlan(projectId);
  if (!plan) return null;
  const text = (key: TextKey, label: string) => (
    <Row label={label}>
      <TextCell label={label} value={plan[key]} onCommit={(v) => edit({ [key]: v } as Partial<ArchitecturePlan>)} />
    </Row>
  );
  const int = (field: IntKey, label: string, suffix?: string) => (
    <Row label={label}>
      <IntField label={label} field={field} value={plan[field]} onCommit={edit} suffix={suffix} />
    </Row>
  );
  const living = livingAreaCm2(plan.rooms);
  const footprintCm2 = plan.footprintWidthCm * plan.footprintDepthCm;

  return (
    <dl className="grid gap-x-8 text-sm md:grid-cols-2">
      <div>
        {text('name', 'Project name')}
        <Row label="Architect">
          <OrgCell orgId={plan.architectOrgId} role="CONSULTANT" label="architect" onCommit={(architectOrgId) => edit({ architectOrgId })} />
        </Row>
        {text('style', 'Style')}
        {int('storeys', 'Storeys')}
        {text('roofType', 'Roof')}
        {int('roofPitchDeg', 'Roof pitch', '°')}
        {text('energyStandard', 'Energy standard')}
        {text('heatingSystem', 'Heating')}
      </div>
      <div>
        {int('occupants', 'Occupants')}
        <Row label="Living area (Σ rooms)">
          <span data-testid="living-area" className="font-semibold text-ink tabular-nums">
            <FlashValue value={living}>{formatAreaM2(living)}</FlashValue>
          </span>
        </Row>
        <Row label="Gross floor area">
          <span className="tabular-nums">{formatAreaM2(footprintCm2 * plan.storeys)}</span>
        </Row>
        <Row label="Footprint">
          <span className="tabular-nums">{formatAreaM2(footprintCm2)}</span>
        </Row>
        {int('footprintWidthCm', 'Footprint width', 'cm')}
        {int('footprintDepthCm', 'Footprint depth', 'cm')}
        {int('siteOffsetXcm', 'Distance to left boundary', 'cm')}
        {int('siteOffsetYcm', 'Distance to street', 'cm')}
      </div>
    </dl>
  );
}
