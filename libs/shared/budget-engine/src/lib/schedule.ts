import type {
  MaterialScheduleResult,
  ScheduleResult,
  WorkScheduleResult,
} from '@default-project/types';
import type { EngineItem } from './engine-types';

const DAY_MS = 86_400_000;

function utcDay(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to` (YYYY-MM-DD), in UTC: positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY_MS);
}

/** `YYYY-MM-DD` + `days` (may be negative), in UTC. Inverse of `daysBetween`. */
export function addDays(isoDate: string, days: number): string {
  return new Date(utcDay(isoDate) + days * DAY_MS).toISOString().slice(0, 10);
}

type ScheduleItem = Pick<
  EngineItem,
  | 'id'
  | 'kind'
  | 'deliveryDate'
  | 'deliveredDate'
  | 'startDate'
  | 'endDate'
  | 'requiredForWorkId'
>;

function materialResult(
  item: ScheduleItem,
  byId: Map<string, ScheduleItem>,
  today: string,
): MaterialScheduleResult {
  const work = item.requiredForWorkId
    ? byId.get(item.requiredForWorkId)
    : undefined;
  const linked = work && work.kind === 'WORK' ? work : undefined;
  const needBy = linked?.startDate ?? undefined;
  const base: MaterialScheduleResult = { kind: 'MATERIAL', status: 'ON_TIME' };
  if (linked) base.workId = linked.id;
  if (needBy) base.needBy = needBy;

  if (item.deliveredDate) return { ...base, status: 'DELIVERED' };
  if (!item.deliveryDate) return { ...base, status: 'UNSCHEDULED' };
  if (needBy) base.slackDays = daysBetween(item.deliveryDate, needBy);
  if (needBy && item.deliveryDate > needBy) {
    return {
      ...base,
      status: 'LATE_FOR_WORK',
      delayDays: daysBetween(needBy, item.deliveryDate),
    };
  }
  if (item.deliveryDate < today) return { ...base, status: 'OVERDUE' };
  if (base.slackDays !== undefined && base.slackDays > 0 && base.slackDays < 3)
    return { ...base, status: 'AT_RISK' };
  return base;
}

/**
 * Material/work schedule conflicts (CONTRACTS §3). `today` is passed in, so results never depend on the clock.
 * SERVICE rows are not in the result.
 */
export function checkSchedule(
  items: readonly ScheduleItem[],
  today: string,
): Record<string, ScheduleResult> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: Record<string, ScheduleResult> = {};
  const lateByWork = new Map<string, Array<{ id: string; delay: number }>>();

  for (const item of items) {
    if (item.kind !== 'MATERIAL') continue;
    const r = materialResult(item, byId, today);
    result[item.id] = r;
    if (r.status === 'LATE_FOR_WORK' && r.workId) {
      const list = lateByWork.get(r.workId) ?? [];
      list.push({ id: item.id, delay: r.delayDays ?? 0 });
      lateByWork.set(r.workId, list);
    }
  }

  for (const item of items) {
    if (item.kind !== 'WORK') continue;
    let r: WorkScheduleResult;
    if (item.startDate && item.endDate && item.endDate < item.startDate) {
      r = {
        kind: 'WORK',
        status: 'INVALID_DATES',
        blockingMaterials: [],
        worstDelayDays: 0,
      };
    } else {
      const late = lateByWork.get(item.id) ?? [];
      r = late.length
        ? {
            kind: 'WORK',
            status: 'BLOCKED',
            blockingMaterials: late.map((l) => l.id),
            worstDelayDays: Math.max(...late.map((l) => l.delay)),
          }
        : {
            kind: 'WORK',
            status: 'READY',
            blockingMaterials: [],
            worstDelayDays: 0,
          };
    }
    result[item.id] = r;
  }
  return result;
}
