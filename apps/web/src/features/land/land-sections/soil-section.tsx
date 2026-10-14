import { Badge } from '../../../ui/badge';
import { Card, SectionTitle } from '../../../ui/card';
import { FieldRow, IntField, TextField } from '../fields';
import { soilRisk } from '../land-calc';
import { useEditLand } from '../use-edit-land';
import type { LandSectionProps } from './location-section';

export function SoilSection({ projectId, land }: LandSectionProps) {
  const edit = useEditLand(projectId);
  const risk = soilRisk(land);
  return (
    <Card role="region" aria-label="Soil">
      <SectionTitle
        subtitle="Ground conditions from the soil report"
        actions={
          risk.risk ? (
            <Badge tone="warn" title={risk.reasons.join('; ')}>
              Soil risk
            </Badge>
          ) : (
            <Badge tone="ok">Soil OK</Badge>
          )
        }
      >
        Soil
      </SectionTitle>
      {risk.risk && (
        <ul className="mb-2 list-disc pl-5 text-sm text-warn-600">
          {risk.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <dl>
        <FieldRow label="Soil type">
          <TextField
            label="Soil type"
            value={land.soilType}
            onCommit={(v) => v && edit({ soilType: v })}
          />
        </FieldRow>
        <FieldRow
          label="Soil class"
          hint="DIN 18300 class first, e.g. “4 (medium-hard)”"
        >
          <TextField
            label="Soil class"
            value={land.soilClass}
            onCommit={(v) => v && edit({ soilClass: v })}
          />
        </FieldRow>
        <FieldRow label="Bearing capacity">
          <IntField
            label="Bearing capacity (kN/m²)"
            unit="kN/m²"
            max={100_000}
            nullable
            value={land.bearingCapacityKnM2}
            onCommit={(bearingCapacityKnM2) => edit({ bearingCapacityKnM2 })}
          />
        </FieldRow>
        <FieldRow
          label="Groundwater depth"
          hint="below ground; < 2 m is a risk"
        >
          <IntField
            label="Groundwater depth (cm)"
            unit="cm"
            max={100_000}
            nullable
            value={land.groundwaterDepthCm}
            onCommit={(groundwaterDepthCm) => edit({ groundwaterDepthCm })}
          />
        </FieldRow>
        <FieldRow label="Contamination">
          <TextField
            label="Contamination"
            nullable
            value={land.contaminationNotes}
            onCommit={(contaminationNotes) => edit({ contaminationNotes })}
          />
        </FieldRow>
        <FieldRow label="Notes">
          <TextField
            label="Soil notes"
            nullable
            value={land.notes}
            onCommit={(notes) => edit({ notes })}
          />
        </FieldRow>
      </dl>
    </Card>
  );
}
