import type { BudgetLine, CostItem, Organization, Project, ProjectSnapshot } from '@default-project/types';

/**
 * The cached form of `GET /projects/:id` (CONTRACTS §6). Indices are plain objects/arrays so
 * TanStack's structural sharing keeps the identity of untouched rows and id lists.
 */
export interface ProjectCache extends ProjectSnapshot {
  itemsById: Record<string, CostItem>;
  itemIdsByLineId: Record<string, string[]>;
  linesById: Record<string, BudgetLine>;
  orgsById: Record<string, Organization>;
}

type Patch<T> = Partial<T>;

const byOrder = (a: CostItem, b: CostItem) =>
  a.sortOrder - b.sortOrder || a.code.localeCompare(b.code) || a.id.localeCompare(b.id);

function idsForLine(items: CostItem[], lineId: string): string[] {
  return items.filter((i) => i.budgetLineId === lineId).sort(byOrder).map((i) => i.id);
}

function indexBy<T extends { id: string }>(rows: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const r of rows) out[r.id] = r;
  return out;
}

export function normalise(snapshot: ProjectSnapshot): ProjectCache {
  const itemIdsByLineId: Record<string, string[]> = {};
  for (const line of snapshot.budgetLines) itemIdsByLineId[line.id] = [];
  for (const item of [...snapshot.items].sort(byOrder)) {
    (itemIdsByLineId[item.budgetLineId] ??= []).push(item.id);
  }
  return {
    ...snapshot,
    itemsById: indexBy(snapshot.items),
    itemIdsByLineId,
    linesById: indexBy(snapshot.budgetLines),
    orgsById: indexBy(snapshot.organizations),
  };
}

/** Recomputes the id lists of the given lines; other lines keep their array identity. */
function withLineIds(cache: ProjectCache, items: CostItem[], lineIds: string[]): Record<string, string[]> {
  const next = { ...cache.itemIdsByLineId };
  for (const lineId of new Set(lineIds)) next[lineId] = idsForLine(items, lineId);
  return next;
}

/** Replaces one row; every other row, line and id list keeps its reference. */
export function applyItemPatch(cache: ProjectCache, itemId: string, patch: Patch<CostItem>): ProjectCache {
  const prev = cache.itemsById[itemId];
  if (!prev) return cache;
  const next = { ...prev, ...patch, id: prev.id };
  const items = cache.items.map((i) => (i.id === itemId ? next : i));
  const reorder =
    prev.budgetLineId !== next.budgetLineId || prev.sortOrder !== next.sortOrder || prev.code !== next.code;
  return {
    ...cache,
    items,
    itemsById: { ...cache.itemsById, [itemId]: next },
    itemIdsByLineId: reorder
      ? withLineIds(cache, items, [prev.budgetLineId, next.budgetLineId])
      : cache.itemIdsByLineId,
  };
}

export function upsertItem(cache: ProjectCache, item: CostItem): ProjectCache {
  if (cache.itemsById[item.id]) return applyItemPatch(cache, item.id, item);
  const items = [...cache.items, item];
  return {
    ...cache,
    items,
    itemsById: { ...cache.itemsById, [item.id]: item },
    itemIdsByLineId: withLineIds(cache, items, [item.budgetLineId]),
  };
}

/** Removes a row; materials that pointed at it lose `requiredForWorkId` (mirrors `onDelete: SetNull`). */
export function removeItem(cache: ProjectCache, itemId: string): ProjectCache {
  const prev = cache.itemsById[itemId];
  if (!prev) return cache;
  const itemsById = { ...cache.itemsById };
  delete itemsById[itemId];
  const items: CostItem[] = [];
  for (const i of cache.items) {
    if (i.id === itemId) continue;
    if (i.requiredForWorkId === itemId) {
      const unlinked = { ...i, requiredForWorkId: null };
      itemsById[i.id] = unlinked;
      items.push(unlinked);
    } else {
      items.push(i);
    }
  }
  return { ...cache, items, itemsById, itemIdsByLineId: withLineIds(cache, items, [prev.budgetLineId]) };
}

/** Swaps an optimistic temp row for the server row. */
export function replaceItem(cache: ProjectCache, tempId: string, item: CostItem): ProjectCache {
  return upsertItem(removeItem(cache, tempId), item);
}

export function applyLinePatch(cache: ProjectCache, lineId: string, patch: Patch<BudgetLine>): ProjectCache {
  const prev = cache.linesById[lineId];
  if (!prev) return cache;
  const next = { ...prev, ...patch, id: prev.id };
  return {
    ...cache,
    budgetLines: cache.budgetLines.map((l) => (l.id === lineId ? next : l)),
    linesById: { ...cache.linesById, [lineId]: next },
  };
}

export function applyProjectPatch(cache: ProjectCache, patch: Patch<Project>): ProjectCache {
  return { ...cache, project: { ...cache.project, ...patch, id: cache.project.id } };
}

export function applyOrgPatch(cache: ProjectCache, orgId: string, patch: Patch<Organization>): ProjectCache {
  const prev = cache.orgsById[orgId];
  if (!prev) return cache;
  const next = { ...prev, ...patch, id: prev.id };
  return {
    ...cache,
    organizations: cache.organizations.map((o) => (o.id === orgId ? next : o)),
    orgsById: { ...cache.orgsById, [orgId]: next },
  };
}

/** Autosave queue keys: `item:<id>`, `line:<id>`, `project:<id>`, `org:<id>`. */
export const cacheKey = {
  item: (id: string) => `item:${id}`,
  line: (id: string) => `line:${id}`,
  project: (id: string) => `project:${id}`,
  org: (id: string) => `org:${id}`,
};

/** Re-applies unconfirmed autosave patches on top of freshly fetched data (refetch overlay). */
export function overlayUnconfirmed(
  cache: ProjectCache,
  entries: Array<[string, Record<string, unknown>]>,
): ProjectCache {
  let out = cache;
  for (const [key, patch] of entries) {
    const sep = key.indexOf(':');
    const kind = key.slice(0, sep);
    const id = key.slice(sep + 1);
    if (kind === 'item') out = applyItemPatch(out, id, patch);
    else if (kind === 'line') out = applyLinePatch(out, id, patch);
    else if (kind === 'project' && id === out.project.id) out = applyProjectPatch(out, patch);
    else if (kind === 'org') out = applyOrgPatch(out, id, patch);
  }
  return out;
}

/** Patches several rows in one pass (e.g. a BOQ quantity that drives every linked item). */
export function applyItemsPatch(
  cache: ProjectCache,
  patches: Array<{ id: string; patch: Patch<CostItem> }>,
): ProjectCache {
  return patches.reduce((c, { id, patch }) => applyItemPatch(c, id, patch), cache);
}
