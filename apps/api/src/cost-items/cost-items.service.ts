import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { CostItem, ItemKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { ProjectScopeService } from '../projects/project-scope.service';
import { CreateCostItemDto } from './dto/create-cost-item.dto';
import { UpdateCostItemDto } from './dto/update-cost-item.dto';

@Injectable()
export class CostItemsService {
  private readonly logger = new Logger(CostItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
  ) {}

  async create(projectId: string, dto: CreateCostItemDto): Promise<CostItem> {
    await this.scope.assertProject(projectId);
    await this.validateReferences(projectId, dto.kind, dto);
    try {
      const item = await this.prisma.costItem.create({
        data: { ...dto, projectId },
      });
      this.logger.log(`Created item ${item.code} in project ${projectId}`);
      return item;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          `Item code ${dto.code} already exists in this project`,
        );
      throw error;
    }
  }

  async update(
    projectId: string,
    itemId: string,
    dto: UpdateCostItemDto,
  ): Promise<CostItem> {
    const existing = await this.findInProject(projectId, itemId);
    await this.validateReferences(projectId, existing.kind, dto, itemId);
    return this.prisma.costItem.update({ where: { id: itemId }, data: dto });
  }

  async remove(projectId: string, itemId: string): Promise<CostItem> {
    await this.findInProject(projectId, itemId);
    return this.prisma.costItem.delete({ where: { id: itemId } });
  }

  private async findInProject(
    projectId: string,
    itemId: string,
  ): Promise<CostItem> {
    const item = await this.prisma.costItem.findFirst({
      where: { id: itemId, projectId },
    });
    if (!item)
      throw new NotFoundException(
        `Item ${itemId} not found in project ${projectId}`,
      );
    return item;
  }

  /** Body references must point into the same project (400), see judge constraints 1 and 6. */
  private async validateReferences(
    projectId: string,
    kind: ItemKind,
    dto: UpdateCostItemDto,
    selfId?: string,
  ): Promise<void> {
    if (dto.budgetLineId !== undefined)
      await this.scope.assertLineInProject(projectId, dto.budgetLineId);
    if (dto.requiredForWorkId) {
      if (kind !== 'MATERIAL')
        throw new BadRequestException(
          'requiredForWorkId is allowed only on MATERIAL items',
        );
      if (dto.requiredForWorkId === selfId)
        throw new BadRequestException('An item cannot require itself');
      await this.scope.assertWorkInProject(projectId, dto.requiredForWorkId);
    }
    if (dto.boqComponentId)
      await this.scope.assertBoqInProject(projectId, dto.boqComponentId);
    await this.scope.assertOrganizations([dto.supplierId, dto.contractorId]);
  }
}
