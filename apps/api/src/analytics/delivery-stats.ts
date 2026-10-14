import { checkSchedule, type EngineItem } from '@default-project/budget-engine';

export interface DeliveryStats {
  /** DELIVERED delivery rows of items that have a deliveryDate */
  deliveredRows: number;
  /** …of those, rows dated on or before the item's deliveryDate */
  onTimeRows: number;
  /** MATERIAL items whose schedule status is OVERDUE */
  overdueItems: number;
}

type StatsItem = EngineItem & { deliveryDate: string | null };
type StatsDelivery = { costItemId: string; kind: string; date: string };

/** Block 10's KPI definitions (howItWorks/10-delivery-tracking/DESIGN.md, "KPIs"), computed for one project. */
export function deliveryStats(
  items: readonly StatsItem[],
  deliveries: readonly StatsDelivery[],
  today: string,
): DeliveryStats {
  const dueById = new Map(items.map((i) => [i.id, i.deliveryDate]));
  let deliveredRows = 0;
  let onTimeRows = 0;
  for (const d of deliveries) {
    if (d.kind !== 'DELIVERED') continue;
    const due = dueById.get(d.costItemId);
    if (!due) continue;
    deliveredRows++;
    if (d.date <= due) onTimeRows++;
  }
  const schedule = checkSchedule(items, today);
  const overdueItems = Object.values(schedule).filter(
    (r) => r.kind === 'MATERIAL' && r.status === 'OVERDUE',
  ).length;
  return { deliveredRows, onTimeRows, overdueItems };
}
