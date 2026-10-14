import { useParams } from 'react-router-dom';
import { formatBps, formatEurWhole } from '@default-project/budget-engine';
import { ErrorState, Skeleton } from '../../ui';
import { useEditProject } from '../project/use-edit-project';
import { AssumptionsCard } from './assumptions-card';
import {
  BudgetVsForecastChart,
  CashflowSCurve,
  CostStructureDonut,
  WaterfallChart,
} from './charts';
import { HeroCards } from './hero-cards';
import {
  categoryRows,
  costSlices,
  overrunRows,
  waterfallData,
} from './profitability-data';
import { TopOverrunsTable } from './top-overruns-table';
import { useProfitability } from './use-profitability';

export function ProfitabilityPage() {
  const { projectId = '' } = useParams();
  const { query, today, markupBps, rollup, cashflow, profitability } =
    useProfitability(projectId);
  const editProject = useEditProject(projectId);

  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (!rollup || !cashflow || !profitability || markupBps === undefined) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const unscheduled = cashflow.unscheduled.forecast;
  return (
    <div className="flex animate-fade-in flex-col gap-4">
      <HeroCards
        summary={rollup.project}
        profitability={profitability}
        markupBps={markupBps}
        onMarkupChange={(bps) => editProject({ markupBps: bps })}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BudgetVsForecastChart rows={categoryRows(rollup)} />
        <WaterfallChart
          steps={waterfallData(rollup, profitability)}
          subtitle={`Markup ${formatBps(markupBps)} on approved = ${formatEurWhole(profitability.plannedProfit)} planned profit`}
        />
        <CostStructureDonut slices={costSlices(rollup)} />
        <CashflowSCurve
          months={cashflow.months}
          todayMonth={today.slice(0, 7)}
          subtitle={
            unscheduled > 0
              ? `${formatEurWhole(unscheduled)} forecast is unscheduled (no dates)`
              : undefined
          }
        />
      </div>
      <TopOverrunsTable projectId={projectId} rows={overrunRows(rollup)} />
      <AssumptionsCard />
    </div>
  );
}
