import { formatEurWhole } from '@default-project/budget-engine';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { cx } from '../../ui/cx';
import { FlashValue } from '../../ui/flash-value';
import { Skeleton } from '../../ui/skeleton';
import { useProjectSummary } from '../project/use-project-summary';

/** The CFO's five answers across every MATERIALS line (top of the tab). */
export function MaterialsOverview({ projectId }: { projectId: string }) {
  const rollup = useProjectSummary(projectId);
  if (!rollup) {
    return (
      <Card>
        <Skeleton lines={2} />
      </Card>
    );
  }
  const s = rollup.byCategory.MATERIALS;
  const overruns = rollup.overrunLines.filter((l) => l.category === 'MATERIALS').length;
  const stats: Array<[string, number]> = [
    ['Approved', s.approved],
    ['Spent', s.actual],
    ['Costs & obligations', s.exposure],
    ['Forecast (EAC)', s.forecast],
    ['Variance', s.variance],
  ];
  return (
    <Card aria-label="Building materials summary" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Building materials · all sections</h2>
        <Badge tone={overruns > 0 ? 'risk' : 'ok'}>
          {overruns > 0 ? `${overruns} ${overruns === 1 ? 'line' : 'lines'} over budget` : 'Within budget'}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd
              className={cx(
                'text-base font-semibold tabular-nums',
                label === 'Variance' && (value < 0 ? 'text-risk-600' : 'text-ok-600'),
              )}
            >
              <FlashValue value={value}>{formatEurWhole(value)}</FlashValue>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
