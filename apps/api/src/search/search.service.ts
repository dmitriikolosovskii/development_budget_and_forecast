import { Injectable } from '@nestjs/common';
import type {
  CostCategory,
  SearchResult,
  SearchResultType,
} from '@default-project/types';
import { PrismaService } from '../prisma/prisma.service';
import { fold } from './fold';
import {
  itemHref,
  lineHref,
  organizationHref,
  projectHref,
} from './search-href';

export const SEARCH_LIMIT_PER_TYPE = 8;
export const SEARCH_LIMIT_TOTAL = 30;

const CATEGORY_LABEL: Record<CostCategory, string> = {
  LAND: 'Land',
  ARCHITECTURE: 'Architecture',
  MATERIALS: 'Building materials',
  CONSTRUCTION: 'Construction',
  MARKETING: 'Marketing',
};

const ROLE_LABEL: Record<string, string> = {
  SUPPLIER: 'Supplier',
  CONTRACTOR: 'Contractor',
  CONSULTANT: 'Consultant',
  AGENCY: 'Agency',
  AUTHORITY: 'Authority',
};

interface Candidate {
  result: SearchResult;
  rank: number;
  /** Position of the result's project in createdAt order (0 for organisations). */
  projectOrder: number;
}

/**
 * 0 exact title, 1 title prefix, 2 title contains, 3 another field contains, null no match.
 * Matching is done in JS: SQLite LIKE folds case for ASCII only and never folds diacritics.
 */
function rankMatch(
  needle: string,
  title: string,
  others: Array<string | null>,
): number | null {
  const t = fold(title);
  if (t === needle) return 0;
  if (t.startsWith(needle)) return 1;
  if (t.includes(needle)) return 2;
  return others.some((o) => o !== null && fold(o).includes(needle)) ? 3 : null;
}

function byRelevance(a: Candidate, b: Candidate): number {
  return (
    a.rank - b.rank ||
    a.projectOrder - b.projectOrder ||
    a.result.title.localeCompare(b.result.title) ||
    (a.result.id < b.result.id ? -1 : a.result.id > b.result.id ? 1 : 0)
  );
}

function top(candidates: Candidate[]): SearchResult[] {
  return candidates
    .sort(byRelevance)
    .slice(0, SEARCH_LIMIT_PER_TYPE)
    .map((c) => c.result);
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** `q` is already trimmed and 2..64 characters long (SearchQueryDto). */
  async search(q: string): Promise<SearchResult[]> {
    const needle = fold(q.trim());
    const [projects, items, organizations, lines] = await Promise.all([
      this.prisma.project.findMany({
        where: { isTemplate: false },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          clientName: true,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.costItem.findMany({
        where: { project: { isTemplate: false } },
        select: {
          id: true,
          projectId: true,
          code: true,
          name: true,
          description: true,
          supplierId: true,
          contractorId: true,
          budgetLine: { select: { category: true, section: true, name: true } },
        },
      }),
      this.prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          role: true,
          contactPerson: true,
          city: true,
          email: true,
        },
      }),
      this.prisma.budgetLine.findMany({
        where: { project: { isTemplate: false } },
        select: {
          id: true,
          projectId: true,
          category: true,
          section: true,
          name: true,
        },
      }),
    ]);

    const projectOrder = new Map(projects.map((p, i) => [p.id, i]));
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const orderOf = (projectId: string) =>
      projectOrder.get(projectId) ?? Number.MAX_SAFE_INTEGER;

    // Organisation → first non-template project (createdAt, id) that has its rows.
    const orgProject = new Map<string, string>();
    for (const item of items) {
      for (const orgId of [item.supplierId, item.contractorId]) {
        if (!orgId) continue;
        const current = orgProject.get(orgId);
        if (current === undefined || orderOf(item.projectId) < orderOf(current))
          orgProject.set(orgId, item.projectId);
      }
    }

    const groups: Record<SearchResultType, Candidate[]> = {
      project: [],
      item: [],
      organization: [],
      line: [],
    };

    projects.forEach((p, i) => {
      const rank = rankMatch(needle, p.name, [p.code, p.city, p.clientName]);
      if (rank === null) return;
      groups.project.push({
        rank,
        projectOrder: i,
        result: {
          type: 'project',
          id: p.id,
          projectId: p.id,
          title: p.name,
          subtitle: `${p.code} · ${p.city} · ${p.clientName}`,
          href: projectHref(p.id),
        },
      });
    });

    for (const item of items) {
      const rank = rankMatch(needle, item.name, [item.code, item.description]);
      if (rank === null) continue;
      const { category, section, name: lineName } = item.budgetLine;
      groups.item.push({
        rank,
        projectOrder: orderOf(item.projectId),
        result: {
          type: 'item',
          id: item.id,
          projectId: item.projectId,
          title: item.name,
          subtitle: `${item.code} · ${lineName} · ${projectName.get(item.projectId) ?? ''}`,
          href: itemHref(
            item.projectId,
            category as CostCategory,
            section,
            item.id,
          ),
        },
      });
    }

    for (const org of organizations) {
      const rank = rankMatch(needle, org.name, [
        org.contactPerson,
        org.city,
        org.email,
      ]);
      if (rank === null) continue;
      const projectId = orgProject.get(org.id) ?? null;
      groups.organization.push({
        rank,
        projectOrder: 0,
        result: {
          type: 'organization',
          id: org.id,
          ...(projectId ? { projectId } : {}),
          title: org.name,
          subtitle: `${ROLE_LABEL[org.role] ?? org.role} · ${org.city} · ${org.contactPerson}`,
          href: organizationHref(org.id, projectId, org.name),
        },
      });
    }

    for (const line of lines) {
      const rank = rankMatch(needle, line.name, [line.section]);
      if (rank === null) continue;
      const category = line.category as CostCategory;
      groups.line.push({
        rank,
        projectOrder: orderOf(line.projectId),
        result: {
          type: 'line',
          id: line.id,
          projectId: line.projectId,
          title: line.name,
          subtitle: `${CATEGORY_LABEL[category]} · ${projectName.get(line.projectId) ?? ''}`,
          href: lineHref(line.projectId, category, line.section),
        },
      });
    }

    return [
      ...top(groups.project),
      ...top(groups.item),
      ...top(groups.organization),
      ...top(groups.line),
    ].slice(0, SEARCH_LIMIT_TOTAL);
  }
}
