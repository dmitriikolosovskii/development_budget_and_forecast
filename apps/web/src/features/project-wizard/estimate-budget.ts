import { itemPlannedCents, roundHalfUp } from '@default-project/budget-engine';
import {
  COST_CATEGORIES,
  type BudgetLine,
  type CostCategory,
  type CostItem,
  type WizardInput,
} from '@default-project/types';
import { transferTaxBps } from './transfer-tax';

/**
 * Live estimate of the wizard (BLOCK 12 step 4). It mirrors the server planner
 * (`apps/api/src/project-wizard/wizard-plan.ts`) on purpose, so the defaults the user sees are exactly the
 * per-category sums the server would approve: rows scaled by livingArea/144 (continuous units of MATERIALS and
 * CONSTRUCTION, HOAI `design` price), land rows recomputed from step 2, approved per line = max(template approved
 * (× f where scaled), new planned); LAND = new planned. Keep both sides in step when a rule changes.
 */
export const TEMPLATE_LIVING_AREA_M2 = 144;

const CONTINUOUS_UNITS: ReadonlySet<string> = new Set([
  'm3',
  'm2',
  'm',
  't',
  'kg',
  'h',
]);
const SCALED_CATEGORIES: ReadonlySet<CostCategory> = new Set<CostCategory>([
  'MATERIALS',
  'CONSTRUCTION',
]);
export const NOTARY_BPS = 150;
export const LAND_REGISTRY_BPS = 50;

export interface EstimateTemplate {
  budgetLines: Pick<
    BudgetLine,
    'id' | 'category' | 'section' | 'approvedCents'
  >[];
  items: Pick<
    CostItem,
    'budgetLineId' | 'code' | 'unit' | 'qtyMilli' | 'unitPriceCents'
  >[];
}

export interface EstimateInput {
  livingAreaM2: number;
  land: Pick<WizardInput['land'], 'areaM2' | 'landValuePerM2Cents' | 'state'>;
}

export interface BudgetEstimate {
  /** default approved per category (what the server approves when the user keeps it) */
  approvedByCategory: Record<CostCategory, number>;
  /** planned cost of the scaled rows per category (the forecast of a fresh project) */
  plannedByCategory: Record<CostCategory, number>;
  approvedTotal: number;
  plannedTotal: number;
  land: {
    purchase: number;
    transferTax: number;
    transferTaxBps: number;
    taxEstimated: boolean;
    notary: number;
    registry: number;
  };
}

const zero = () =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<
    CostCategory,
    number
  >;
const fraction = (value: number, num: number, den: number) =>
  roundHalfUp(BigInt(value) * BigInt(num), BigInt(den));
const valid = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** Pure: per-category defaults for the given area and plot; invalid numbers count as 0 (the form shows the error). */
export function estimateBudget(
  input: EstimateInput,
  template: EstimateTemplate,
): BudgetEstimate {
  const area = valid(input.livingAreaM2)
    ? input.livingAreaM2
    : TEMPLATE_LIVING_AREA_M2;
  const plotArea = valid(input.land.areaM2) ? input.land.areaM2 : 0;
  const price = valid(input.land.landValuePerM2Cents)
    ? input.land.landValuePerM2Cents
    : 0;
  const scale = (v: number) => fraction(v, area, TEMPLATE_LIVING_AREA_M2);

  const purchase = plotArea * price;
  const tax = transferTaxBps(input.land.state ?? '');
  const land = {
    purchase,
    transferTax: fraction(purchase, tax.bps, 10_000),
    transferTaxBps: tax.bps,
    taxEstimated: tax.estimated,
    notary: fraction(purchase, NOTARY_BPS, 10_000),
    registry: fraction(purchase, LAND_REGISTRY_BPS, 10_000),
  };
  const landRow: Record<string, number> = {
    'SRV-PUR-001': purchase,
    'SRV-ACQ-001': land.transferTax,
    'SRV-ACQ-002': land.notary,
    'SRV-ACQ-003': land.registry,
  };

  const lines = new Map(template.budgetLines.map((l) => [l.id, l] as const));
  const plannedByLine = new Map<string, number>();
  for (const item of template.items) {
    const line = lines.get(item.budgetLineId);
    if (!line) continue;
    let planned: number;
    if (line.category === 'LAND' && item.code in landRow)
      planned = landRow[item.code];
    else if (
      SCALED_CATEGORIES.has(line.category) &&
      CONTINUOUS_UNITS.has(item.unit)
    )
      planned = itemPlannedCents({
        qtyMilli: scale(item.qtyMilli),
        unitPriceCents: item.unitPriceCents,
      });
    else if (line.category === 'ARCHITECTURE' && line.section === 'design')
      planned = itemPlannedCents({
        qtyMilli: item.qtyMilli,
        unitPriceCents: scale(item.unitPriceCents),
      });
    else planned = itemPlannedCents(item);
    plannedByLine.set(line.id, (plannedByLine.get(line.id) ?? 0) + planned);
  }

  const approvedByCategory = zero();
  const plannedByCategory = zero();
  for (const line of template.budgetLines) {
    const planned = plannedByLine.get(line.id) ?? 0;
    const scaled =
      SCALED_CATEGORIES.has(line.category) ||
      (line.category === 'ARCHITECTURE' && line.section === 'design');
    const approved =
      line.category === 'LAND'
        ? planned
        : Math.max(
            scaled ? scale(line.approvedCents) : line.approvedCents,
            planned,
          );
    approvedByCategory[line.category] += approved;
    plannedByCategory[line.category] += planned;
  }
  const sum = (r: Record<CostCategory, number>) =>
    COST_CATEGORIES.reduce((s, c) => s + r[c], 0);
  return {
    approvedByCategory,
    plannedByCategory,
    approvedTotal: sum(approvedByCategory),
    plannedTotal: sum(plannedByCategory),
    land,
  };
}
