import { useCallback } from 'react';
import { itemPlannedCents } from '@default-project/budget-engine';
import type { BoqComponent, HouseSection } from '@default-project/types';
import type { ProjectCache } from '../project/project-cache';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { findComponent, type CachedPlan } from './plan-cache';

const selectPlan = (c: ProjectCache): CachedPlan | null => c.plan;

/** The cached plan (rooms + components); `data === null` when the project has no plan. */
export function usePlan(projectId: string) {
  return useProjectSnapshot(projectId, selectPlan);
}

const byOrder = (a: BoqComponent, b: BoqComponent) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code);

/** Ids of one house section's components; the array keeps its identity while the ids do not change. */
export function useComponentIds(projectId: string, section: HouseSection): string[] {
  const select = useCallback(
    (c: ProjectCache) =>
      (c.plan?.components ?? [])
        .filter((x) => x.houseSection === section)
        .sort(byOrder)
        .map((x) => x.id),
    [section],
  );
  return useProjectSnapshot(projectId, select).data ?? EMPTY;
}
const EMPTY: string[] = [];

/** One BOQ row for `EditableTable.useRow`. */
export function useComponent(projectId: string, componentId: string): BoqComponent | undefined {
  const select = useCallback((c: ProjectCache) => findComponent(c, componentId), [componentId]);
  return useProjectSnapshot(projectId, select).data;
}

export interface BoqLink {
  count: number;
  plannedCents: number;
  /** a linked row uses another unit than the component (qty is copied as is, CONTRACTS §5) */
  unitMismatch: boolean;
}

/** Linked MATERIAL rows per component: count and Σ planned (engine rounding per row). */
const selectLinks = (c: ProjectCache): Record<string, BoqLink> => {
  const units = new Map((c.plan?.components ?? []).map((x) => [x.id, x.unit]));
  const out: Record<string, BoqLink> = {};
  for (const item of c.items) {
    if (!item.boqComponentId) continue;
    const link = (out[item.boqComponentId] ??= { count: 0, plannedCents: 0, unitMismatch: false });
    link.count += 1;
    link.plannedCents += itemPlannedCents(item);
    if (units.has(item.boqComponentId) && units.get(item.boqComponentId) !== item.unit) link.unitMismatch = true;
  }
  return out;
};

export function useBoqLink(projectId: string, componentId: string): BoqLink | undefined {
  const select = useCallback((c: ProjectCache) => selectLinks(c)[componentId], [componentId]);
  return useProjectSnapshot(projectId, select).data;
}

/** Planned cost per house section = Σ planned of the MATERIAL rows linked to its components. */
const selectSectionCosts = (c: ProjectCache): Partial<Record<HouseSection, number>> => {
  const links = selectLinks(c);
  const out: Partial<Record<HouseSection, number>> = {};
  for (const comp of c.plan?.components ?? []) {
    out[comp.houseSection] = (out[comp.houseSection] ?? 0) + (links[comp.id]?.plannedCents ?? 0);
  }
  return out;
};

export function useSectionCosts(projectId: string): Partial<Record<HouseSection, number>> | undefined {
  return useProjectSnapshot(projectId, selectSectionCosts).data;
}
