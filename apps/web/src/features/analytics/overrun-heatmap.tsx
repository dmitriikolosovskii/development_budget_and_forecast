import {
  formatBps,
  formatEurWhole,
  toBps,
} from '@default-project/budget-engine';
import {
  COST_CATEGORIES,
  type CostCategory,
  type Summary,
} from '@default-project/types';
import { TONE_CLASSES } from '../../ui/badge';
import { cx } from '../../ui/cx';
import type { AnalyticsProject } from './analytics-schema';

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  LAND: 'Land',
  ARCHITECTURE: 'Architecture',
  MATERIALS: 'Materials',
  CONSTRUCTION: 'Construction',
  MARKETING: 'Marketing',
};

/** Tone of a heatmap cell: an overrun (variance < 0) is red, within budget (≥ 0) is green, an empty category is muted. */
export function heatTone(
  s: Pick<Summary, 'approved' | 'forecast' | 'variance'>,
): 'risk' | 'ok' | 'muted' {
  if (s.approved === 0 && s.forecast === 0) return 'muted';
  return s.variance < 0 ? 'risk' : 'ok';
}

function cellLabel(s: Summary): string {
  if (s.approved === 0)
    return s.forecast === 0 ? '—' : formatEurWhole(s.variance);
  return formatBps(toBps(s.variance, s.approved));
}

export interface OverrunHeatmapProps {
  projects: readonly AnalyticsProject[];
}

/** Project × category, cell = variance % of the approved budget (negative = overrun). */
export function OverrunHeatmap({ projects }: OverrunHeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">
          Overrun heatmap: variance by project and category
        </caption>
        <thead className="text-left text-xs text-muted">
          <tr>
            <th scope="col" className="px-2 py-1 font-medium">
              Project
            </th>
            {COST_CATEGORIES.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-2 py-1 text-center font-medium"
              >
                {CATEGORY_LABELS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.projectId}>
              <th
                scope="row"
                className="px-2 py-1 text-left font-medium text-ink"
              >
                {p.name}
              </th>
              {COST_CATEGORIES.map((c) => {
                const s = p.byCategory[c];
                const tone = heatTone(s);
                return (
                  <td key={c} className="p-1">
                    <div
                      data-tone={tone}
                      title={`${p.name} · ${CATEGORY_LABELS[c]}: variance ${formatEurWhole(s.variance)}`}
                      className={cx(
                        'rounded-lg px-2 py-2 text-center tabular-nums transition-colors duration-200',
                        TONE_CLASSES[tone],
                      )}
                    >
                      {cellLabel(s)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
