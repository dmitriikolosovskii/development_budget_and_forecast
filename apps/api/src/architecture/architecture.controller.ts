import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import type { ArchitecturePlan, BoqComponent, Room } from '@prisma/client';
import {
  ArchitectureService,
  type ComponentUpdateResult,
} from './architecture.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateComponentDto } from './dto/update-component.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Controller('projects/:projectId/plan')
export class ArchitectureController {
  constructor(private readonly architecture: ArchitectureService) {}

  @Patch()
  updatePlan(
    @Param('projectId') projectId: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<ArchitecturePlan> {
    return this.architecture.updatePlan(projectId, dto);
  }

  @Post('rooms')
  createRoom(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRoomDto,
  ): Promise<Room> {
    return this.architecture.createRoom(projectId, dto);
  }

  @Patch('rooms/:roomId')
  updateRoom(
    @Param('projectId') projectId: string,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<Room> {
    return this.architecture.updateRoom(projectId, roomId, dto);
  }

  @Delete('rooms/:roomId')
  removeRoom(
    @Param('projectId') projectId: string,
    @Param('roomId') roomId: string,
  ): Promise<Room> {
    return this.architecture.removeRoom(projectId, roomId);
  }

  @Post('components')
  createComponent(
    @Param('projectId') projectId: string,
    @Body() dto: CreateComponentDto,
  ): Promise<BoqComponent> {
    return this.architecture.createComponent(projectId, dto);
  }

  @Patch('components/:componentId')
  updateComponent(
    @Param('projectId') projectId: string,
    @Param('componentId') componentId: string,
    @Body() dto: UpdateComponentDto,
  ): Promise<ComponentUpdateResult> {
    return this.architecture.updateComponent(projectId, componentId, dto);
  }

  @Delete('components/:componentId')
  removeComponent(
    @Param('projectId') projectId: string,
    @Param('componentId') componentId: string,
  ): Promise<BoqComponent> {
    return this.architecture.removeComponent(projectId, componentId);
  }
}
