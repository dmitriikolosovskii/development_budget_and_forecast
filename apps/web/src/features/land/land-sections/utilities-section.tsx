import type { ComponentType } from 'react';
import {
  CloudRain,
  Droplets,
  Flame,
  Thermometer,
  Waves,
  Wifi,
  Zap,
} from 'lucide-react';
import { formatEur } from '@default-project/budget-engine';
import {
  UTILITY_STATUSES,
  UTILITY_TYPES,
  type UtilityStatus,
  type UtilityType,
} from '@default-project/types';
import { Badge, type Tone } from '../../../ui/badge';
import { Card, SectionTitle } from '../../../ui/card';
import { SelectCell } from '../../../ui/editable-table';
import type { ProjectCache } from '../../project/project-cache';
import { useProjectSnapshot } from '../../project/use-project-snapshot';
import { IntField, TextField } from '../fields';
import { utilityCosts, type UtilityCosts } from '../land-calc';
import { blankUtility } from '../land-cache';
import { useEditUtility } from '../use-edit-utility';
import type { LandSectionProps } from './location-section';

const META: Record<
  UtilityType,
  {
    label: string;
    Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  }
> = {
  WATER: { label: 'Water', Icon: Droplets },
  SEWER: { label: 'Sewer', Icon: Waves },
  STORMWATER: { label: 'Stormwater', Icon: CloudRain },
  POWER: { label: 'Power', Icon: Zap },
  GAS: { label: 'Gas', Icon: Flame },
  TELECOM: { label: 'Telecom', Icon: Wifi },
  DISTRICT_HEATING: { label: 'District heating', Icon: Thermometer },
};

const STATUS_LABEL: Record<UtilityStatus, string> = {
  CONNECTED: 'Connected',
  AT_BOUNDARY: 'At boundary',
  IN_STREET: 'In street',
  NOT_AVAILABLE: 'Not available',
};
const STATUS_TONE: Record<UtilityStatus, Tone> = {
  CONNECTED: 'ok',
  AT_BOUNDARY: 'info',
  IN_STREET: 'warn',
  NOT_AVAILABLE: 'muted',
};
const STATUS_OPTIONS = UTILITY_STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
}));

function selectSiteDevelopmentCosts(cache: ProjectCache): UtilityCosts | null {
  const line = cache.budgetLines.find(
    (l) => l.category === 'LAND' && l.section === 'site-development',
  );
  if (!line) return null;
  return utilityCosts(
    (cache.itemIdsByLineId[line.id] ?? []).map((id) => cache.itemsById[id]),
  );
}

export function UtilitiesSection({ projectId, land }: LandSectionProps) {
  const edit = useEditUtility(projectId);
  const { data: costs = null } = useProjectSnapshot(
    projectId,
    selectSiteDevelopmentCosts,
  );
  return (
    <Card role="region" aria-label="Utilities">
      <SectionTitle
        subtitle="Connection status at the plot and planned connection cost (Utility connections & site development)"
        actions={
          costs && (
            <span className="text-sm text-muted">
              Total {formatEur(costs.totalCents)}
            </span>
          )
        }
      >
        Utilities
      </SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {UTILITY_TYPES.map((type) => {
          const u =
            land.utilities.find((x) => x.type === type) ??
            blankUtility(land.id, type);
          const { label, Icon } = META[type];
          const cost = costs?.byType[type];
          return (
            <li
              key={type}
              aria-label={label}
              className="rounded-xl border border-line bg-surface p-3 text-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Icon aria-hidden className="h-4 w-4 text-brand-500" />
                  {label}
                </span>
                <Badge tone={STATUS_TONE[u.status]}>
                  {STATUS_LABEL[u.status]}
                </Badge>
              </div>
              <dl className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Status</dt>
                  <dd className="w-36">
                    <SelectCell
                      label={`${label} status`}
                      value={u.status}
                      options={STATUS_OPTIONS}
                      onCommit={(status) => status && edit(type, { status })}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Distance</dt>
                  <dd className="w-36">
                    <IntField
                      label={`${label} distance (m)`}
                      unit="m"
                      max={100_000}
                      nullable
                      value={u.distanceM}
                      onCommit={(distanceM) => edit(type, { distanceM })}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Provider</dt>
                  <dd className="w-36">
                    <TextField
                      label={`${label} provider`}
                      nullable
                      value={u.provider}
                      onCommit={(provider) => edit(type, { provider })}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted">Connection cost</dt>
                  <dd
                    className="px-1.5 tabular-nums"
                    data-testid={`utility-cost-${type}`}
                  >
                    {cost === undefined ? '—' : formatEur(cost)}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      {costs && costs.otherCents > 0 && (
        <p className="mt-3 text-sm text-muted">
          Other site development (wall entry, temporary supply…):{' '}
          <span className="tabular-nums" data-testid="utility-cost-other">
            {formatEur(costs.otherCents)}
          </span>
        </p>
      )}
    </Card>
  );
}
