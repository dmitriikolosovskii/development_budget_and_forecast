import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BudgetLine } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { ProjectScopeService } from '../projects/project-scope.service';
import {
  CreateBudgetLineDto,
  UpdateBudgetLineDto,
} from './dto/budget-line.dto';

@Injectable()
export class BudgetLinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
  ) {}

  async create(
    projectId: string,
    dto: CreateBudgetLineDto,
  ): Promise<BudgetLine> {
    await this.scope.assertProject(projectId);
    try {
      return await this.prisma.budgetLine.create({
        data: { approvedCents: 0, ...dto, projectId },
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          `Line ${dto.category}/${dto.section} already exists`,
        );
      throw error;
    }
  }

  async update(
    projectId: string,
    lineId: string,
    dto: UpdateBudgetLineDto,
  ): Promise<BudgetLine> {
    await this.findInProject(projectId, lineId);
    return this.prisma.budgetLine.update({ where: { id: lineId }, data: dto });
  }

  /** Owner's rule (2026-10-14): a line that still has rows is never deleted, so no costs vanish from totals. */
  async remove(projectId: string, lineId: string): Promise<BudgetLine> {
    await this.findInProject(projectId, lineId);
    const rows = await this.prisma.costItem.count({
      where: { budgetLineId: lineId },
    });
    if (rows > 0)
      throw new ConflictException(
        `Line still has ${rows} item(s): move or delete them first`,
      );
    return this.prisma.budgetLine.delete({ where: { id: lineId } });
  }

  private async findInProject(
    projectId: string,
    lineId: string,
  ): Promise<BudgetLine> {
    const line = await this.prisma.budgetLine.findFirst({
      where: { id: lineId, projectId },
    });
    if (!line)
      throw new NotFoundException(
        `Budget line ${lineId} not found in project ${projectId}`,
      );
    return line;
  }
}
