import { Link } from 'react-router-dom';
import { formatEur } from '@default-project/budget-engine';
import { Card, SectionTitle } from '../../ui/card';
import { cx, FOCUS } from '../../ui/cx';
import { Skeleton } from '../../ui/skeleton';
import { lineHref } from '../project/budget-health-panel';
import { useProjectSummary } from '../project/use-project-summary';
import { contingencyUsage } from './construction-model';

export interface ContingencyPanelProps {
  projectId: string;
  lineId: string | undefined;
}

/** The `contingency` line has no rows: its reserve and how much of it the overruns of other lines use up. */
export function ContingencyPanel({ projectId, lineId }: ContingencyPanelProps) {
  const rollup = useProjectSummary(projectId);
  if (!rollup) {
    return (
      <Card>
        <Skeleton lines={4} />
      </Card>
    );
  }
  const usage = contingencyUsage(rollup, lineId);
  const overruns = rollup.overrunLines.filter((l) => l.lineId !== lineId);
  const tiles = [
    { label: 'Reserve (approved)', value: usage.reserve, tone: 'text-ink' },
    {
      label: 'Used by overruns',
      value: usage.used,
      tone: usage.used > 0 ? 'text-risk-600' : 'text-ink',
    },
    {
      label: 'Remaining',
      value: usage.remaining,
      tone: usage.remaining < 0 ? 'text-risk-600' : 'text-ok-600',
    },
  ];
  return (
    <Card className="animate-fade-in">
      <SectionTitle subtitle="A reserve line with no items. Overruns of the other lines draw on it.">
        Contingency reserve
      </SectionTitle>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-subtle p-3">
            <dt className="text-xs text-muted">{t.label}</dt>
            <dd className={cx('text-lg font-semibold tabular-nums', t.tone)}>
              {formatEur(t.value)}
            </dd>
          </div>
        ))}
      </dl>
      {overruns.length > 0 && (
        <ul
          aria-label="Overruns using the reserve"
          className="mt-4 space-y-1 text-sm"
        >
          {overruns.map((l) => (
            <li key={l.lineId} className="flex justify-between gap-2">
              <Link
                to={lineHref(projectId, l.category, l.section)}
                className={cx('text-brand-600 hover:underline', FOCUS)}
              >
                {l.name}
              </Link>
              <span className="tabular-nums text-risk-600">
                {formatEur(l.overrunCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
