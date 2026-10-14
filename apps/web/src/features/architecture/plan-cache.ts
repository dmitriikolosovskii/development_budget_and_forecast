import type { ArchitecturePlan, BoqComponent, CostItem, Room } from '@default-project/types';
import { applyItemsPatch, type ProjectCache } from '../project/project-cache';

/** Pure reducers for `cache.plan` (rooms and BOQ live inside the plan; items go through 02's reducers). */

type PlanScalars = Partial<Omit<ArchitecturePlan, 'id' | 'projectId'>>;

export type CachedPlan = NonNullable<ProjectCache['plan']>;

/** Plan fields only: rooms/components in a patch are ignored, so a rollback never reverts room edits. */
export function applyPlanPatch(cache: ProjectCache, patch: PlanScalars & Partial<CachedPlan>): ProjectCache {
  if (!cache.plan) return cache;
  const { rooms: _r, components: _c, ...scalars } = patch;
  return { ...cache, plan: { ...cache.plan, ...scalars, id: cache.plan.id, projectId: cache.plan.projectId } };
}

export function setPlan(cache: ProjectCache, plan: ArchitecturePlan): ProjectCache {
  return { ...cache, plan: { rooms: [], components: [], ...cache.plan, ...plan } };
}

function mapRooms(cache: ProjectCache, fn: (rooms: Room[]) => Room[]): ProjectCache {
  return cache.plan ? { ...cache, plan: { ...cache.plan, rooms: fn(cache.plan.rooms) } } : cache;
}

function mapComponents(cache: ProjectCache, fn: (rows: BoqComponent[]) => BoqComponent[]): ProjectCache {
  return cache.plan ? { ...cache, plan: { ...cache.plan, components: fn(cache.plan.components) } } : cache;
}

export const applyRoomPatch = (cache: ProjectCache, roomId: string, patch: Partial<Room>): ProjectCache =>
  mapRooms(cache, (rooms) => rooms.map((r) => (r.id === roomId ? { ...r, ...patch, id: r.id } : r)));

export const addRoom = (cache: ProjectCache, room: Room): ProjectCache => mapRooms(cache, (rooms) => [...rooms, room]);

export const removeRoom = (cache: ProjectCache, roomId: string): ProjectCache =>
  mapRooms(cache, (rooms) => rooms.filter((r) => r.id !== roomId));

export const applyComponentPatch = (
  cache: ProjectCache,
  componentId: string,
  patch: Partial<BoqComponent>,
): ProjectCache =>
  mapComponents(cache, (rows) => rows.map((c) => (c.id === componentId ? { ...c, ...patch, id: c.id } : c)));

export const addComponent = (cache: ProjectCache, component: BoqComponent): ProjectCache =>
  mapComponents(cache, (rows) => [...rows, component]);

/** Mirrors `onDelete: SetNull`: the linked items stay and lose `boqComponentId`. */
export function removeComponent(cache: ProjectCache, componentId: string): ProjectCache {
  const linked = linkedItemIds(cache, componentId);
  const without = mapComponents(cache, (rows) => rows.filter((c) => c.id !== componentId));
  return applyItemsPatch(
    without,
    linked.map((id) => ({ id, patch: { boqComponentId: null } })),
  );
}

export const linkedItemIds = (cache: ProjectCache, componentId: string): string[] =>
  cache.items.filter((i) => i.boqComponentId === componentId).map((i) => i.id);

export const findComponent = (cache: ProjectCache, componentId: string): BoqComponent | undefined =>
  cache.plan?.components.find((c) => c.id === componentId);

export const findRoom = (cache: ProjectCache, roomId: string): Room | undefined =>
  cache.plan?.rooms.find((r) => r.id === roomId);

export type LinkedItem = Pick<CostItem, 'id' | 'qtyMilli' | 'unit'>;
