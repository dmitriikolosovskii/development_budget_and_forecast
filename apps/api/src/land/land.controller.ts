import { Body, Controller, Param, ParseEnumPipe, Patch } from '@nestjs/common';
import {
  UtilityType,
  type LandParcel,
  type UtilityConnection,
} from '@prisma/client';
import { UpdateLandDto } from './dto/update-land.dto';
import { UpdateUtilityDto } from './dto/update-utility.dto';
import { LandService } from './land.service';

@Controller('projects/:projectId/land')
export class LandController {
  constructor(private readonly land: LandService) {}

  @Patch()
  update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateLandDto,
  ): Promise<LandParcel> {
    return this.land.updateLand(projectId, dto);
  }

  @Patch('utilities/:type')
  upsertUtility(
    @Param('projectId') projectId: string,
    @Param('type', new ParseEnumPipe(UtilityType)) type: UtilityType,
    @Body() dto: UpdateUtilityDto,
  ): Promise<UtilityConnection> {
    return this.land.upsertUtility(projectId, type, dto);
  }
}
