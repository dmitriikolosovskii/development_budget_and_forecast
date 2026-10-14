import { roundHalfUp } from '@default-project/budget-engine';
import type { CostItem } from '@default-project/types';

/** Campaign phase by dates only (AC-09.3). Dates are `YYYY-MM-DD`, compared as strings (no time zones). */
export type CampaignPhase =
  | 'RUNNING'
  | 'PLANNED'
  | 'FINISHED'
  | 'NO_DATES'
  | 'INVALID';

export function campaignPhase(
  start: string | null | undefined,
  end: string | null | undefined,
  today: string,
): CampaignPhase {
  if (!start || !end) return 'NO_DATES';
  if (end < start) return 'INVALID';
  if (today < start) return 'PLANNED';
  if (today > end) return 'FINISHED';
  return 'RUNNING';
}

export const PHASE_LABEL: Record<
  CampaignPhase,
  { label: string; tone: 'info' | 'brand' | 'ok' | 'muted' | 'risk' }
> = {
  RUNNING: { label: 'Running now', tone: 'info' },
  PLANNED: { label: 'Planned', tone: 'brand' },
  FINISHED: { label: 'Finished', tone: 'ok' },
  NO_DATES: { label: 'No dates', tone: 'muted' },
  INVALID: { label: 'Invalid dates', tone: 'risk' },
};

/** Warn threshold for the marketing share of the contract price (BLOCK 09: flag when > 5 %). */
export const SHARE_WARN_BPS = 500;
/** Typical share for homebuilders (GERMANY-DATA §6). */
export const SHARE_BENCHMARK_BPS = 300;

export interface MarketingShare {
  /** Rounded for display only; the tone is decided on exact integers. */
  bps: number;
  tone: 'ok' | 'warn' | 'neutral';
}

/** Marketing forecast (EAC) as a share of the contract price (AC-09.4). Exactly 5 % is ok. */
export function marketingShare(
  forecastCents: number,
  contractPriceCents: number,
): MarketingShare {
  if (contractPriceCents <= 0) return { bps: 0, tone: 'neutral' };
  const bps = roundHalfUp(
    BigInt(forecastCents) * BigInt(10000),
    BigInt(contractPriceCents),
  );
  const over =
    BigInt(forecastCents) * BigInt(10000) >
    BigInt(SHARE_WARN_BPS) * BigInt(contractPriceCents);
  return { bps, tone: over ? 'warn' : 'ok' };
}

export interface MixSlice {
  section: string;
  name: string;
  forecast: number;
  /** share of the marketing forecast, bps (display) */
  bps: number;
}

/** Channel mix: forecast per MARKETING line (engine byLine), zero slices dropped, in line order. */
export function channelMix(
  lines: ReadonlyArray<{ id: string; section: string; name: string }>,
  forecastByLineId: Readonly<Record<string, { forecast: number } | undefined>>,
): MixSlice[] {
  const rows = lines
    .map((l) => ({
      section: l.section,
      name: l.name,
      forecast: forecastByLineId[l.id]?.forecast ?? 0,
    }))
    .filter((r) => r.forecast > 0);
  const total = rows.reduce((s, r) => s + r.forecast, 0);
  return rows.map((r) => ({
    ...r,
    bps:
      total === 0
        ? 0
        : roundHalfUp(BigInt(r.forecast) * BigInt(10000), BigInt(total)),
  }));
}

/** `YYYY-MM` arithmetic without Date. */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export interface CalendarBar {
  itemId: string;
  code: string;
  name: string;
  section: string;
  start: string;
  end: string;
  phase: CampaignPhase;
  /** column indexes in `months`, inclusive; clipped to the window */
  fromCol: number;
  toCol: number;
}

export interface MarketingCalendar {
  months: string[];
  bars: CalendarBar[];
}

/**
 * Campaign timeline by month. The window is the campaigns' own span, clamped to the project's
 * start − 1 month … end + 1 month, so one mistyped year cannot produce hundreds of columns.
 * Rows with no or invalid dates are left out; rows wholly outside the window are dropped.
 */
export function marketingCalendar(
  items: ReadonlyArray<
    Pick<CostItem, 'id' | 'code' | 'name' | 'startDate' | 'endDate'> & {
      section: string;
    }
  >,
  project: { startDate: string; endDate: string },
  today: string,
): MarketingCalendar {
  const minMonth = addMonths(project.startDate.slice(0, 7), -1);
  const maxMonth = addMonths(project.endDate.slice(0, 7), 1);
  const dated = items.filter((i) => {
    const p = campaignPhase(i.startDate, i.endDate, today);
    return p !== 'NO_DATES' && p !== 'INVALID';
  });
  const visible = dated.filter(
    (i) =>
      (i.endDate as string).slice(0, 7) >= minMonth &&
      (i.startDate as string).slice(0, 7) <= maxMonth,
  );
  if (visible.length === 0) return { months: [], bars: [] };

  const clamp = (m: string) =>
    m < minMonth ? minMonth : m > maxMonth ? maxMonth : m;
  const first = clamp(
    visible.reduce(
      (m, i) =>
        (i.startDate as string).slice(0, 7) < m
          ? (i.startDate as string).slice(0, 7)
          : m,
      '9999-12',
    ),
  );
  const last = clamp(
    visible.reduce(
      (m, i) =>
        (i.endDate as string).slice(0, 7) > m
          ? (i.endDate as string).slice(0, 7)
          : m,
      '0000-01',
    ),
  );
  const months: string[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
  const col = (m: string) =>
    months.indexOf(m < first ? first : m > last ? last : m);

  const bars = visible
    .map((i) => {
      const start = i.startDate as string;
      const end = i.endDate as string;
      return {
        itemId: i.id,
        code: i.code,
        name: i.name,
        section: i.section,
        start,
        end,
        phase: campaignPhase(start, end, today),
        fromCol: col(start.slice(0, 7)),
        toCol: col(end.slice(0, 7)),
      };
    })
    .sort(
      (a, b) => a.start.localeCompare(b.start) || a.code.localeCompare(b.code),
    );
  return { months, bars };
}
