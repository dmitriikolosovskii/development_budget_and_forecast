import { daysBetween, itemPlannedCents, roundHalfUp } from '@default-project/budget-engine';
import { eur } from './money';
import type { BudgetLineSeed, CostItemSeed, LandSeed, PlanSeed, ProjectSeed, RoomSeed, Unit } from './types';

/** Area factor as an exact fraction (e.g. 110/144), so scaling never goes through floats for money or quantities. */
export interface Factor {
  num: number;
  den: number;
}

export interface DeriveOptions {
  project: ProjectSeed['project'];
  /** DONE: a finished project (everything paid and delivered). PLANNED: nothing committed yet. */
  mode: 'DONE' | 'PLANNED';
  areaFactor: Factor;
  shiftDays: number;
  /** A different plot: land rows (purchase, transfer tax, notary, registry) are recomputed from it. */
  land?: { seed: LandSeed; pricePerM2Eur: string };
  /** A bespoke plan; by default the base plan is scaled by √factor. */
  plan?: PlanSeed;
  /** DONE mode: final cost above plan per section, in basis points. */
  overrunBps?: Record<string, number>;
}

/** Minimum days between a material delivery and the start of the work it is needed for, below which it is re-dated. */
const MIN_SLACK_DAYS = 3;
const REDATE_SLACK_DAYS = 5;
const CONTINUOUS_UNITS: ReadonlySet<Unit> = new Set<Unit>(['m3', 'm2', 'm', 't', 'kg', 'h']);
const SCALED_CATEGORIES: ReadonlySet<string> = new Set(['MATERIALS', 'CONSTRUCTION']);

/** Scales only continuous quantities: there is still one heat pump and one front door in a smaller house. */
export function scaleQty(qtyMilli: number, unit: Unit, f: Factor): number {
  return CONTINUOUS_UNITS.has(unit) ? roundHalfUp(BigInt(qtyMilli) * BigInt(f.num), BigInt(f.den)) : qtyMilli;
}

