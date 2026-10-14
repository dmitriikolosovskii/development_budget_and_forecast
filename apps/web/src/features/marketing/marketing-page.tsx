import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  computeProfitability,
  formatEur,
} from '@default-project/budget-engine';
import { BUDGET_CATALOG, type CostItem } from '@default-project/types';
import { useUiStore } from '../../lib/ui-store';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { EditableTable } from '../../ui/editable-table';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import { SubNav } from '../../ui/sub-nav';
import { BudgetHealthPanel } from '../project/budget-health-panel';
import type { ProjectCache } from '../project/project-cache';
import { useBudgetLines } from '../project/use-budget-lines';
import { useEditItem } from '../project/use-edit-item';
import { useItem } from '../project/use-item';
import { useItemIds } from '../project/use-item-ids';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { useProjectSummary } from '../project/use-project-summary';
import { useToday } from '../project/use-today';
import { CHANNELS } from './channels';
import { MARKETING_COLUMNS } from './marketing-columns';
import {
  channelMix,
  marketingCalendar,
  marketingShare,
} from './marketing-model';
import {
  MarketingCalendar,
  MarketingMix,
  MarketingShareCard,
  MIX_COLORS,
} from './marketing-overview';

/** Stable colour per section, by catalogue order (CONTRACTS §4). */
const COLOR_BY_SECTION: Record<string, string> = Object.fromEntries(
  BUDGET_CATALOG.filter((c) => c.category === 'MARKETING').map((c, i) => [
    c.section,
    MIX_COLORS[i % MIX_COLORS.length],
  ]),
);

type MarketingRow = Pick<
  CostItem,
  'id' | 'code' | 'name' | 'startDate' | 'endDate'
> & { section: string };

interface MarketingSlice {
  project: ProjectCache['project'];
  rows: MarketingRow[];
}

// Module-level select: one memoised pass over the MARKETING rows per cache version.
const selectMarketing = (c: ProjectCache): MarketingSlice => {
  const sectionByLine = new Map(
    c.budgetLines
      .filter((l) => l.category === 'MARKETING')
      .map((l) => [l.id, l.section]),
  );
  const rows: MarketingRow[] = [];
  for (const i of c.items) {
    const section = sectionByLine.get(i.budgetLineId);
    if (section)
      rows.push({
        id: i.id,
        code: i.code,
        name: i.name,
        startDate: i.startDate,
        endDate: i.endDate,
        section,
      });
  }
  return { project: c.project, rows };
};

/** /projects/:projectId/marketing/:section? — marketing plan, budget and channel mix (block 09). */
export function MarketingPage() {
  const { projectId = '', section } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const lastSection = useUiStore((s) => s.lastSection.marketing);
  const setLastSection = useUiStore((s) => s.setLastSection);
  const query = useProjectSnapshot(projectId, selectMarketing);
  const rollup = useProjectSummary(projectId);
  const lines = useBudgetLines(projectId, 'MARKETING');
  const editItem = useEditItem(projectId);

  const fallback =
    lines.find((l) => l.section === lastSection)?.section ?? lines[0]?.section;
  const line = lines.find((l) => l.section === section);
  const ids = useItemIds(projectId, line?.id ?? '');

  useEffect(() => {
    if (lines.length > 0 && !line && fallback) {
      navigate(
        `/projects/${encodeURIComponent(projectId)}/marketing/${encodeURIComponent(fallback)}`,
        { replace: true },
      );
    }
  }, [lines.length, line, fallback, navigate, projectId]);

  useEffect(() => {
    if (line) setLastSection('marketing', line.section);
  }, [line, setLastSection]);

  const select = useCallback(
    (id: string) =>
      navigate(
        `/projects/${encodeURIComponent(projectId)}/marketing/${encodeURIComponent(id)}`,
      ),
    [navigate, projectId],
  );

  const data = query.data;
  const calendar = useMemo(
    () =>
      data
        ? marketingCalendar(data.rows, data.project, today)
        : { months: [], bars: [] },
    [data, today],
  );
  const mix = useMemo(
    () => (rollup ? channelMix(lines, rollup.byLine) : []),
    [rollup, lines],
  );

  if (query.isError) {
    return (
      <ErrorState
        title="Could not load marketing"
        error={query.error}
        retry={() => void query.refetch()}
      />
    );
  }
  if (!data || !rollup) {
    return (
      <Card>
        <Skeleton lines={8} />
      </Card>
    );
  }
  if (lines.length === 0) {
    return (
      <EmptyState
        title="No marketing budget lines"
        description="This project has no MARKETING lines yet."
      />
    );
  }

  const marketing = rollup.byCategory.MARKETING;
  const { contractPrice } = computeProfitability(
    rollup.project,
    data.project.markupBps,
  );
  const share = marketingShare(marketing.forecast, contractPrice);
  const lineSummary = line ? rollup.byLine[line.id] : undefined;
  const channel = line ? CHANNELS[line.section] : undefined;
  const navItems = lines.map((l) => ({
    id: l.section,
    label: l.name,
    badge: rollup.byLine[l.id]?.overrun ? (
      <Badge tone="risk">Over</Badge>
    ) : undefined,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        <SubNav
          items={navItems}
          active={line?.section}
          onSelect={select}
          label="Marketing channels"
        />
        <div className="min-w-0 flex-1 space-y-4">
          {line && (
            <Card aria-label="Channel notes">
              <h2 className="text-base font-semibold">{line.name}</h2>
              {channel && (
                <>
                  <p className="mt-1 text-sm text-muted">{channel.blurb}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {channel.benchmarks.map((b) => (
                      <li key={b}>
                        <Badge tone="info">{b}</Badge>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}
          {line && (
            <EditableTable
              caption={line.name}
              rowIds={ids}
              context={projectId}
              useRow={useItem}
              columns={MARKETING_COLUMNS}
              onEdit={editItem}
              footer={
                lineSummary && {
                  name: `Total · approved ${formatEur(lineSummary.approved)}`,
                  planned: formatEur(lineSummary.planned),
                  committed: formatEur(lineSummary.committed),
                  actual: formatEur(lineSummary.actual),
                  phase: `EAC ${formatEur(lineSummary.forecast)}`,
                }
              }
            />
          )}
        </div>
        <aside className="lg:w-80 lg:shrink-0">
          <BudgetHealthPanel projectId={projectId} category="MARKETING" />
        </aside>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MarketingShareCard
          share={share}
          forecast={marketing.forecast}
          contractPrice={contractPrice}
        />
        <MarketingMix slices={mix} colorBySection={COLOR_BY_SECTION} />
      </div>
      <MarketingCalendar
        calendar={calendar}
        today={today}
        colorBySection={COLOR_BY_SECTION}
      />
    </div>
  );
}
