import { useNavigate } from 'react-router-dom';
import { formatBps, formatEurWhole } from '@default-project/budget-engine';
import { Card, EmptyState, SectionTitle } from '../../ui';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { lineHref } from '../project/budget-health-panel';
import { CATEGORY_LABELS, type OverrunRow } from './profitability-data';

export interface TopOverrunsTableProps {
  projectId: string;
  rows: OverrunRow[];
  limit?: number;
}

/** Lines whose forecast exceeds the approved budget; a click opens the line's tab/section. */
export function TopOverrunsTable({
  projectId,
  rows,
  limit = 8,
}: TopOverrunsTableProps) {
  const navigate = useNavigate();
  return (
    <Card>
      <SectionTitle subtitle="Forecast above the approved budget, largest first">
        Top overruns
      </SectionTitle>
      {rows.length === 0 ? (
        <EmptyState title="No lines over budget" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Line</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Approved</th>
                <th className="px-3 py-2 text-right font-medium">Forecast</th>
                <th className="px-3 py-2 text-right font-medium">Overrun</th>
                <th className="px-3 py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r) => {
                const href = lineHref(projectId, r.category, r.section);
                return (
                  <tr
                    key={r.lineId}
                    onClick={() => navigate(href)}
                    className={cx(
                      'cursor-pointer border-t border-line hover:bg-subtle',
                      SOFT,
                    )}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(href);
                        }}
                        className={cx(
                          'text-left font-medium text-brand-600 hover:underline',
                          FOCUS,
                        )}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {CATEGORY_LABELS[r.category]}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEurWhole(r.approved)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEurWhole(r.forecast)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-risk-600 tabular-nums">
                      +{formatEurWhole(r.overrunCents)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.overrunBps === null ? '—' : formatBps(r.overrunBps)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
