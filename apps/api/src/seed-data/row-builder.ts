import { eur, itemPlannedCents, qty } from './money';
import type { CostCategory, CostItemSeed, ItemKind, ItemStatus, Unit } from './types';

/**
 * How a row's money is filled in:
 * - `DONE`: committed = actual = planned
 * - `CONTRACTED`: committed = planned, actual 0 (or `actual`)
 * - `PLANNED`: committed = actual = 0
 * - an object: explicit status with committed/actual in euros (committed defaults to planned)
 */
export type MoneyState = 'DONE' | 'CONTRACTED' | 'PLANNED' | { status: ItemStatus; committed?: string; actual?: string };

export interface RowInput {
  code: string;
  name: string;
  unit: Unit;
  qty: string;
  price: string;
  money: MoneyState;
  description?: string;
  supplier?: string;
  contractor?: string;
  delivery?: string;
  /** Delivered on `delivery` (MATERIAL). */
  delivered?: boolean;
  start?: string;
  end?: string;
  work?: string;
  boq?: string;
  notes?: string;
  changeOrder?: boolean;
}

export interface LineDefaults {
  category: CostCategory;
  section: string;
  kind: ItemKind;
  supplier?: string;
  contractor?: string;
}

export function buildRows(defaults: LineDefaults, rows: RowInput[]): CostItemSeed[] {
  return rows.map((r, index) => {
    const qtyMilli = qty(r.qty);
    const unitPriceCents = eur(r.price);
    const planned = itemPlannedCents({ qtyMilli, unitPriceCents });
    const { status, committedCents, actualCents } = resolveMoney(r.money, planned);
    return {
      code: r.code,
      category: defaults.category,
      section: defaults.section,
      kind: defaults.kind,
      name: r.name,
      description: r.description ?? null,
      unit: r.unit,
      qtyMilli,
      unitPriceCents,
      committedCents,
      actualCents,
      status,
      supplierSlug: r.supplier ?? defaults.supplier ?? null,
      contractorSlug: r.contractor ?? defaults.contractor ?? null,
      deliveryDate: r.delivery ?? null,
      deliveredDate: r.delivered ? (r.delivery ?? null) : null,
      startDate: r.start ?? null,
      endDate: r.end ?? r.start ?? null,
      requiredForWorkCode: r.work ?? null,
      boqCode: r.boq ?? null,
      sortOrder: index,
      notes: r.notes ?? null,
      changeOrder: r.changeOrder ?? false,
    };
  });
}

function resolveMoney(
  money: MoneyState,
  planned: number,
): { status: ItemStatus; committedCents: number; actualCents: number } {
  if (money === 'DONE') return { status: 'DONE', committedCents: planned, actualCents: planned };
  if (money === 'CONTRACTED') return { status: 'CONTRACTED', committedCents: planned, actualCents: 0 };
  if (money === 'PLANNED') return { status: 'PLANNED', committedCents: 0, actualCents: 0 };
  return {
    status: money.status,
    committedCents: money.committed === undefined ? planned : eur(money.committed),
    actualCents: money.actual === undefined ? 0 : eur(money.actual),
  };
}
