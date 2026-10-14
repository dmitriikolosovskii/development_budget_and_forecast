import {
  BUDGET_CATALOG,
  type Profitability,
  type Summary,
} from '@default-project/types';
import {
  computeProfitability,
  summarizeProject,
} from '@default-project/budget-engine';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Organization, Prisma, Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import {
  CreateProjectDto,
  DuplicateProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectCopyService } from './project-copy.service';

const snapshotInclude = {
  budgetLines: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
  items: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] },
  land: { include: { utilities: { orderBy: { type: 'asc' } } } },
  plan: {
    include: {
      rooms: { orderBy: [{ floor: 'asc' }, { sortOrder: 'asc' }] },
      components: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] },
    },
  },
  deliveries: { orderBy: [{ date: 'asc' }, { deliveryNoteNo: 'asc' }] },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof snapshotInclude;
}>;

/** Prisma-typed `ProjectSnapshot` (Dates serialise to the ISO strings of the zod wire type). */
export interface SnapshotResponse {
  project: Project;
  budgetLines: ProjectWithRelations['budgetLines'];
  items: ProjectWithRelations['items'];
  organizations: Organization[];
  land: ProjectWithRelations['land'];
  plan: ProjectWithRelations['plan'];
  deliveries: ProjectWithRelations['deliveries'];
}
export type ProjectListRow = Project & {
  summary: Summary;
  profitability: Profitability;
};

function slugify(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, 60) || 'project';
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly copier: ProjectCopyService,
  ) {}

  /** `GET /projects`: non-template projects with the engine rollup, in one query. */
  async findAll(): Promise<ProjectListRow[]> {
    const rows = await this.prisma.project.findMany({
      where: { isTemplate: false },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
      include: { budgetLines: true, items: true },
    });
    return rows.map(({ budgetLines, items, ...project }) => {
      const { project: summary } = summarizeProject({ budgetLines, items });
      return {
        ...project,
        summary,
        profitability: computeProfitability(summary, project.markupBps),
      };
    });
  }

  /** `GET /projects/:id`: one query with `include` + one for the referenced organisations. */
  async getSnapshot(id: string): Promise<SnapshotResponse> {
    const row = await this.prisma.project.findUnique({
      where: { id },
      include: snapshotInclude,
    });
    if (!row) throw new NotFoundException(`Project ${id} not found`);
    const { budgetLines, items, land, plan, deliveries, ...project } = row;
    const orgIds = new Set<string>();
    for (const i of items) {
      if (i.supplierId) orgIds.add(i.supplierId);
      if (i.contractorId) orgIds.add(i.contractorId);
    }
    if (plan?.architectOrgId) orgIds.add(plan.architectOrgId);
    const organizations = orgIds.size
      ? await this.prisma.organization.findMany({
          where: { id: { in: [...orgIds] } },
          orderBy: { name: 'asc' },
        })
      : [];
    return {
      project,
      budgetLines,
      items,
      organizations,
      land,
      plan,
      deliveries,
    };
  }

  /** `POST /projects`: an empty project with every catalogue line at approved 0. */
  async create(dto: CreateProjectDto): Promise<SnapshotResponse> {
    this.assertDateRange(dto.startDate, dto.endDate);
    const base = slugify(dto.name);
    for (let n = 1; n <= 20; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      try {
        const project = await this.prisma.project.create({
          data: {
            ...dto,
            slug,
            budgetLines: {
              create: BUDGET_CATALOG.map((s) => ({
                category: s.category,
                section: s.section,
                name: s.name,
                sortOrder: s.sortOrder,
                approvedCents: 0,
              })),
            },
          },
        });
        this.logger.log(`Created project ${slug}`);
        return this.getSnapshot(project.id);
      } catch (error) {
        if (!isUniqueViolation(error, 'slug')) throw error;
      }
    }
    throw new ConflictException(
      `Could not allocate a unique slug for "${dto.name}"`,
    );
  }

  /** `PATCH /projects/:id` */
  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Project ${id} not found`);
    this.assertDateRange(
      dto.startDate ?? existing.startDate,
      dto.endDate ?? existing.endDate,
    );
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  /** `POST /projects/:id/duplicate` */
  async duplicate(
    id: string,
    dto: DuplicateProjectDto,
  ): Promise<SnapshotResponse> {
    const newId = await this.copier.duplicate(id, { name: dto.name });
    return this.getSnapshot(newId);
  }

  private assertDateRange(startDate: string, endDate: string): void {
    if (endDate < startDate)
      throw new BadRequestException('endDate must not be before startDate');
  }
}
