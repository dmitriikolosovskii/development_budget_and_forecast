import type { Cashflow, CashflowMonth } from '@default-project/types';
import type { EngineItem, EngineSnapshot } from './engine-types';
import { itemPlannedCents } from './money';
import { itemForecastCents } from './rollup';

/** 'YYYY-MM-DD' → year*12 + (month-1). String arithmetic only: no Date, so no timezone drift. */
function monthIndex(isoDate: string): number {
  return Number(isoDate.slice(0, 4)) * 12 + Number(isoDate.slice(5, 7)) - 1;
}

function monthLabel(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Plan months of a row: MATERIAL → delivery month; WORK/SERVICE → start..end inclusive; null → unscheduled. */
function planRange(item: EngineItem): [number, number] | null {
  if (item.kind === 'MATERIAL') {
    const date = item.deliveryDate ?? item.deliveredDate;
    return date ? [monthIndex(date), monthIndex(date)] : null;
  }
  const start = item.startDate ?? item.endDate;
  const end = item.endDate ?? item.startDate;
  if (!start || !end) return null;
  const from = monthIndex(start);
  return [from, Math.max(from, monthIndex(end))];
}

/**
 * Monthly planned / actual / forecast cash flow of a project (CONTRACTS §3 "Cash flow").
 * - planned/forecast: MATERIAL → month of deliveryDate (fallback deliveredDate); WORK/SERVICE → spread evenly
 *   over the months from startDate to endDate inclusive (one date → that month; end < start → start month).
 *   The cent remainder goes to the first month, so the parts always sum to the row amount.
 * - actual: month of deliveredDate, else endDate, else startDate, else the `today` month.
 * - rows without any plan date → `unscheduled`.
 * - `months` is continuous from the first to the last month that received a non-zero amount.
 */
export function monthlyCashflow(
  snapshot: EngineSnapshot,
  today: string,
): Cashflow {
  const buckets = new Map<
    number,
    { planned: number; actual: number; forecast: number }
  >();
  const bucket = (index: number) => {
    let b = buckets.get(index);
    if (!b) {
      b = { planned: 0, actual: 0, forecast: 0 };
      buckets.set(index, b);
    }
    return b;
  };
  const unscheduled = { planned: 0, forecast: 0 };

  for (const item of snapshot.items) {
    const planned = itemPlannedCents(item);
    const forecast = itemForecastCents(item);
    const range = planRange(item);
    if (range) {
      const [from, to] = range;
      const n = to - from + 1;
      const plannedBase = Math.floor(planned / n);
      const forecastBase = Math.floor(forecast / n);
      for (let i = from; i <= to; i++) {
        const first = i === from;
        if (planned !== 0)
          bucket(i).planned += first
            ? planned - plannedBase * (n - 1)
            : plannedBase;
        if (forecast !== 0)
          bucket(i).forecast += first
            ? forecast - forecastBase * (n - 1)
            : forecastBase;
      }
    } else {
      unscheduled.planned += planned;
      unscheduled.forecast += forecast;
    }
    if (item.actualCents !== 0) {
      const actualDate =
        item.deliveredDate ?? item.endDate ?? item.startDate ?? today;
      bucket(monthIndex(actualDate)).actual += item.actualCents;
    }
  }

  const months: CashflowMonth[] = [];
  if (buckets.size > 0) {
    const indexes = [...buckets.keys()];
    const first = Math.min(...indexes);
    const last = Math.max(...indexes);
    let cumulativePlanned = 0;
    let cumulativeActual = 0;
    let cumulativeForecast = 0;
    for (let i = first; i <= last; i++) {
      const b = buckets.get(i) ?? { planned: 0, actual: 0, forecast: 0 };
      cumulativePlanned += b.planned;
      cumulativeActual += b.actual;
      cumulativeForecast += b.forecast;
      months.push({
        month: monthLabel(i),
        ...b,
        cumulativePlanned,
        cumulativeActual,
        cumulativeForecast,
      });
    }
  }
  return { months, unscheduled };
}
