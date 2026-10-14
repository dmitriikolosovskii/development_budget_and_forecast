import { formatEur } from '@default-project/budget-engine';
import type { Summary } from '@default-project/types';
import { cx } from '../../ui/cx';
import { FlashValue } from '../../ui/flash-value';
import { MoneyCell } from '../../ui/editable-table';
import { useEditBudgetLine } from '../project/use-edit-budget-line';

/** Table footer cells by column id: the section totals from the engine (never re-rounded). */
export function sectionTotals(s: Summary | undefined) {
  if (!s) return undefined;
  const money = (cents: number) => <FlashValue value={cents}>{formatEur(cents)}</FlashValue>;
  return {
    item: 'Section total',
    planned: <span data-testid="section-planned">{money(s.planned)}</span>,
    committed: money(s.committed),
    actual: money(s.actual),
  };
}

export interface SectionBudgetProps {
  projectId: string;
  lineId: string;
  summary: Summary | undefined;
}

/** Forecast vs the line's approved budget; the approved amount is editable (autosaved). */
export function SectionBudget({ projectId, lineId, summary }: SectionBudgetProps) {
  const editLine = useEditBudgetLine(projectId);
  if (!summary) return null;
  return (
    <dl aria-label="Section budget" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-subtle px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <dt className="text-muted">Forecast (EAC)</dt>
        <dd className="font-semibold tabular-nums">
          <FlashValue value={summary.forecast}>{formatEur(summary.forecast)}</FlashValue>
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="text-muted">Approved</dt>
        <dd className="font-semibold">
          <MoneyCell cents={summary.approved} label="approved budget" onCommit={(approvedCents) => editLine(lineId, { approvedCents })} />
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="text-muted">Variance</dt>
        <dd data-testid="section-variance" className={cx('font-semibold tabular-nums', summary.variance < 0 ? 'text-risk-600' : 'text-ok-600')}>
          <FlashValue value={summary.variance}>{formatEur(summary.variance)}</FlashValue>
        </dd>
      </div>
    </dl>
  );
}
