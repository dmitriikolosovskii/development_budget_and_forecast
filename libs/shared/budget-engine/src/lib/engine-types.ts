import type { BudgetLine, CostItem } from '@default-project/types';

/**
 * Minimal structural inputs: the API passes Prisma rows (Date timestamps), the web passes parsed JSON.
 * Only the fields the formulas read are required.
 */
export type EngineItem = Pick<
  CostItem,
  | 'id'
  | 'budgetLineId'
  | 'kind'
  | 'status'
  | 'qtyMilli'
  | 'unitPriceCents'
  | 'committedCents'
  | 'actualCents'
  | 'deliveryDate'
  | 'deliveredDate'
  | 'startDate'
  | 'endDate'
  | 'requiredForWorkId'
>;

export type EngineLine = Pick<
  BudgetLine,
  'id' | 'category' | 'section' | 'name' | 'approvedCents'
>;

export interface EngineSnapshot {
  budgetLines: readonly EngineLine[];
  items: readonly EngineItem[];
}
