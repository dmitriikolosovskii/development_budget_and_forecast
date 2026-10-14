import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  architecturePlanSchema,
  boqComponentSchema,
  roomSchema,
  type ArchitecturePlan,
  type BoqComponent,
  type CreateBoqComponentInput,
  type CreateRoomInput,
  type Room,
  type UpdatePlanInput,
} from '@default-project/types';
import { apiDelete, apiPatch, apiPost, seg } from '../../lib/api-client';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { showToast } from '../../lib/toast-store';
import { autosaveEdit, invalidateRollups } from '../project/autosave-edit';
import { applyItemsPatch, cacheKey, type ProjectCache } from '../project/project-cache';
import { updateProjectCache } from '../project/update-project-cache';
import { componentUpdateResultSchema } from './local-types';
import {
  addComponent,
  addRoom,
  applyComponentPatch,
  applyPlanPatch,
  applyRoomPatch,
  findComponent,
  findRoom,
  linkedItemIds,
  removeComponent,
  removeRoom,
  setPlan,
} from './plan-cache';

/** Autosave queue keys owned by block 08. */
export const planKey = {
  plan: (projectId: string) => `plan:${projectId}`,
  room: (id: string) => `room:${id}`,
  component: (id: string) => `boq:${id}`,
};

const base = (projectId: string) => `/projects/${seg(projectId)}/plan`;
const reason = (error: unknown) => (error instanceof Error ? error.message : 'unknown error');
const read = (qc: QueryClient, projectId: string) => qc.getQueryData<ProjectCache>(queryKeys.project(projectId));

/** `(patch) => void` for plan fields (passport, footprint, site offsets): optimistic + autosave. */
export function useEditPlan(projectId: string): (patch: UpdatePlanInput) => void {
  const qc = useQueryClient();
  return useCallback(
    (patch) =>
      autosaveEdit<ArchitecturePlan>(
        qc,
        {
          queueKey: planKey.plan(projectId),
          cancel: [queryKeys.project(projectId)],
          read: () => read(qc, projectId)?.plan ?? undefined,
          write: (p) => updateProjectCache(qc, projectId, (c) => applyPlanPatch(c, p)),
          send: async (merged) =>
            architecturePlanSchema.parse(await apiPatch(base(projectId), merged, { keepalive: true })),
        },
        patch,
      ),
    [qc, projectId],
  );
}

/** Creates the plan with server defaults (`PATCH /plan` upserts) for a project that has none. */
export function useCreatePlan(projectId: string): () => Promise<void> {
  const qc = useQueryClient();
  return useCallback(async () => {
    try {
      const plan = architecturePlanSchema.parse(await apiPatch(base(projectId), {}));
      updateProjectCache(qc, projectId, (c) => setPlan(c, plan));
    } catch (error) {
      showToast(`Could not create the plan: ${reason(error)}`, 'risk');
    }
  }, [qc, projectId]);
}

/** `(roomId, patch) => void`: optimistic + autosave; overlaps are only a warning (AC-08.3). */
export function useEditRoom(projectId: string): (roomId: string, patch: Partial<Room>) => void {
  const qc = useQueryClient();
  return useCallback(
    (roomId, patch) =>
      autosaveEdit<Room>(
        qc,
        {
          queueKey: planKey.room(roomId),
          cancel: [queryKeys.project(projectId)],
          read: () => {
            const c = read(qc, projectId);
            return c && findRoom(c, roomId);
          },
          write: (p) => updateProjectCache(qc, projectId, (c) => applyRoomPatch(c, roomId, p)),
          send: async (merged) =>
            roomSchema.parse(await apiPatch(`${base(projectId)}/rooms/${seg(roomId)}`, merged, { keepalive: true })),
        },
        patch,
      ),
    [qc, projectId],
  );
}

export function useCreateRoom(projectId: string): (input: CreateRoomInput) => Promise<Room | undefined> {
  const qc = useQueryClient();
  return useCallback(
    async (input) => {
      try {
        const room = roomSchema.parse(await apiPost(`${base(projectId)}/rooms`, input));
        updateProjectCache(qc, projectId, (c) => addRoom(c, room));
        return room;
      } catch (error) {
        showToast(`Could not add the room: ${reason(error)}`, 'risk');
        return undefined;
      }
    },
    [qc, projectId],
  );
}

export function useDeleteRoom(projectId: string): (roomId: string) => Promise<void> {
  const qc = useQueryClient();
  return useCallback(
    async (roomId) => {
      autosaveQueue.discard(planKey.room(roomId));
      const before = read(qc, projectId);
      updateProjectCache(qc, projectId, (c) => removeRoom(c, roomId));
      try {
        await apiDelete(`${base(projectId)}/rooms/${seg(roomId)}`);
      } catch (error) {
        if (before) qc.setQueryData(queryKeys.project(projectId), before);
        showToast(`Could not delete the room: ${reason(error)}`, 'risk');
      }
    },
    [qc, projectId],
  );
}

