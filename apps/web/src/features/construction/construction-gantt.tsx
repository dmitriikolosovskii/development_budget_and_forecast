import { formatDate } from '@default-project/budget-engine';
import { Card, SectionTitle } from '../../ui/card';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/states';
import { useIsMobile } from '../../lib/use-media-query';
import {
  positionPct,
  spanPct,
  type GanttModel,
  type GanttWork,
} from './construction-model';

export interface ConstructionGanttProps {
  model: GanttModel;
  today: string;
}

const BAR_TONE: Record<string, string> = {
  READY: 'bg-brand-500/70',
  BLOCKED: 'bg-risk-600/70',
  INVALID_DATES: 'bg-warn-600/70',
};

function markerTitle(m: GanttWork['markers'][number]): string {
  return `${m.name} (${m.code}): ${formatDate(m.date)}${m.late ? ' — late for work' : ''}`;
}

/** Mini Gantt: a bar per work item, ◆ per linked material delivery, a Today line. A list on mobile. */
export function ConstructionGantt({ model, today }: ConstructionGanttProps) {
  const isMobile = useIsMobile();
  const { range } = model;

  return (
    <Card>
      <SectionTitle subtitle="Bars are work items; ◆ are material deliveries (red = arrives after the work starts).">
        Schedule
      </SectionTitle>
      {!range ? (
        <EmptyState title="No dated work items yet." />
      ) : isMobile ? (
        <ul aria-label="Schedule" className="space-y-3 text-sm">
          {model.groups.map((g) => (
            <li key={g.section}>
              <p className="font-medium text-ink">{g.name}</p>
              <ul className="mt-1 space-y-1">
                {g.works.map((w) => (
                  <li key={w.id} data-testid="gantt-bar" className="text-muted">
                    <span className="text-ink">{w.name}</span>{' '}
                    {w.startDate && w.endDate
                      ? `${formatDate(w.startDate)} – ${formatDate(w.endDate)}`
                      : 'no dates'}
                    {w.markers.map((m) => (
                      <span
                        key={m.id}
                        data-testid="gantt-marker"
                        title={markerTitle(m)}
                        className={cx(
                          'ml-2',
                          m.late ? 'text-risk-600' : 'text-muted',
                        )}
                      >
                        ◆ {m.name}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <div className="relative min-w-[640px]">
            <div className="mb-1 flex justify-between pl-48 text-xs text-muted">
              <span>{formatDate(range.start)}</span>
              <span>{formatDate(range.end)}</span>
            </div>
            <div className="relative">
              {model.groups.map((g) => (
                <div
                  key={g.section}
                  role="group"
                  aria-label={g.name}
                  className="border-t border-line py-1"
                >
                  <p className="py-0.5 text-xs font-semibold tracking-wide text-muted uppercase">
                    {g.name}
                  </p>
                  {g.works.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center gap-2 py-0.5 text-xs"
                    >
                      <span
                        className="w-46 shrink-0 truncate text-ink"
                        title={`${w.code} ${w.name}`}
                      >
                        {w.name}
                      </span>
                      <div className="relative h-5 flex-1 rounded bg-subtle/60">
                        {w.startDate &&
                          w.endDate &&
                          w.endDate >= w.startDate && (
                            <div
                              data-testid="gantt-bar"
                              title={`${w.name}: ${formatDate(w.startDate)} – ${formatDate(w.endDate)}`}
                              className={cx(
                                'absolute inset-y-1 rounded transition-all duration-300 ease-[var(--ease-soft)]',
                                BAR_TONE[w.status ?? 'READY'],
                              )}
                              style={{
                                left: `${positionPct(range, w.startDate)}%`,
                                width: `${spanPct(range, w.startDate, w.endDate)}%`,
                              }}
                            />
                          )}
                        {(!w.startDate ||
                          !w.endDate ||
                          w.endDate < w.startDate) && (
                          <span
                            data-testid="gantt-bar"
                            className="absolute inset-y-0 left-1 text-warn-600"
                          >
                            {w.status === 'INVALID_DATES'
                              ? 'Invalid dates'
                              : 'No dates'}
                          </span>
                        )}
                        {w.markers.map((m) => (
                          <span
                            key={m.id}
                            data-testid="gantt-marker"
                            data-late={m.late || undefined}
                            title={markerTitle(m)}
                            aria-label={markerTitle(m)}
                            className={cx(
                              'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm leading-none',
                              m.late ? 'text-risk-600' : 'text-ink/60',
                            )}
                            style={{ left: `${positionPct(range, m.date)}%` }}
                          >
                            ◆
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 left-48"
              >
                <div
                  data-testid="gantt-today"
                  title={`Today ${formatDate(today)}`}
                  className="absolute inset-y-0 w-px bg-brand-600"
                  style={{ left: `${positionPct(range, today)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
