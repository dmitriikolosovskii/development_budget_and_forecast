import { daysBetween, roundHalfUp } from '@default-project/budget-engine';
import type {
  CostItem,
  Delivery,
  ScheduleResult,
} from '@default-project/types';

export type PlanStatus =
  | { kind: 'ON_TIME' }
  | { kind: 'LATE'; days: number }
  | { kind: 'RECEIVED' }
  | { kind: 'OVERDUE' }
  | { kind: 'EXPECTED' };

type PlanItem = Pick<CostItem, 'deliveryDate' | 'deliveredDate'>;

/**
 * A log row against the plan: a DELIVERED row is on time when it arrived on or before the item's
 * current `deliveryDate`; an EXPECTED row is received once the item is delivered, overdue when its
 * date has passed.
 */
export function planStatus(
  delivery: Pick<Delivery, 'kind' | 'date'>,
  item: PlanItem | undefined,
  today: string,
): PlanStatus {
  if (delivery.kind === 'DELIVERED') {
    const planned = item?.deliveryDate;
    if (!planned || delivery.date <= planned) return { kind: 'ON_TIME' };
    return { kind: 'LATE', days: daysBetween(planned, delivery.date) };
  }
  if (item?.deliveredDate) return { kind: 'RECEIVED' };
  return delivery.date < today ? { kind: 'OVERDUE' } : { kind: 'EXPECTED' };
}

export interface DeliveryKpis {
  deliveredThisMonth: number;
  /** Share of DELIVERED rows (of items with a planned date) that were on time; `null` when none. */
  onTimeBps: number | null;
  openExpected: number;
  /** MATERIAL items the engine marks OVERDUE (same number as in Materials and Construction). */
  overdueItems: number;
}

export function deliveryKpis(
  deliveries: Delivery[],
  itemsById: Record<string, CostItem>,
  schedule: Record<string, ScheduleResult>,
  today: string,
): DeliveryKpis {
  const month = today.slice(0, 7);
  let deliveredThisMonth = 0;
  let measured = 0;
  let onTime = 0;
  let openExpected = 0;
  for (const d of deliveries) {
    const item = itemsById[d.costItemId];
    if (d.kind === 'DELIVERED') {
      if (d.date.startsWith(month)) deliveredThisMonth += 1;
      if (item?.deliveryDate) {
        measured += 1;
        if (d.date <= item.deliveryDate) onTime += 1;
      }
    } else if (!item?.deliveredDate) openExpected += 1;
  }
  const overdueItems = Object.values(schedule).filter(
    (r) => r.kind === 'MATERIAL' && r.status === 'OVERDUE',
  ).length;
  return {
    deliveredThisMonth,
    onTimeBps: measured
      ? roundHalfUp(BigInt(onTime * 10000), BigInt(measured))
      : null,
    openExpected,
    overdueItems,
  };
}
