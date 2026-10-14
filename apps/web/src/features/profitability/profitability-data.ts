import { toBps } from '@default-project/budget-engine';
import {
  COST_CATEGORIES,
  type CostCategory,
  type Profitability,
} from '@default-project/types';
import type { ProjectRollup } from '../project/use-project-summary';
import type {
  CategoryBarRow,
  DonutSlice,
  WaterfallStep,
} from './charts/chart-types';

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  LAND: 'Land',
  ARCHITECTURE: 'Architecture',
  MATERIALS: 'Materials',
  CONSTRUCTION: 'Construction',
  MARKETING: 'Marketing',
};

export const MARKUP_MAX_BPS = 3000;
export const MARKUP_STEP_BPS = 50;

/** Grouped bars: Approved / Actual / Open commitments / Forecast per category. */
export function categoryRows(rollup: ProjectRollup): CategoryBarRow[] {
  return COST_CATEGORIES.map((c) => {
    const s = rollup.byCategory[c];
    return {
      key: c,
      label: CATEGORY_LABELS[c],
      approved: s.approved,
      actual: s.actual,
      openCommitments: s.openCommitments,
      forecast: s.forecast,
    };
  });
}

/** Donut: EAC by category. */
export function costSlices(rollup: ProjectRollup): DonutSlice[] {
  return COST_CATEGORIES.map((c) => ({
    key: c,
    label: CATEGORY_LABELS[c],
    value: rollup.byCategory[c].forecast,
  }));
}

/**
 * "From approved budget to forecast": approved → (forecast − approved) per category → EAC → forecast profit →
 * contract price. Markup is charged on approved, so EAC + forecast profit = contract price exactly.
 * Floating steps: base = the lower of the two running values, height = |delta|.
 */
export function waterfallData(
  rollup: ProjectRollup,
  p: Profitability,
): WaterfallStep[] {
  const total = (key: string, label: string, value: number): WaterfallStep => ({
    key,
    label,
    kind: 'total',
    delta: value,
    base: Math.min(0, value),
    height: Math.abs(value),
  });
  const step = (
    key: string,
    label: string,
    from: number,
    delta: number,
  ): WaterfallStep => ({
    key,
    label,
    kind: delta < 0 ? 'down' : 'up',
    delta,
    base: Math.min(from, from + delta),
    height: Math.abs(delta),
  });

  const steps: WaterfallStep[] = [
    total('approved', 'Approved', rollup.project.approved),
  ];
  let running = rollup.project.approved;
  for (const c of COST_CATEGORIES) {
    const s = rollup.byCategory[c];
    const delta = s.forecast - s.approved;
    steps.push(step(c, CATEGORY_LABELS[c], running, delta));
    running += delta;
  }
  steps.push(total('forecast', 'Forecast (EAC)', rollup.project.forecast));
  steps.push(
    step(
      'profit',
      p.forecastProfit < 0 ? 'Loss' : 'Profit',
      rollup.project.forecast,
      p.forecastProfit,
    ),
  );
  steps.push(total('contractPrice', 'Contract price', p.contractPrice));
  return steps;
}

export interface OverrunRow {
  lineId: string;
  name: string;
  category: CostCategory;
  section: string;
  approved: number;
  forecast: number;
  overrunCents: number;
  /** overrun / approved in bps; null when approved is 0 (shown as "—"). */
  overrunBps: number | null;
}

export function overrunRows(rollup: ProjectRollup): OverrunRow[] {
  return rollup.overrunLines.map((o) => {
    const line = rollup.byLine[o.lineId];
    return {
      lineId: o.lineId,
      name: o.name,
      category: o.category,
      section: o.section,
      approved: line.approved,
      forecast: line.forecast,
      overrunCents: o.overrunCents,
      overrunBps:
        line.approved === 0 ? null : toBps(o.overrunCents, line.approved),
    };
  });
}

export function marginTone(forecastProfit: number): 'ok' | 'risk' {
  return forecastProfit < 0 ? 'risk' : 'ok';
}

/**
 * "12", "12.5", "12,5 %" → bps, parsed on the string (never via float), clamped to 0–30 % and
 * snapped to 0.5 %. Returns null for anything that is not a non-negative number with ≤ 2 decimals.
 */
export function parseMarkupPercent(input: string): number | null {
  const m = /^\s*(\d{1,3})(?:[.,](\d{1,2}))?\s*%?\s*$/.exec(input);
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  const snapped = Math.round(bps / MARKUP_STEP_BPS) * MARKUP_STEP_BPS;
  return Math.min(MARKUP_MAX_BPS, snapped);
}
