import {
  COST_CATEGORIES,
  type CostCategory,
  type LineSummary,
  type OverrunLine,
  type ProjectSummary,
  type Summary,
} from '@default-project/types';
import type { EngineItem, EngineSnapshot } from './engine-types';
import { itemPlannedCents, roundHalfUp } from './money';

type Amounts = Pick<
  Summary,
  | 'approved'
  | 'planned'
  | 'committed'
  | 'actual'
  | 'openCommitments'
  | 'exposure'
  | 'forecast'
>;

/** EAC of one row by status (CONTRACTS §3). The uncontracted remainder of scope is always counted. */
export function itemForecastCents(item: EngineItem): number {
  const { actualCents: actual, committedCents: committed } = item;
  switch (item.status) {
    case 'DONE':
      return actual;
    case 'CONTRACTED':
      return Math.max(actual, committed);
    default: {
      const planned = itemPlannedCents(item);
      return Math.max(actual, committed + Math.max(planned - committed, 0));
    }
  }
}

/** Obligation signed but not yet paid: max(committed − actual, 0). */
export function itemOpenCommitment(
  item: Pick<EngineItem, 'committedCents' | 'actualCents'>,
): number {
  return Math.max(item.committedCents - item.actualCents, 0);
}

/** Costs and obligations already incurred: actual + open commitment. */
export function itemExposure(
  item: Pick<EngineItem, 'committedCents' | 'actualCents'>,
): number {
  return item.actualCents + itemOpenCommitment(item);
}

/** x / base in basis points, 0 when base = 0. */
export function toBps(x: number, base: number): number {
  return base === 0 ? 0 : roundHalfUp(BigInt(x) * BigInt(10000), BigInt(base));
}

const zero = (): Amounts => ({
  approved: 0,
  planned: 0,
  committed: 0,
  actual: 0,
  openCommitments: 0,
  exposure: 0,
  forecast: 0,
});

function add(into: Amounts, from: Amounts): void {
  into.approved += from.approved;
  into.planned += from.planned;
  into.committed += from.committed;
  into.actual += from.actual;
  into.openCommitments += from.openCommitments;
  into.exposure += from.exposure;
  into.forecast += from.forecast;
}

/** Derives variance, overrun and bps from summed amounts. Totals are never rounded again. */
export function finalizeSummary(a: Amounts): Summary {
  for (const [k, v] of Object.entries(a)) {
    if (!Number.isSafeInteger(v))
      throw new RangeError(`Summary.${k} is out of the safe integer range`);
  }
  return {
    ...a,
    variance: a.approved - a.forecast,
    overrun: a.forecast > a.approved,
    spentBps: toBps(a.actual, a.approved),
    forecastVsApprovedBps: toBps(a.forecast, a.approved),
  };
}

/** Rollups line → category → project as plain sums of rounded row values (CONTRACTS §3). */
export function summarizeProject(snapshot: EngineSnapshot): ProjectSummary {
  const lineAmounts = new Map<string, Amounts>();
  for (const line of snapshot.budgetLines)
    lineAmounts.set(line.id, { ...zero(), approved: line.approvedCents });

  for (const item of snapshot.items) {
    const acc = lineAmounts.get(item.budgetLineId);
    if (!acc) continue; // a row always belongs to a line of the same project (FK); ignore strays
    const open = itemOpenCommitment(item);
    add(acc, {
      approved: 0,
      planned: itemPlannedCents(item),
      committed: item.committedCents,
      actual: item.actualCents,
      openCommitments: open,
      exposure: item.actualCents + open,
      forecast: itemForecastCents(item),
    });
  }

  const categoryAmounts = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, zero()]),
  ) as Record<CostCategory, Amounts>;
  const projectAmounts = zero();
  const byLine: Record<string, LineSummary> = {};
  const overrunLines: OverrunLine[] = [];

  for (const line of snapshot.budgetLines) {
    const amounts = lineAmounts.get(line.id) as Amounts;
    add(categoryAmounts[line.category], amounts);
    const summary = finalizeSummary(amounts);
    byLine[line.id] = {
      ...summary,
      lineId: line.id,
      category: line.category,
      section: line.section,
      name: line.name,
    };
    if (summary.overrun) {
      overrunLines.push({
        lineId: line.id,
        name: line.name,
        category: line.category,
        section: line.section,
        overrunCents: summary.forecast - summary.approved,
      });
    }
  }
  for (const c of COST_CATEGORIES) add(projectAmounts, categoryAmounts[c]);

  overrunLines.sort(
    (a, b) =>
      b.overrunCents - a.overrunCents ||
      a.name.localeCompare(b.name) ||
      a.lineId.localeCompare(b.lineId),
  );

  return {
    project: finalizeSummary(projectAmounts),
    byCategory: Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, finalizeSummary(categoryAmounts[c])]),
    ) as Record<CostCategory, Summary>,
    byLine,
    overrunLines,
  };
}
