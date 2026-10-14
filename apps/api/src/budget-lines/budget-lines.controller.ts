import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import type { BudgetLine } from '@prisma/client';
import { BudgetLinesService } from './budget-lines.service';
import {
  CreateBudgetLineDto,
  UpdateBudgetLineDto,
} from './dto/budget-line.dto';

@Controller('projects/:projectId/budget-lines')
export class BudgetLinesController {
  constructor(private readonly lines: BudgetLinesService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBudgetLineDto,
  ): Promise<BudgetLine> {
    return this.lines.create(projectId, dto);
  }

  @Patch(':lineId')
  update(
    @Param('projectId') projectId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateBudgetLineDto,
  ): Promise<BudgetLine> {
    return this.lines.update(projectId, lineId, dto);
  }

  @Delete(':lineId')
  remove(
    @Param('projectId') projectId: string,
    @Param('lineId') lineId: string,
  ): Promise<BudgetLine> {
    return this.lines.remove(projectId, lineId);
  }
}
