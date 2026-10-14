import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  formatBps,
  formatEurWhole,
  toBps,
} from '@default-project/budget-engine';
import { Badge } from '../../ui/badge';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import type { AnalyticsProject } from './analytics-schema';

type SortKey =
  | 'name'
  | 'status'
  | 'complete'
  | 'variance'
  | 'profit'
  | 'margin'
  | 'overruns';

const COLUMNS: Array<{
  key: SortKey;
  label: string;
  numeric?: boolean;
  value: (p: AnalyticsProject) => number | string;
}> = [
  { key: 'name', label: 'Project', value: (p) => p.name },
  { key: 'status', label: 'Status', value: (p) => p.status },
  {
    key: 'complete',
    label: '% complete',
    numeric: true,
    value: (p) => toBps(p.summary.actual, p.summary.forecast),
  },
  {
    key: 'variance',
    label: 'Variance',
    numeric: true,
    value: (p) => p.summary.variance,
  },
  {
    key: 'profit',
    label: 'Forecast profit',
    numeric: true,
    value: (p) => p.profitability.forecastProfit,
  },
  {
    key: 'margin',
    label: 'Margin',
    numeric: true,
    value: (p) => p.profitability.marginBps,
  },
  {
    key: 'overruns',
    label: 'Overrun lines',
    numeric: true,
    value: (p) => p.overrunLineCount,
  },
];

const projectHref = (p: AnalyticsProject) =>
  `/projects/${encodeURIComponent(p.projectId)}/profitability`;

export interface ProjectsTableProps {
  projects: readonly AnalyticsProject[];
}

/** Portfolio projects, sortable by any column; a row click opens the project's Profitability tab. */
export function ProjectsTable({ projects }: ProjectsTableProps) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{
    key: SortKey;
    dir: 'asc' | 'desc';
  } | null>(null);

  const rows = useMemo(() => {
    if (!sort) return projects;
    const col = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[0];
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...projects].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sign * cmp || a.name.localeCompare(b.name);
    });
  }, [projects, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Projects</caption>
        <thead className="bg-subtle text-left text-xs text-muted">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sort?.key === c.key
                    ? sort.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                className={cx(
                  'px-3 py-2 font-medium',
                  c.numeric && 'text-right',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={cx('rounded hover:text-ink', SOFT, FOCUS)}
                >
                  {c.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.projectId}
              onClick={() => navigate(projectHref(p))}
              className={cx(
                'cursor-pointer border-t border-line hover:bg-subtle',
                SOFT,
              )}
            >
              <td className="px-3 py-2">
                <Link
                  to={projectHref(p)}
                  onClick={(e) => e.stopPropagation()}
                  className={cx(
                    'font-medium text-ink hover:text-brand-600',
                    FOCUS,
                  )}
                >
                  {p.name}
                </Link>
                <div className="text-xs text-muted">{p.city}</div>
              </td>
              <td className="px-3 py-2">
                <Badge
                  tone={
                    p.status === 'COMPLETED'
                      ? 'ok'
                      : p.status === 'ACTIVE'
                        ? 'brand'
                        : 'muted'
                  }
                >
                  {p.status.toLowerCase()}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatBps(toBps(p.summary.actual, p.summary.forecast))}
              </td>
              <td
                className={cx(
                  'px-3 py-2 text-right tabular-nums',
                  p.summary.variance < 0 ? 'text-risk-600' : 'text-ok-600',
                )}
              >
                {formatEurWhole(p.summary.variance)}
              </td>
              <td
                className={cx(
                  'px-3 py-2 text-right tabular-nums',
                  p.profitability.forecastProfit < 0 && 'text-risk-600',
                )}
              >
                {formatEurWhole(p.profitability.forecastProfit)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatBps(p.profitability.marginBps)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {p.overrunLineCount > 0 ? (
                  <Badge tone="risk">{p.overrunLineCount}</Badge>
                ) : (
                  '0'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
