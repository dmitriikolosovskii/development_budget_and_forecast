import type { ReactNode } from 'react';
import { formatBps, formatEurWhole } from '@default-project/budget-engine';
import type { Profitability, Summary } from '@default-project/types';
import { Badge, Card, FlashValue } from '../../ui';
import { cx } from '../../ui/cx';
import { MarkupEditor } from './markup-editor';
import { marginTone } from './profitability-data';

interface HeroCardProps {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  testId?: string;
}

function HeroCard({ label, children, hint, testId }: HeroCardProps) {
  return (
    <Card data-testid={testId} className="flex flex-col gap-1">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
      <div className="text-xl font-semibold text-ink tabular-nums">
        {children}
      </div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export interface HeroCardsProps {
  summary: Summary;
  profitability: Profitability;
  markupBps: number;
  onMarkupChange: (markupBps: number) => void;
}

export function HeroCards({
  summary,
  profitability: p,
  markupBps,
  onMarkupChange,
}: HeroCardsProps) {
  const tone = marginTone(p.forecastProfit);
  const eroded = p.profitErosion > 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <HeroCard label="Approved budget" testId="hero-approved">
        <FlashValue value={formatEurWhole(p.approved)}>
          {formatEurWhole(p.approved)}
        </FlashValue>
      </HeroCard>
      <HeroCard label="Company markup" hint="on the approved budget">
        <MarkupEditor markupBps={markupBps} onChange={onMarkupChange} />
      </HeroCard>
      <HeroCard
        label="Contract price"
        testId="hero-contract-price"
        hint="approved × (1 + markup)"
      >
        <FlashValue value={formatEurWhole(p.contractPrice)}>
          {formatEurWhole(p.contractPrice)}
        </FlashValue>
      </HeroCard>
      <HeroCard
        label="Forecast cost (EAC)"
        testId="hero-forecast"
        hint={`${formatBps(summary.forecastVsApprovedBps)} of budget`}
      >
        <FlashValue value={formatEurWhole(summary.forecast)}>
          {formatEurWhole(summary.forecast)}
        </FlashValue>
      </HeroCard>
      <HeroCard
        label="Forecast profit"
        testId="hero-forecast-profit"
        hint={
          <Badge tone={tone}>
            {p.forecastProfit < 0 ? 'Loss' : 'Profit'} · margin{' '}
            <span data-testid="hero-margin">{formatBps(p.marginBps)}</span>
          </Badge>
        }
      >
        <span className={cx(tone === 'risk' ? 'text-risk-600' : 'text-ok-600')}>
          <FlashValue value={formatEurWhole(p.forecastProfit)}>
            {formatEurWhole(p.forecastProfit)}
          </FlashValue>
        </span>
      </HeroCard>
      <HeroCard
        label="Planned profit"
        testId="hero-planned-profit"
        hint="contract price − approved"
      >
        <FlashValue value={formatEurWhole(p.plannedProfit)}>
          {formatEurWhole(p.plannedProfit)}
        </FlashValue>
      </HeroCard>
      <HeroCard
        label="Profit erosion"
        testId="hero-erosion"
        hint="planned − forecast profit"
      >
        <span
          data-tone={eroded ? 'risk' : 'ok'}
          className={cx(eroded ? 'text-risk-600' : 'text-ink')}
        >
          <FlashValue value={formatEurWhole(p.profitErosion)}>
            {formatEurWhole(p.profitErosion)}
          </FlashValue>
        </span>
      </HeroCard>
      <HeroCard
        label="Spent to date"
        hint={`${formatBps(summary.spentBps)} of budget`}
      >
        <FlashValue value={formatEurWhole(summary.actual)}>
          {formatEurWhole(summary.actual)}
        </FlashValue>
      </HeroCard>
    </div>
  );
}
