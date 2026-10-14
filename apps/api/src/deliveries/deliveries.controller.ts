import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Delivery } from '@prisma/client';
import type { ImportResult } from '@default-project/types';
import { DeliveriesService } from './deliveries.service';
import { ImportDeliveriesDto } from './dto/import-deliveries.dto';

@Controller('projects/:projectId/deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  list(@Param('projectId') projectId: string): Promise<Delivery[]> {
    return this.deliveries.list(projectId);
  }

  @Post('import')
  import(
    @Param('projectId') projectId: string,
    @Body() dto: ImportDeliveriesDto,
  ): Promise<ImportResult> {
    return this.deliveries.import(projectId, dto);
  }
}
