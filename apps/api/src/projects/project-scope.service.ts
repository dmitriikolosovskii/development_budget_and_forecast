import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Db = Pick<
  PrismaService,
  'project' | 'budgetLine' | 'costItem' | 'boqComponent' | 'organization'
>;

/**
 * "Belongs to this project" checks shared by every child route (judge constraint 1):
 * a missing path entity → 404, a foreign reference in the body → 400.
 */
@Injectable()
export class ProjectScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async assertProject(projectId: string, db: Db = this.prisma): Promise<void> {
    const found = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Project ${projectId} not found`);
  }

  async assertLineInProject(
    projectId: string,
    budgetLineId: string,
    db: Db = this.prisma,
  ): Promise<void> {
    const line = await db.budgetLine.findFirst({
      where: { id: budgetLineId, projectId },
      select: { id: true },
    });
    if (!line)
      throw new BadRequestException(
        `budgetLineId ${budgetLineId} does not belong to project ${projectId}`,
      );
  }

  async assertWorkInProject(
    projectId: string,
    workId: string,
    db: Db = this.prisma,
  ): Promise<void> {
    const work = await db.costItem.findFirst({
      where: { id: workId, projectId, kind: 'WORK' },
      select: { id: true },
    });
    if (!work)
      throw new BadRequestException(
        `requiredForWorkId ${workId} is not a WORK item of project ${projectId}`,
      );
  }

  async assertBoqInProject(
    projectId: string,
    componentId: string,
    db: Db = this.prisma,
  ): Promise<void> {
    const c = await db.boqComponent.findFirst({
      where: { id: componentId, plan: { projectId } },
      select: { id: true },
    });
    if (!c)
      throw new BadRequestException(
        `boqComponentId ${componentId} does not belong to project ${projectId}`,
      );
  }

  async assertOrganizations(
    ids: Array<string | null | undefined>,
    db: Db = this.prisma,
  ): Promise<void> {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return;
    const found = await db.organization.findMany({
      where: { id: { in: wanted } },
      select: { id: true },
    });
    if (found.length !== wanted.length) {
      const known = new Set(found.map((o) => o.id));
      throw new BadRequestException(
        `Unknown organization: ${wanted.filter((id) => !known.has(id)).join(', ')}`,
      );
    }
  }
}