export function shiftDate(date: string | null, days: number): string | null {
  if (date === null || days === 0) return date;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Edge scaling: neighbouring rectangles share rounded edges, so scaled rooms never overlap. */
export function scalePlan(plan: PlanSeed, f: Factor): PlanSeed {
  if (f.num === f.den) return plan;
  const s = Math.sqrt(f.num / f.den);
  const at = (v: number) => Math.round(v * s);
  const rooms: RoomSeed[] = plan.rooms.map((r) => ({
    ...r,
    xCm: at(r.xCm),
    yCm: at(r.yCm),
    wCm: at(r.xCm + r.wCm) - at(r.xCm),
    hCm: at(r.yCm + r.hCm) - at(r.yCm),
  }));
  return { ...plan, footprintWidthCm: at(plan.footprintWidthCm), footprintDepthCm: at(plan.footprintDepthCm), rooms };
}

function percentOf(cents: number, bps: number): number {
  return roundHalfUp(BigInt(cents) * BigInt(bps), BigInt(10_000));
}

/** Land rows for another plot: purchase = area × price; transfer tax 5.5 % (Saxony), notary 1.5 %, registry 0.5 %. */
function relandItems(items: CostItemSeed[], land: LandSeed, pricePerM2Eur: string): CostItemSeed[] {
  const price = eur(pricePerM2Eur);
  const purchase = land.areaM2 * price;
  const fees: Record<string, number> = { 'SRV-ACQ-001': 550, 'SRV-ACQ-002': 150, 'SRV-ACQ-003': 50 };
  return items.map((i) => {
    if (i.code === 'SRV-PUR-001')
      return {
        ...i,
        name: `Plot ${land.areaM2} m², ${land.municipality}`,
        description: `${pricePerM2Eur} €/m²`,
        qtyMilli: land.areaM2 * 1000,
        unitPriceCents: price,
      };
    const bps = fees[i.code];
    return bps === undefined ? i : { ...i, qtyMilli: 1000, unitPriceCents: percentOf(purchase, bps) };
  });
}

function scaleItem(i: CostItemSeed, f: Factor): CostItemSeed {
  if (SCALED_CATEGORIES.has(i.category)) return { ...i, qtyMilli: scaleQty(i.qtyMilli, i.unit, f) };
  // HOAI fees follow the eligible construction cost.
  if (i.category === 'ARCHITECTURE' && i.section === 'design')
    return { ...i, unitPriceCents: roundHalfUp(BigInt(i.unitPriceCents) * BigInt(f.num), BigInt(f.den)) };
  return i;
}

/** Moves deliveries that would arrive later than 3 days before their work to 5 days before it. */
function redateMaterials(items: CostItemSeed[]): CostItemSeed[] {
  const starts = new Map(items.filter((i) => i.kind === 'WORK').map((i) => [i.code, i.startDate]));
  return items.map((i) => {
    const needBy = i.requiredForWorkCode ? starts.get(i.requiredForWorkCode) : null;
    if (i.kind !== 'MATERIAL' || !needBy) return i;
    if (i.deliveryDate && daysBetween(i.deliveryDate, needBy) >= MIN_SLACK_DAYS) return i;
    return { ...i, deliveryDate: shiftDate(needBy, -REDATE_SLACK_DAYS) };
  });
}

function applyMoney(i: CostItemSeed, mode: DeriveOptions['mode'], overrunBps: number): CostItemSeed {
  if (mode === 'PLANNED')
    return { ...i, status: 'PLANNED', committedCents: 0, actualCents: 0, deliveredDate: null };
  const final = percentOf(itemPlannedCents(i), 10_000 + overrunBps);
  return {
    ...i,
    status: 'DONE',
    committedCents: final,
    actualCents: final,
    deliveredDate: i.kind === 'MATERIAL' ? i.deliveryDate : null,
  };
}

function plannedByLine(items: CostItemSeed[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const i of items) {
    const key = `${i.category}/${i.section}`;
    sums.set(key, (sums.get(key) ?? 0) + itemPlannedCents(i));
  }
  return sums;
}

/**
 * Approved budget of a derived project:
 * - land lines = their recomputed planned amount;
 * - PLANNED: max(base approved × factor for scaled lines, planned), so a fresh project starts without overruns;
 * - DONE: the planned amount of each line (the budget fixed at contract award; the contingency was released into the trades).
 */
function deriveLines(base: BudgetLineSeed[], items: CostItemSeed[], o: DeriveOptions): BudgetLineSeed[] {
  const planned = plannedByLine(items);
  const f = o.areaFactor;
  return base.map((l) => {
    const p = planned.get(`${l.category}/${l.section}`) ?? 0;
    if (l.category === 'LAND' || o.mode === 'DONE') return { ...l, approvedCents: p };
    const scaled =
      SCALED_CATEGORIES.has(l.category) || (l.category === 'ARCHITECTURE' && l.section === 'design')
        ? roundHalfUp(BigInt(l.approvedCents) * BigInt(f.num), BigInt(f.den))
        : l.approvedCents;
    return { ...l, approvedCents: Math.max(scaled, p) };
  });
}

/** A project built from the demo project: scaled by area, shifted in time, and either finished or not started. */
export function deriveProject(base: ProjectSeed, o: DeriveOptions): ProjectSeed {
  const f = o.areaFactor;
  let items = base.items
    .filter((i) => !i.changeOrder)
    .map((i) => scaleItem(i, f))
    .map((i) => ({
      ...i,
      deliveryDate: shiftDate(i.deliveryDate, o.shiftDays),
      deliveredDate: shiftDate(i.deliveredDate, o.shiftDays),
      startDate: shiftDate(i.startDate, o.shiftDays),
      endDate: shiftDate(i.endDate, o.shiftDays),
    }));
  if (o.land) items = relandItems(items, o.land.seed, o.land.pricePerM2Eur);
  items = redateMaterials(items);

  // Plan lines are built from planned amounts before any final-cost overrun is applied.
  const budgetLines = deriveLines(base.budgetLines, items, o);
  items = items.map((i) => applyMoney(i, o.mode, o.overrunBps?.[i.section] ?? 0));

  const basePlan = base.plan;
  const plan = o.plan ?? (basePlan ? scalePlan(basePlan, f) : null);
  return {
    project: o.project,
    budgetLines,
    items,
    land: o.land ? o.land.seed : base.land,
    plan: plan && {
      ...plan,
      components: (basePlan?.components ?? plan.components).map((c) => ({ ...c, qtyMilli: scaleQty(c.qtyMilli, c.unit, f) })),
    },
    deliveries: [],
  };
}
