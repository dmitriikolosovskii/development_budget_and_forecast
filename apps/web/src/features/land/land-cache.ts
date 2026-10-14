import type {
  LandParcel,
  UtilityConnection,
  UtilityType,
} from '@default-project/types';
import { autosaveQueue } from '../../lib/autosave-queue';
import type { ProjectCache } from '../project/project-cache';

export type CachedLand = NonNullable<ProjectCache['land']>;
export type LandFields = Omit<
  LandParcel,
  'id' | 'projectId' | 'createdAt' | 'updatedAt'
>;
export type UtilityFields = Pick<
  UtilityConnection,
  'status' | 'distanceM' | 'provider' | 'notes'
>;

/** Autosave keys of this block (02's `cacheKey` covers item/line/project/org only). */
export const landKey = {
  land: (projectId: string) => `land:${projectId}`,
  utility: (projectId: string, type: UtilityType) =>
    `utility:${projectId}:${type}`,
};

/** Land scalars without the utilities: a land save must never touch the utility rows (judge constraint 1). */
export function landScalars(land: CachedLand | LandParcel): LandParcel {
  const { utilities: _utilities, ...rest } = land as CachedLand;
  return rest;
}

export function applyLandPatch(
  cache: ProjectCache,
  patch: Partial<LandParcel>,
): ProjectCache {
  if (!cache.land) return cache;
  const { utilities: _ignored, ...scalars } = patch as Partial<CachedLand>;
  return {
    ...cache,
    land: { ...cache.land, ...scalars, utilities: cache.land.utilities },
  };
}

export function blankUtility(
  landId: string,
  type: UtilityType,
): UtilityConnection {
  return {
    id: `new-${type}`,
    landId,
    type,
    status: 'NOT_AVAILABLE',
    distanceM: null,
    provider: null,
    notes: null,
  };
}

/** Replaces (or adds) one utility row; the parcel and the other rows keep their identity. */
export function applyUtilityPatch(
  cache: ProjectCache,
  type: UtilityType,
  patch: Partial<UtilityConnection>,
): ProjectCache {
  const land = cache.land;
  if (!land) return cache;
  const prev =
    land.utilities.find((u) => u.type === type) ?? blankUtility(land.id, type);
  const next = { ...prev, ...patch, type };
  const exists = land.utilities.some((u) => u.type === type);
  const utilities = exists
    ? land.utilities.map((u) => (u.type === type ? next : u))
    : [...land.utilities, next];
  return { ...cache, land: { ...land, utilities } };
}

/**
 * The land slice with unconfirmed autosave patches re-applied, so a refetch during a pending save
 * never shows the old value (02's `overlayUnconfirmed` does this for its own keys only).
 */
export function selectLand(cache: ProjectCache): CachedLand | null {
  if (!cache.land) return null;
  const pid = cache.project.id;
  let out = cache;
  const pending = autosaveQueue.unconfirmed(landKey.land(pid));
  if (pending) out = applyLandPatch(out, pending as Partial<LandParcel>);
  for (const u of cache.land.utilities) {
    const p = autosaveQueue.unconfirmed(landKey.utility(pid, u.type));
    if (p)
      out = applyUtilityPatch(out, u.type, p as Partial<UtilityConnection>);
  }
  return out.land;
}
