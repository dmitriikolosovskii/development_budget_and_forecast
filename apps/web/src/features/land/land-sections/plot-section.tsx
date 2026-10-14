import { formatEur } from '@default-project/budget-engine';
import { Badge } from '../../../ui/badge';
import { Card, SectionTitle } from '../../../ui/card';
import type { ProjectCache } from '../../project/project-cache';
import { useProjectSnapshot } from '../../project/use-project-snapshot';
import {
  FieldRow,
  IntField,
  MetresField,
  MoneyField,
  TextField,
} from '../fields';
import { plannedTotalCents, plotPriceCents } from '../land-calc';
import { useEditLand } from '../use-edit-land';
import type { LandSectionProps } from './location-section';

/** Σ planned of the LAND `purchase` line (`null` when the project has no such line). */
function selectPurchasePlanned(cache: ProjectCache): number | null {
  const line = cache.budgetLines.find(
    (l) => l.category === 'LAND' && l.section === 'purchase',
  );
  if (!line) return null;
  return plannedTotalCents(
    (cache.itemIdsByLineId[line.id] ?? []).map((id) => cache.itemsById[id]),
  );
}

export function PlotSection({ projectId, land }: LandSectionProps) {
  const edit = useEditLand(projectId);
  const { data: purchasePlanned = null } = useProjectSnapshot(
    projectId,
    selectPurchasePlanned,
  );
  const price = plotPriceCents(land.areaM2, land.landValuePerM2Cents);
  const diff =
    price !== null && purchasePlanned !== null ? purchasePlanned - price : null;
  return (
    <Card role="region" aria-label="Plot">
      <SectionTitle subtitle="Area, dimensions and land value (Bodenrichtwert)">
        Plot
      </SectionTitle>
      <dl>
        <FieldRow label="Area">
          <IntField
            label="Area (m²)"
            unit="m²"
            max={1_000_000}
            zeroIsUnset
            value={land.areaM2}
            onCommit={(v) => v !== null && edit({ areaM2: v })}
          />
        </FieldRow>
        <FieldRow label="Width (street side)">
          <MetresField
            label="Plot width (m)"
            max={1_000_000}
            value={land.plotWidthCm}
            onCommit={(plotWidthCm) => edit({ plotWidthCm })}
          />
        </FieldRow>
        <FieldRow label="Depth">
          <MetresField
            label="Plot depth (m)"
            max={1_000_000}
            value={land.plotDepthCm}
            onCommit={(plotDepthCm) => edit({ plotDepthCm })}
          />
        </FieldRow>
        <FieldRow
          label="Land value per m²"
          hint="Bodenrichtwert / purchase price per m²"
        >
          <MoneyField
            label="Land value per m²"
            max={100_000_000}
            value={land.landValuePerM2Cents}
            onCommit={(landValuePerM2Cents) => edit({ landValuePerM2Cents })}
          />
        </FieldRow>
        <FieldRow label="Plot price" hint="area × land value per m²">
          <span
            className="px-1.5 font-medium tabular-nums"
            data-testid="plot-price"
          >
            {price === null ? (
              <span className="text-muted">not set</span>
            ) : (
              formatEur(price)
            )}
          </span>
        </FieldRow>
        <FieldRow
          label="Land purchase (budget)"
          hint="planned rows of “Land purchase”"
        >
          <span className="flex flex-wrap items-center gap-2 px-1.5 tabular-nums">
            <span data-testid="purchase-planned">
              {purchasePlanned === null ? '—' : formatEur(purchasePlanned)}
            </span>
            {diff !== null && diff !== 0 && (
              <Badge tone={diff > 0 ? 'warn' : 'info'}>
                {diff > 0
                  ? `${formatEur(diff)} above plot price`
                  : `${formatEur(-diff)} below plot price`}
              </Badge>
            )}
            {diff === 0 && <Badge tone="ok">Matches plot price</Badge>}
          </span>
        </FieldRow>
        <FieldRow label="Orientation">
          <TextField
            label="Orientation"
            nullable
            value={land.orientation}
            onCommit={(orientation) => edit({ orientation })}
          />
        </FieldRow>
        <FieldRow label="Slope">
          <TextField
            label="Slope"
            nullable
            value={land.slopeNotes}
            onCommit={(slopeNotes) => edit({ slopeNotes })}
          />
        </FieldRow>
      </dl>
    </Card>
  );
}
