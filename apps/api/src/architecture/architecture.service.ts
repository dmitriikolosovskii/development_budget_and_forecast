import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ArchitecturePlan,
  BoqComponent,
  Prisma,
  Room,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { ProjectScopeService } from '../projects/project-scope.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateComponentDto } from './dto/update-component.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

/** `PATCH /plan/components/:id` response: the linked MATERIAL rows whose qty followed the component. */
export interface ComponentUpdateResult {
  component: BoqComponent;
  updatedItemIds: string[];
}

/** Defaults for the first `PATCH /plan` of a project without a plan: the Stadtvilla of GERMANY-DATA §2. */
const PLAN_DEFAULTS: Omit<
  Prisma.ArchitecturePlanUncheckedCreateInput,
  'projectId'
> = {
  name: 'Detached house — family of 4',
  style: 'Stadtvilla',
  storeys: 2,
  roofType: 'Pyramid roof',
  roofPitchDeg: 22,
  energyStandard: 'KfW EH 55 / GEG 2024',
  heatingSystem: 'Air-source heat pump + underfloor heating',
  occupants: 4,
  footprintWidthCm: 1000,
  footprintDepthCm: 900,
  siteOffsetXcm: 800,
  siteOffsetYcm: 400,
};

@Injectable()
export class ArchitectureService {
  private readonly logger = new Logger(ArchitectureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
  ) {}

  async updatePlan(
    projectId: string,
    dto: UpdatePlanDto,
  ): Promise<ArchitecturePlan> {
    await this.scope.assertProject(projectId);
    await this.scope.assertOrganizations([dto.architectOrgId]);
    return this.prisma.architecturePlan.upsert({
      where: { projectId },
      update: dto,
      create: { ...PLAN_DEFAULTS, ...dto, projectId },
    });
  }

  async createRoom(projectId: string, dto: CreateRoomDto): Promise<Room> {
    const planId = await this.planIdOf(projectId);
    return this.unique(`Room code ${dto.code}`, () =>
      this.prisma.room.create({ data: { ...dto, planId } }),
    );
  }

  async updateRoom(
    projectId: string,
    roomId: string,
    dto: UpdateRoomDto,
  ): Promise<Room> {
    await this.roomInProject(projectId, roomId);
    return this.unique(`Room code ${dto.code}`, () =>
      this.prisma.room.update({ where: { id: roomId }, data: dto }),
    );
  }

  async removeRoom(projectId: string, roomId: string): Promise<Room> {
    await this.roomInProject(projectId, roomId);
    return this.prisma.room.delete({ where: { id: roomId } });
  }

  async createComponent(
    projectId: string,
    dto: CreateComponentDto,
  ): Promise<BoqComponent> {
    const planId = await this.planIdOf(projectId);
    return this.unique(`Component code ${dto.code}`, () =>
      this.prisma.boqComponent.create({ data: { ...dto, planId } }),
    );
  }

  /** A qty change is copied to every linked CostItem in the same transaction (CONTRACTS §5). */
  async updateComponent(
    projectId: string,
    componentId: string,
    dto: UpdateComponentDto,
  ): Promise<ComponentUpdateResult> {
    await this.componentInProject(projectId, componentId);
    return this.unique(`Component code ${dto.code}`, () =>
      this.prisma.$transaction(async (tx) => {
        const component = await tx.boqComponent.update({
          where: { id: componentId },
          data: dto,
        });
        if (dto.qtyMilli === undefined)
          return { component, updatedItemIds: [] };
        const linked = await tx.costItem.findMany({
          where: { boqComponentId: componentId },
          select: { id: true },
        });
        await tx.costItem.updateMany({
          where: { boqComponentId: componentId },
          data: { qtyMilli: dto.qtyMilli },
        });
        this.logger.log(
          `Component ${componentId}: qty ${dto.qtyMilli} → ${linked.length} linked item(s)`,
        );
        return { component, updatedItemIds: linked.map((i) => i.id) };
      }),
    );
  }

  /** Linked items keep their rows; the schema sets their `boqComponentId` to null. */
  async removeComponent(
    projectId: string,
    componentId: string,
  ): Promise<BoqComponent> {
    await this.componentInProject(projectId, componentId);
    return this.prisma.boqComponent.delete({ where: { id: componentId } });
  }

  private async planIdOf(projectId: string): Promise<string> {
    const plan = await this.prisma.architecturePlan.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!plan)
      throw new NotFoundException(`Project ${projectId} has no plan`);
    return plan.id;
  }

  private async roomInProject(projectId: string, roomId: string): Promise<void> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, plan: { projectId } },
      select: { id: true },
    });
    if (!room)
      throw new NotFoundException(
        `Room ${roomId} not found in project ${projectId}`,
      );
  }

  private async componentInProject(
    projectId: string,
    componentId: string,
  ): Promise<void> {
    const component = await this.prisma.boqComponent.findFirst({
      where: { id: componentId, plan: { projectId } },
      select: { id: true },
    });
    if (!component)
      throw new NotFoundException(
        `Component ${componentId} not found in project ${projectId}`,
      );
  }

  private async unique<T>(what: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`${what} already exists in this plan`);
      throw error;
    }
  }
}
