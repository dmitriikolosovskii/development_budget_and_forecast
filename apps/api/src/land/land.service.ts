import { Injectable } from '@nestjs/common';
import type {
  LandParcel,
  UtilityConnection,
  UtilityType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { ProjectScopeService } from '../projects/project-scope.service';
import { UpdateLandDto } from './dto/update-land.dto';
import { UpdateUtilityDto } from './dto/update-utility.dto';
import { definedOnly, LAND_DEFAULTS } from './land-defaults';

@Injectable()
export class LandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
  ) {}

  /** Partial update; the first PATCH of a project without a parcel creates it from blank defaults. */
  async updateLand(projectId: string, dto: UpdateLandDto): Promise<LandParcel> {
    await this.scope.assertProject(projectId);
    const data = definedOnly(dto);
    try {
      return await this.prisma.landParcel.upsert({
        where: { projectId },
        create: { ...LAND_DEFAULTS, ...data, projectId },
        update: data,
      });
    } catch (error) {
      // A concurrent first PATCH created the parcel between the lookup and the insert.
      if (!isUniqueViolation(error)) throw error;
      return this.prisma.landParcel.update({ where: { projectId }, data });
    }
  }

  /** Upsert by `[landId, type]`; creates the parcel first when the project has none. */
  async upsertUtility(
    projectId: string,
    type: UtilityType,
    dto: UpdateUtilityDto,
  ): Promise<UtilityConnection> {
    const land = await this.ensureParcel(projectId);
    const data = definedOnly(dto);
    return this.prisma.utilityConnection.upsert({
      where: { landId_type: { landId: land.id, type } },
      create: {
        ...data,
        status: data.status ?? 'NOT_AVAILABLE',
        landId: land.id,
        type,
      },
      update: data,
    });
  }

  private async ensureParcel(projectId: string): Promise<LandParcel> {
    await this.scope.assertProject(projectId);
    try {
      return await this.prisma.landParcel.upsert({
        where: { projectId },
        create: { ...LAND_DEFAULTS, projectId },
        update: {},
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.prisma.landParcel.findUniqueOrThrow({ where: { projectId } });
    }
  }
}
