import { roundHalfUp } from '@default-project/budget-engine';
import type {
  ArchitecturePlan,
  LandParcel,
  Room,
} from '@default-project/types';

/**
 * Pure drawing geometry for the Architecture tab. Everything is integer centimetres (CONTRACTS §1);
 * areas stay in integer cm² until they are formatted, so sums never drift.
 */

/** Outer wall allowance per side: footprint 1000 × 900 → room frame 920 × 820 (GERMANY-DATA §2). */
export const WALL_CM = 40;

export const FLOORS = [
  { floor: 0, label: 'Ground floor', short: 'GF' },
  { floor: 1, label: 'Upper floor', short: 'UF' },
] as const;

type Geometry = Pick<Room, 'xCm' | 'yCm' | 'wCm' | 'hCm'>;
type Footprint = Pick<
  ArchitecturePlan,
  'footprintWidthCm' | 'footprintDepthCm'
>;

export interface Frame {
  widthCm: number;
  depthCm: number;
}

export function innerFrame(plan: Footprint): Frame {
  return {
    widthCm: Math.max(plan.footprintWidthCm - 2 * WALL_CM, 0),
    depthCm: Math.max(plan.footprintDepthCm - 2 * WALL_CM, 0),
  };
}

export const roomAreaCm2 = (r: Geometry): number => r.wCm * r.hCm;

/** Living area = Σ room areas (cm²); always computed, never stored. */
export const livingAreaCm2 = (rooms: readonly Geometry[]): number =>
  rooms.reduce((sum, r) => sum + roomAreaCm2(r), 0);

/** `1436500` cm² → `"143.65 m²"`; `decimals` 1 → `"143.7 m²"` (half-up, integer maths). */
export function formatAreaM2(cm2: number, decimals: 1 | 2 = 2): string {
  const units = roundHalfUp(BigInt(cm2), BigInt(10_000 / 10 ** decimals));
  return `${(units / 10 ** decimals).toFixed(decimals)} m²`;
}

export const formatMetres = (cm: number): string =>
  `${(cm / 100).toFixed(1)} m`;

/** Touching edges are not an overlap (seed rooms share walls). */
export function overlaps(a: Geometry, b: Geometry): boolean {
  return (
    a.xCm < b.xCm + b.wCm &&
    b.xCm < a.xCm + a.wCm &&
    a.yCm < b.yCm + b.hCm &&
    b.yCm < a.yCm + a.hCm
  );
}

export const isOutsideFrame = (r: Geometry, frame: Frame): boolean =>
  r.xCm < 0 ||
  r.yCm < 0 ||
  r.xCm + r.wCm > frame.widthCm ||
  r.yCm + r.hCm > frame.depthCm;

export interface RoomIssue {
  overlapsWith: string[];
  outside: boolean;
}

/** Warnings per room id (never blocks a save, AC-08.3). Only rooms on the same floor can overlap. */
export function findRoomIssues(
  rooms: readonly Room[],
  frame: Frame,
): Record<string, RoomIssue> {
  const issues: Record<string, RoomIssue> = {};
  const issue = (id: string) =>
    (issues[id] ??= { overlapsWith: [], outside: false });
  rooms.forEach((a, i) => {
    if (isOutsideFrame(a, frame)) issue(a.id).outside = true;
    for (const b of rooms.slice(i + 1)) {
      if (a.floor !== b.floor || !overlaps(a, b)) continue;
      issue(a.id).overlapsWith.push(b.id);
      issue(b.id).overlapsWith.push(a.id);
    }
  });
  return issues;
}

/** Human-readable warnings for one floor, e.g. "Kitchen overlaps Living + dining". */
export function issueMessages(
  rooms: readonly Room[],
  issues: Record<string, RoomIssue>,
): string[] {
  const name = (id: string) => rooms.find((r) => r.id === id)?.name ?? id;
  const out: string[] = [];
  rooms.forEach((r, i) => {
    const issue = issues[r.id];
    if (!issue) return;
    if (issue.outside) out.push(`${r.name} is outside the house footprint`);
    for (const other of issue.overlapsWith) {
      // report each pair once: from the room that comes first
      const j = rooms.findIndex((x) => x.id === other);
      if (j > i) out.push(`${r.name} overlaps ${name(other)}`);
    }
  });
  return out;
}

type SitePlanInput = Footprint &
  Pick<ArchitecturePlan, 'siteOffsetXcm' | 'siteOffsetYcm'>;
type Plot = Pick<LandParcel, 'plotWidthCm' | 'plotDepthCm'>;

/** Distances from the house to the four plot boundaries; the street is the top edge (y = 0). */
export interface Setbacks {
  street: number;
  rear: number;
  left: number;
  right: number;
}

export function siteSetbacks(plan: SitePlanInput, plot: Plot): Setbacks {
  return {
    street: plan.siteOffsetYcm,
    rear: plot.plotDepthCm - plan.siteOffsetYcm - plan.footprintDepthCm,
    left: plan.siteOffsetXcm,
    right: plot.plotWidthCm - plan.siteOffsetXcm - plan.footprintWidthCm,
  };
}

export const isHouseOnPlot = (s: Setbacks): boolean =>
  s.street >= 0 && s.rear >= 0 && s.left >= 0 && s.right >= 0;

/** Allowed footprint per GRZ in m² (areaM2 × grz). */
export const allowedFootprintM2 = (
  land: Pick<LandParcel, 'areaM2' | 'grzBps'>,
): number =>
  roundHalfUp(BigInt(land.areaM2) * BigInt(land.grzBps), BigInt(10_000));
