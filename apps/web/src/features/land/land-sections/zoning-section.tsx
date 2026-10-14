import { Badge } from '../../../ui/badge';
import { Card, SectionTitle } from '../../../ui/card';
import type { ProjectCache } from '../../project/project-cache';
import { useProjectSnapshot } from '../../project/use-project-snapshot';
import { FieldRow, IntField, PercentField, TextField } from '../fields';
import {
  allowedFootprintCm2,
  footprintStatus,
  formatCm2AsM2,
  houseFootprintCm2,
  maxGrossFloorAreaCm2,
} from '../land-calc';
import { useEditLand } from '../use-edit-land';
import type { LandSectionProps } from './location-section';

interface PlanFacts {
  footprintCm2: number | null;
  storeys: number;
}

// Returns primitives only, so TanStack's structural sharing keeps re-renders to real changes.
function selectPlanFacts(cache: ProjectCache): PlanFacts | null {
  return cache.plan
    ? {
        footprintCm2: houseFootprintCm2(cache.plan),
        storeys: cache.plan.storeys,
      }
    : null;
}

export function ZoningSection({ projectId, land }: LandSectionProps) {
  const edit = useEditLand(projectId);
  const { data: plan = null } = useProjectSnapshot(projectId, selectPlanFacts);
  const allowed = allowedFootprintCm2(land.areaM2, land.grzBps);
  const actual = plan?.footprintCm2 ?? null;
  const status = footprintStatus(allowed, actual);
  const maxGfa = maxGrossFloorAreaCm2(land.areaM2, land.gfzBps);
  const storeysOk =
    plan && land.maxStoreys > 0 ? plan.storeys <= land.maxStoreys : null;

  return (
    <Card role="region" aria-label="Zoning">
      <SectionTitle
        subtitle="Development plan (B-Plan): coverage, floor area, storeys, roof"
        actions={
          status === 'WITHIN' ? (
            <Badge tone="ok">Within limit</Badge>
          ) : status === 'EXCEEDS' ? (
            <Badge tone="risk">Exceeds limit</Badge>
          ) : (
            <Badge tone="muted">Coverage not checked</Badge>
          )
        }
      >
        Zoning
      </SectionTitle>
      <dl>
        <FieldRow label="Development plan (B-Plan)">
          <TextField
            label="Development plan"
            value={land.zoningPlan}
            onCommit={(v) => v && edit({ zoningPlan: v })}
          />
        </FieldRow>
        <FieldRow label="Site coverage ratio (GRZ)">
          <PercentField
            label="GRZ (%)"
            max={10_000}
            value={land.grzBps}
            onCommit={(grzBps) => edit({ grzBps })}
          />
        </FieldRow>
        <FieldRow label="Floor area ratio (GFZ)">
          <PercentField
            label="GFZ (%)"
            max={50_000}
            value={land.gfzBps}
            onCommit={(gfzBps) => edit({ gfzBps })}
          />
        </FieldRow>
        <FieldRow label="Allowed footprint" hint="area × GRZ">
          <span
            className="px-1.5 font-medium tabular-nums"
            data-testid="allowed-footprint"
          >
            {allowed === null ? (
              <span className="text-muted">not set</span>
            ) : (
              formatCm2AsM2(allowed)
            )}
          </span>
        </FieldRow>
        <FieldRow label="House footprint" hint="from the Architecture plan">
          <span className="px-1.5 tabular-nums" data-testid="house-footprint">
            {actual === null ? (
              <span className="text-muted">no plan</span>
            ) : (
              formatCm2AsM2(actual)
            )}
          </span>
        </FieldRow>
        <FieldRow label="Max gross floor area" hint="area × GFZ">
          <span className="px-1.5 tabular-nums">
            {maxGfa === null ? (
              <span className="text-muted">not set</span>
            ) : (
              formatCm2AsM2(maxGfa)
            )}
          </span>
        </FieldRow>
        <FieldRow label="Max full storeys">
          <span className="flex items-center gap-2">
            <IntField
              label="Max storeys"
              unit="storeys"
              max={20}
              zeroIsUnset
              value={land.maxStoreys}
              onCommit={(v) => v !== null && edit({ maxStoreys: v })}
            />
            {storeysOk === false && (
              <Badge tone="risk">Plan has {plan?.storeys}</Badge>
            )}
          </span>
        </FieldRow>
        <FieldRow label="Roof rules">
          <TextField
            label="Roof rules"
            value={land.roofRules}
            onCommit={(v) => v && edit({ roofRules: v })}
          />
        </FieldRow>
        <FieldRow label="Building lines">
          <TextField
            label="Building lines"
            nullable
            value={land.buildingLineNotes}
            onCommit={(buildingLineNotes) => edit({ buildingLineNotes })}
          />
        </FieldRow>
      </dl>
    </Card>
  );
}
