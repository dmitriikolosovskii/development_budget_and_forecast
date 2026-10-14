import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import type { CostItem } from '@prisma/client';
import { CostItemsService } from './cost-items.service';
import { CreateCostItemDto } from './dto/create-cost-item.dto';
import { UpdateCostItemDto } from './dto/update-cost-item.dto';

@Controller('projects/:projectId/items')
export class CostItemsController {
  constructor(private readonly items: CostItemsService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCostItemDto,
  ): Promise<CostItem> {
    return this.items.create(projectId, dto);
  }

  @Patch(':itemId')
  update(
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCostItemDto,
  ): Promise<CostItem> {
    return this.items.update(projectId, itemId, dto);
  }

  @Delete(':itemId')
  remove(
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
  ): Promise<CostItem> {
    return this.items.remove(projectId, itemId);
  }
}
