import { ExternalLink } from 'lucide-react';
import { Card, SectionTitle } from '../../../ui/card';
import { CoordinateField, FieldRow, TextField } from '../fields';
import { hasCoordinates, osmUrl } from '../land-calc';
import type { CachedLand } from '../land-cache';
import { PlotDiagram } from '../plot-diagram';
import { useEditLand } from '../use-edit-land';

export interface LandSectionProps {
  projectId: string;
  land: CachedLand;
}

export function LocationSection({ projectId, land }: LandSectionProps) {
  const edit = useEditLand(projectId);
  const located = hasCoordinates(land.lat, land.lng);
  return (
    <Card role="region" aria-label="Location">
      <SectionTitle
        subtitle="Address, municipality and cadastral reference"
        actions={
          located ? (
            <a
              href={osmUrl(land.lat, land.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              Open in OpenStreetMap{' '}
              <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="text-sm text-muted">
              Set coordinates to open the map
            </span>
          )
        }
      >
        Location
      </SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <dl>
          <FieldRow label="Address">
            <TextField
              label="Address"
              value={land.address}
              onCommit={(v) => v && edit({ address: v })}
            />
          </FieldRow>
          <FieldRow label="Postcode">
            <TextField
              label="Postcode"
              value={land.postalCode}
              onCommit={(v) => v && edit({ postalCode: v })}
            />
          </FieldRow>
          <FieldRow label="Municipality">
            <TextField
              label="Municipality"
              value={land.municipality}
              onCommit={(v) => v && edit({ municipality: v })}
            />
          </FieldRow>
          <FieldRow label="District">
            <TextField
              label="District"
              value={land.district}
              nullable
              onCommit={(v) => edit({ district: v })}
            />
          </FieldRow>
          <FieldRow label="State (Bundesland)">
            <TextField
              label="State"
              value={land.state}
              onCommit={(v) => v && edit({ state: v })}
            />
          </FieldRow>
          <FieldRow label="Cadastral reference">
            <TextField
              label="Cadastral reference"
              value={land.cadastralRef}
              nullable
              onCommit={(v) => edit({ cadastralRef: v })}
            />
          </FieldRow>
          <FieldRow label="Latitude">
            <CoordinateField
              label="Latitude"
              value={land.lat}
              limit={90}
              onCommit={(lat) => edit({ lat })}
            />
          </FieldRow>
          <FieldRow label="Longitude">
            <CoordinateField
              label="Longitude"
              value={land.lng}
              limit={180}
              onCommit={(lng) => edit({ lng })}
            />
          </FieldRow>
        </dl>
        <PlotDiagram projectId={projectId} land={land} />
      </div>
    </Card>
  );
}
