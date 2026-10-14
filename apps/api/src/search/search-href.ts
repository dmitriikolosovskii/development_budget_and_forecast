import type { CostCategory } from '@default-project/types';

/** Project tab per budget category (mirrors the web tabs-config / lineHref). */
const CATEGORY_TAB: Record<CostCategory, string> = {
  LAND: 'land',
  ARCHITECTURE: 'architecture',
  MATERIALS: 'materials',
  CONSTRUCTION: 'construction',
  MARKETING: 'marketing',
};

/** Only these tabs have a `:section` route segment. */
const SECTIONED: ReadonlySet<CostCategory> = new Set<CostCategory>([
  'MATERIALS',
  'CONSTRUCTION',
  'MARKETING',
]);

const enc = encodeURIComponent;

export function projectHref(projectId: string): string {
  return `/projects/${enc(projectId)}`;
}

export function lineHref(
  projectId: string,
  category: CostCategory,
  section: string,
): string {
  const base = `${projectHref(projectId)}/${CATEGORY_TAB[category]}`;
  return SECTIONED.has(category) ? `${base}/${enc(section)}` : base;
}

/** `?highlight=` is handled by EditableTable (scroll + flash). */
export function itemHref(
  projectId: string,
  category: CostCategory,
  section: string,
  itemId: string,
): string {
  return `${lineHref(projectId, category, section)}?highlight=${enc(itemId)}`;
}

/** `?org=` is handled by the ProjectPage layout on any tab; with no project the search page is the fallback. */
export function organizationHref(
  orgId: string,
  projectId: string | null,
  name: string,
): string {
  if (projectId) return `${projectHref(projectId)}/materials?org=${enc(orgId)}`;
  return `/search?q=${enc(name.trim().slice(0, 64))}`;
}
