import {
  addDays,
  daysBetween,
  summarizeProject,
} from '@default-project/budget-engine';
import type {
  BudgetLine,
  CostItem,
  ScheduleResult,
} from '@default-project/types';

/** Pure view model of the Construction tab. Statuses come only from the engine (`checkSchedule`). */

export const CONTINGENCY_SECTION = 'contingency';

type Rollup = ReturnType<typeof summarizeProject>;
type Schedule = Record<string, ScheduleResult>;

interface CacheLike {
  items: CostItem[];
  itemsById: Record<string, CostItem>;
  linesById: Record<string, BudgetLine>;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parseIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

/** `2026-11-02` → `2 Nov` (UTC, fixed month names: ICU may print `Sept`). */
export function formatDayMonth(iso: string): string {
  const [, m, d] = parseIso(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Calendar days, both ends included (owner's decision 2026-10-14): 19–30 Oct = 12. */
export function workDurationDays(
  startDate: string | null,
  endDate: string | null,
): number | null {
  if (!startDate || !endDate || endDate < startDate) return null;
  return daysBetween(startDate, endDate) + 1;
}

export const INVALID_DATES_MESSAGE =
  'Invalid dates: the end is before the start';

/** Input check before a PATCH (not a schedule status). */
export function validateWorkDates(
  startDate: string | null,
  endDate: string | null,
): string | null {
  return startDate && endDate && endDate < startDate
    ? INVALID_DATES_MESSAGE
    : null;
}

/** Moves the work to `newStart`, keeping `end − start`. */
export function shiftWorkToDate(
  work: Pick<CostItem, 'startDate' | 'endDate'>,
  newStart: string,
): { startDate: string; endDate: string | null } {
  if (!work.startDate || !work.endDate)
    return { startDate: newStart, endDate: work.endDate };
  return {
    startDate: newStart,
    endDate: addDays(newStart, daysBetween(work.startDate, work.endDate)),
  };
}

/** The latest delivery among the work's blocking materials: shifting there unblocks the work. */
export function shiftTargetForWork(
  workId: string,
  itemsById: Record<string, CostItem>,
  schedule: Schedule,
): string | null {
  const r = schedule[workId];
  if (!r || r.kind !== 'WORK' || r.status !== 'BLOCKED') return null;
  let target: string | null = null;
  for (const id of r.blockingMaterials) {
    const d = itemsById[id]?.deliveryDate;
    if (d && (!target || d > target)) target = d;
  }
  return target;
}

export type ScheduleAlert =
  | {
      kind: 'LATE';
      key: string;
      materialId: string;
      materialSection: string | null;
      workId: string;
      workSection: string | null;
      delayDays: number;
      shiftTo: string | null;
      text: string;
    }
  | {
      kind: 'INVALID';
      key: string;
      workId: string;
      workCode: string;
      workSection: string | null;
      text: string;
    };

function sectionOf(
  item: CostItem,
  linesById: Record<string, BudgetLine>,
): string | null {
  return linesById[item.budgetLineId]?.section ?? null;
}

/** Every LATE_FOR_WORK material (by delay, largest first), then every INVALID_DATES work (by code). */
export function buildScheduleAlerts(
  cache: CacheLike,
  schedule: Schedule,
): ScheduleAlert[] {
  const late: Array<Extract<ScheduleAlert, { kind: 'LATE' }>> = [];
  const invalid: Array<Extract<ScheduleAlert, { kind: 'INVALID' }>> = [];
  for (const item of cache.items) {
    const r = schedule[item.id];
    if (!r) continue;
    if (
      r.kind === 'MATERIAL' &&
      r.status === 'LATE_FOR_WORK' &&
      r.workId &&
      item.deliveryDate &&
      r.needBy
    ) {
      const work = cache.itemsById[r.workId];
      if (!work) continue;
      const delayDays = r.delayDays ?? 0;
      late.push({
        kind: 'LATE',
        key: `late:${item.id}`,
        materialId: item.id,
        materialSection: sectionOf(item, cache.linesById),
        workId: work.id,
        workSection: sectionOf(work, cache.linesById),
        delayDays,
        shiftTo: shiftTargetForWork(work.id, cache.itemsById, schedule),
        text: `${item.name} (${item.code}) arrive ${formatDayMonth(item.deliveryDate)}, ${delayDays} ${
          delayDays === 1 ? 'day' : 'days'
        } after ${work.name} starts (${formatDayMonth(r.needBy)})`,
      });
    } else if (
      r.kind === 'WORK' &&
      r.status === 'INVALID_DATES' &&
      item.startDate &&
      item.endDate
    ) {
      invalid.push({
        kind: 'INVALID',
        key: `invalid:${item.id}`,
        workId: item.id,
        workCode: item.code,
        workSection: sectionOf(item, cache.linesById),
        text: `${item.name} (${item.code}): end ${formatDayMonth(item.endDate)} is before start ${formatDayMonth(item.startDate)}`,
      });
    }
  }
  late.sort(
    (a, b) => b.delayDays - a.delayDays || a.text.localeCompare(b.text),
  );
  invalid.sort((a, b) => a.workCode.localeCompare(b.workCode));
  return [...late, ...invalid];
}

/** Conflicted works (BLOCKED + INVALID_DATES) per CONSTRUCTION section. */
export function conflictCountBySection(
  cache: CacheLike,
  schedule: Schedule,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of cache.items) {
    const r = schedule[item.id];
    if (!r || r.kind !== 'WORK' || r.status === 'READY') continue;
    const line = cache.linesById[item.budgetLineId];
    if (!line || line.category !== 'CONSTRUCTION') continue;
    out[line.section] = (out[line.section] ?? 0) + 1;
  }
  return out;
}

/** Readiness label of a WORK row (rightmost column). */
export function readinessLabel(
  status: 'READY' | 'BLOCKED' | 'INVALID_DATES',
  worstDelayDays: number,
  blockerName: string | null,
): string {
  if (status === 'INVALID_DATES') return 'Invalid dates';
  if (status === 'BLOCKED')
    return `Blocked: ${blockerName ?? 'Materials'} arrive ${worstDelayDays} ${worstDelayDays === 1 ? 'day' : 'days'} late`;
  return 'Ready';
}

/** Name of the worst blocking material of a work (largest delay). */
export function worstBlockerName(
  workId: string,
  itemsById: Record<string, CostItem>,
  schedule: Schedule,
): string | null {
  const r = schedule[workId];
  if (!r || r.kind !== 'WORK' || r.status !== 'BLOCKED') return null;
  let best: { name: string; delay: number } | null = null;
  for (const id of r.blockingMaterials) {
    const m = schedule[id];
    const delay = m?.kind === 'MATERIAL' ? (m.delayDays ?? 0) : 0;
    if (!best || delay > best.delay)
      best = { name: itemsById[id]?.name ?? id, delay };
  }
  return best?.name ?? null;
}

export interface GanttMarker {
  id: string;
  code: string;
  name: string;
  date: string;
  late: boolean;
  status: string;
}

export interface GanttWork {
  id: string;
  code: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: 'READY' | 'BLOCKED' | 'INVALID_DATES' | null;
  markers: GanttMarker[];
  unscheduledMaterials: number;
}

export interface GanttGroup {
  section: string;
  name: string;
  works: GanttWork[];
}

export interface GanttModel {
  groups: GanttGroup[];
  /** Inclusive date range covering every bar, marker and today; null when nothing is dated. */
  range: { start: string; end: string } | null;
}

/** Bars per WORK (grouped by CONSTRUCTION line), ◆ per dated linked material at `deliveredDate ?? deliveryDate`. */
export function buildGanttModel(
  cache: CacheLike,
  schedule: Schedule,
  lines: BudgetLine[],
  today: string,
): GanttModel {
  const materialsByWork = new Map<string, CostItem[]>();
  for (const item of cache.items) {
    if (item.kind !== 'MATERIAL' || !item.requiredForWorkId) continue;
    const list = materialsByWork.get(item.requiredForWorkId) ?? [];
    list.push(item);
    materialsByWork.set(item.requiredForWorkId, list);
  }
  const worksByLine = new Map<string, CostItem[]>();
  for (const item of cache.items) {
    if (item.kind !== 'WORK') continue;
    const list = worksByLine.get(item.budgetLineId) ?? [];
    list.push(item);
    worksByLine.set(item.budgetLineId, list);
  }

  let min: string | null = null;
  let max: string | null = null;
  const see = (d: string | null) => {
    if (!d) return;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  };

  const groups: GanttGroup[] = [];
  for (const line of lines) {
    if (line.category !== 'CONSTRUCTION') continue;
    const works = (worksByLine.get(line.id) ?? [])
      .slice()
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
      );
    if (works.length === 0) continue;
    groups.push({
      section: line.section,
      name: line.name,
      works: works.map((w) => {
        const r = schedule[w.id];
        const materials = materialsByWork.get(w.id) ?? [];
        const markers: GanttMarker[] = [];
        for (const m of materials) {
          const date = m.deliveredDate ?? m.deliveryDate;
          if (!date) continue;
          const mr = schedule[m.id];
          const status = mr?.kind === 'MATERIAL' ? mr.status : 'ON_TIME';
          markers.push({
            id: m.id,
            code: m.code,
            name: m.name,
            date,
            late: status === 'LATE_FOR_WORK',
            status,
          });
          see(date);
        }
        see(w.startDate);
        see(w.endDate);
        return {
          id: w.id,
          code: w.code,
          name: w.name,
          startDate: w.startDate,
          endDate: w.endDate,
          status: r?.kind === 'WORK' ? r.status : null,
          markers: markers.sort((a, b) => a.date.localeCompare(b.date)),
          unscheduledMaterials: materials.length - markers.length,
        };
      }),
    });
  }
  if (min) see(today);
  return { groups, range: min && max ? { start: min, end: max } : null };
}

/** Position of a date inside the range, in percent (0–100). */
export function positionPct(
  range: { start: string; end: string },
  date: string,
): number {
  const total = daysBetween(range.start, range.end) + 1;
  return Math.min(
    100,
    Math.max(0, (daysBetween(range.start, date) / total) * 100),
  );
}

/** Width of an inclusive [start, end] span inside the range, in percent. */
export function spanPct(
  range: { start: string; end: string },
  start: string,
  end: string,
): number {
  const total = daysBetween(range.start, range.end) + 1;
  return Math.max(0, ((daysBetween(start, end) + 1) / total) * 100);
}

export interface ContingencyUsage {
  reserve: number;
  used: number;
  remaining: number;
}

/** Reserve = approved of the contingency line; used = Σ overrun of every other line (engine rollup). */
export function contingencyUsage(
  rollup: Rollup,
  contingencyLineId: string | undefined,
): ContingencyUsage {
  const reserve = contingencyLineId
    ? (rollup.byLine[contingencyLineId]?.approved ?? 0)
    : 0;
  const used = rollup.overrunLines
    .filter((l) => l.lineId !== contingencyLineId)
    .reduce((sum, l) => sum + l.overrunCents, 0);
  return { reserve, used, remaining: reserve - used };
}

/** Next free `WRK-<PREFIX>-NNN` code in the project. */
export function nextWorkCode(items: CostItem[], prefix: string): string {
  const head = `WRK-${prefix}-`;
  let max = 0;
  for (const i of items) {
    if (!i.code.startsWith(head)) continue;
    const n = Number(i.code.slice(head.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${head}${String(max + 1).padStart(3, '0')}`;
}
