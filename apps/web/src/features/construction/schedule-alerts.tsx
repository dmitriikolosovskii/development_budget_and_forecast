import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { lineHref } from '../project/budget-health-panel';
import { formatDayMonth, type ScheduleAlert } from './construction-model';

export interface ScheduleAlertsProps {
  projectId: string;
  alerts: ScheduleAlert[];
  onShift: (workId: string, newStart: string) => void;
}

/** The project's schedule conflicts (local AlertBanner: the kit has none). */
export function ScheduleAlerts({
  projectId,
  alerts,
  onShift,
}: ScheduleAlertsProps) {
  if (alerts.length === 0) return null;
  return (
    <section
      role="alert"
      aria-label="Schedule conflicts"
      className="animate-fade-in rounded-[var(--radius-card)] border border-risk-600/30 bg-risk-50 p-4"
    >
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-risk-600">
        <AlertTriangle aria-hidden className="h-4 w-4" />
        {alerts.length} schedule{' '}
        {alerts.length === 1 ? 'conflict' : 'conflicts'}
      </h2>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li
            key={a.key}
            className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink"
          >
            <span>{a.text}</span>
            <span className="flex flex-wrap gap-1">
              {a.kind === 'LATE' && a.materialSection && (
                <Link
                  to={`${lineHref(projectId, 'MATERIALS', a.materialSection)}?highlight=${encodeURIComponent(a.materialId)}`}
                  className={cx(
                    'rounded-lg px-2 py-1 text-brand-600 hover:bg-surface',
                    SOFT,
                    FOCUS,
                  )}
                >
                  Open material
                </Link>
              )}
              {a.kind === 'LATE' && a.shiftTo && (
                <button
                  type="button"
                  onClick={() => a.shiftTo && onShift(a.workId, a.shiftTo)}
                  className={cx(
                    'rounded-lg bg-surface px-2 py-1 text-risk-600 hover:bg-risk-600 hover:text-white',
                    SOFT,
                    FOCUS,
                  )}
                >
                  Shift work start to {formatDayMonth(a.shiftTo)}
                </button>
              )}
              {a.kind === 'INVALID' && a.workSection && (
                <Link
                  to={`${lineHref(projectId, 'CONSTRUCTION', a.workSection)}?highlight=${encodeURIComponent(a.workId)}`}
                  className={cx(
                    'rounded-lg px-2 py-1 text-brand-600 hover:bg-surface',
                    SOFT,
                    FOCUS,
                  )}
                >
                  Open work
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
