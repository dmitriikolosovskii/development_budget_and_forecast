import { memo } from 'react';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import {
  formatBps,
  formatDate,
  formatEurWhole,
} from '@default-project/budget-engine';
import { Badge } from '../../ui/badge';
import { Card, SectionTitle } from '../../ui/card';
import {
  CATEGORY_COLORS,
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  ChartCard,
} from '../../ui/chart-card';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/states';
import { FlashValue } from '../../ui/flash-value';
import { MARKETING_BENCHMARK_NOTE } from './channels';
import {
  PHASE_LABEL,
  SHARE_BENCHMARK_BPS,
  SHARE_WARN_BPS,
  type MarketingCalendar as CalendarModel,
  type MarketingShare,
  type MixSlice,
} from './marketing-model';

/**
 * Eight slice colours from 02's sanctioned chart palette (DESIGN-SYSTEM §1), without the status
 * colours (overrun red, profit green), so no slice reads as a warning. Indexed by section order.
 */
export const MIX_COLORS = [
  CATEGORY_COLORS.MARKETING,
  CHART_COLORS.budget,
  CHART_COLORS.commitments,
  CATEGORY_COLORS.ARCHITECTURE,
  CATEGORY_COLORS.LAND,
  CHART_COLORS.forecast,
  CATEGORY_COLORS.CONSTRUCTION,
  CATEGORY_COLORS.MATERIALS,
] as const;

const SHARE_TONE = { ok: 'ok', warn: 'warn', neutral: 'muted' } as const;

interface ShareCardProps {
  share: MarketingShare;
  forecast: number;
  contractPrice: number;
}

/** Marketing EAC ÷ contract price, ok up to 5 % (AC-09.4). */
export function MarketingShareCard({
  share,
  forecast,
  contractPrice,
}: ShareCardProps) {
  const text =
    share.tone === 'neutral'
      ? 'No contract price yet'
      : share.tone === 'warn'
        ? `Above ${formatBps(SHARE_WARN_BPS)}`
        : `Within ${formatBps(SHARE_WARN_BPS)}`;
  return (
    <Card aria-label="Marketing share">
      <SectionTitle subtitle={MARKETING_BENCHMARK_NOTE}>
        Marketing share of contract price
      </SectionTitle>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">
          <FlashValue value={share.bps}>{formatBps(share.bps)}</FlashValue>
        </span>
        <Badge tone={SHARE_TONE[share.tone]}>{text}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted">Marketing forecast (EAC)</dt>
          <dd className="font-medium tabular-nums">
            {formatEurWhole(forecast)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Contract price</dt>
          <dd className="font-medium tabular-nums">
            {formatEurWhole(contractPrice)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted">
        Benchmark {formatBps(SHARE_BENCHMARK_BPS)} · flagged above{' '}
        {formatBps(SHARE_WARN_BPS)}
      </p>
    </Card>
  );
}

interface MixProps {
  slices: MixSlice[];
  colorBySection: Record<string, string>;
}

/** Channel mix donut plus an accessible legend that carries the numbers (AC-09.2). */
export const MarketingMix = memo(function MarketingMix({
  slices,
  colorBySection,
}: MixProps) {
  if (slices.length === 0) {
    return (
      <Card>
        <SectionTitle>Channel mix</SectionTitle>
        <EmptyState
          title="No marketing forecast yet"
          description="Add activities with a quantity and a price."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <ChartCard
        title="Channel mix"
        subtitle="Forecast (EAC) by channel"
        height={220}
      >
        <PieChart>
          <Pie
            data={slices}
            dataKey="forecast"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={1}
            isAnimationActive={false}
          >
            {slices.map((s) => (
              <Cell key={s.section} fill={colorBySection[s.section]} />
            ))}
          </Pie>
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v) => formatEurWhole(Number(v))}
          />
        </PieChart>
      </ChartCard>
      <ul aria-label="Channel mix legend" className="space-y-1 text-sm">
        {slices.map((s) => (
          <li
            key={s.section}
            aria-label={s.name}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorBySection[s.section] }}
              />
              {s.name}
            </span>
            <span className="tabular-nums">
              <FlashValue value={s.forecast}>
                {formatEurWhole(s.forecast)}
              </FlashValue>
              <span className="ml-2 text-muted">{formatBps(s.bps)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const monthLabel = (m: string) =>
  MONTH_LABEL.format(new Date(`${m}-01T00:00:00Z`));

interface CalendarProps {
  calendar: CalendarModel;
  today: string;
  colorBySection: Record<string, string>;
}

/** Campaign timeline: one row per dated activity, one column per month, a "Today" marker. */
export const MarketingCalendar = memo(function MarketingCalendar({
  calendar,
  today,
  colorBySection,
}: CalendarProps) {
  const { months, bars } = calendar;
  if (bars.length === 0) {
    return (
      <Card>
        <SectionTitle>Marketing calendar</SectionTitle>
        <EmptyState
          title="No scheduled campaigns"
          description="Give activities a start and an end date to see them here."
        />
      </Card>
    );
  }
  const todayCol = months.indexOf(today.slice(0, 7));
  const grid = {
    gridTemplateColumns: `minmax(9rem, 14rem) repeat(${months.length}, minmax(2.5rem, 1fr))`,
  };
  return (
    <Card aria-label="Marketing calendar">
      <SectionTitle subtitle={`Today: ${formatDate(today)}`}>
        Marketing calendar
      </SectionTitle>
      <div className="overflow-x-auto">
        <div
          className="min-w-max text-xs"
          role="table"
          aria-label="Campaigns by month"
        >
          <div
            role="row"
            className="grid border-b border-line pb-1 text-muted"
            style={grid}
          >
            <span role="columnheader">Campaign</span>
            {months.map((m, i) => (
              <span
                key={m}
                role="columnheader"
                aria-current={i === todayCol ? 'date' : undefined}
                className={cx(
                  'text-center',
                  i === todayCol && 'font-semibold text-brand-600',
                )}
              >
                {monthLabel(m)}
              </span>
            ))}
          </div>
          {bars.map((b) => (
            <div
              key={b.itemId}
              role="row"
              className="grid items-center py-1"
              style={grid}
            >
              <span
                role="rowheader"
                className="truncate pr-2"
                title={`${b.code} · ${b.name}`}
              >
                {b.name}
              </span>
              <span
                role="cell"
                aria-label={`${b.name}: ${formatDate(b.start)} – ${formatDate(b.end)}, ${PHASE_LABEL[b.phase].label}`}
                className={cx(
                  'h-3 rounded-full transition-all duration-200',
                  b.phase === 'FINISHED' && 'opacity-50',
                )}
                style={{
                  gridColumn: `${b.fromCol + 2} / ${b.toCol + 3}`,
                  backgroundColor: colorBySection[b.section],
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
});