/** A linked item's own pending qty edit (e.g. from Building materials) wins over the BOQ value. */
const hasOwnQtyEdit = (itemId: string) => autosaveQueue.unconfirmed(cacheKey.item(itemId))?.['qtyMilli'] !== undefined;

interface ComponentBaseline {
  component: BoqComponent;
  /** confirmed qty per linked item, captured before the first optimistic change */
  itemQty: Map<string, number>;
}
// Per `boq:<id>` key, from the first unconfirmed edit until success or rollback (judge constraint 4).
const baselines = new Map<string, ComponentBaseline>();

function setLinkedQty(cache: ProjectCache, itemIds: string[], qtyMilli: number): ProjectCache {
  return applyItemsPatch(
    cache,
    itemIds.filter((id) => !hasOwnQtyEdit(id)).map((id) => ({ id, patch: { qtyMilli } })),
  );
}

/**
 * `(componentId, patch) => void`. A qty edit moves the component and every linked MATERIAL row at once,
 * so Building materials, KPIs and Profitability recalculate from the cache; the API does the same in one
 * transaction (CONTRACTS §5). Failure → component and linked qty roll back + toast.
 */
export function useEditComponent(projectId: string): (componentId: string, patch: Partial<BoqComponent>) => void {
  const qc = useQueryClient();
  return useCallback(
    (componentId, patch) => {
      const key = planKey.component(componentId);
      void qc.cancelQueries({ queryKey: queryKeys.project(projectId) });
      const cache = read(qc, projectId);
      const current = cache && findComponent(cache, componentId);
      if (!cache || !current) return;

      const linked = linkedItemIds(cache, componentId);
      const baseline = baselines.get(key) ?? { component: current, itemQty: new Map<string, number>() };
      if (!autosaveQueue.has(key)) baseline.component = current;
      for (const id of linked) {
        if (!baseline.itemQty.has(id)) baseline.itemQty.set(id, cache.itemsById[id].qtyMilli);
      }
      baselines.set(key, baseline);

      updateProjectCache(qc, projectId, (c) => {
        const next = applyComponentPatch(c, componentId, patch);
        return patch.qtyMilli === undefined ? next : setLinkedQty(next, linked, patch.qtyMilli);
      });

      autosaveQueue.enqueue(key, patch, {
        send: async (merged) =>
          componentUpdateResultSchema.parse(
            await apiPatch(`${base(projectId)}/components/${seg(componentId)}`, merged, { keepalive: true }),
          ),
        onSuccess: ({ component, updatedItemIds }) => {
          const newer = autosaveQueue.unconfirmed(key) as Partial<BoqComponent> | undefined;
          if (!newer) baselines.delete(key);
          else baselines.set(key, { component, itemQty: new Map() });
          updateProjectCache(qc, projectId, (c) => {
            const next = applyComponentPatch(c, componentId, { ...component, ...newer });
            // a newer qty is already in the cache and will be confirmed by its own save
            return newer?.qtyMilli !== undefined ? next : setLinkedQty(next, updatedItemIds, component.qtyMilli);
          });
          invalidateRollups(qc);
        },
        rollback: () => {
          const saved = baselines.get(key);
          baselines.delete(key);
          if (!saved) return;
          updateProjectCache(qc, projectId, (c) => {
            const optimisticQty = findComponent(c, componentId)?.qtyMilli;
            const restored = applyComponentPatch(c, componentId, saved.component);
            const items = [...saved.itemQty]
              // only rows that still show our optimistic value; other edits are left alone
              .filter(([id]) => c.itemsById[id]?.qtyMilli === optimisticQty && !hasOwnQtyEdit(id))
              .map(([id, qtyMilli]) => ({ id, patch: { qtyMilli } }));
            return applyItemsPatch(restored, items);
          });
        },
      });
    },
    [qc, projectId],
  );
}

export function useCreateComponent(
  projectId: string,
): (input: CreateBoqComponentInput) => Promise<BoqComponent | undefined> {
  const qc = useQueryClient();
  return useCallback(
    async (input) => {
      try {
        const component = boqComponentSchema.parse(await apiPost(`${base(projectId)}/components`, input));
        updateProjectCache(qc, projectId, (c) => addComponent(c, component));
        return component;
      } catch (error) {
        showToast(`Could not add the component: ${reason(error)}`, 'risk');
        return undefined;
      }
    },
    [qc, projectId],
  );
}

export function useDeleteComponent(projectId: string): (componentId: string) => Promise<void> {
  const qc = useQueryClient();
  return useCallback(
    async (componentId) => {
      autosaveQueue.discard(planKey.component(componentId));
      const before = read(qc, projectId);
      updateProjectCache(qc, projectId, (c) => removeComponent(c, componentId));
      try {
        await apiDelete(`${base(projectId)}/components/${seg(componentId)}`);
        invalidateRollups(qc);
      } catch (error) {
        if (before) qc.setQueryData(queryKeys.project(projectId), before);
        showToast(`Could not delete the component: ${reason(error)}`, 'risk');
      }
    },
    [qc, projectId],
  );
}
