import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { Project } from '@prisma/client';
import {
  CreateProjectDto,
  DuplicateProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';
import {
  ProjectsService,
  type ProjectListRow,
  type SnapshotResponse,
} from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll(): Promise<ProjectListRow[]> {
    return this.projects.findAll();
  }

  @Get(':id')
  getSnapshot(@Param('id') id: string): Promise<SnapshotResponse> {
    return this.projects.getSnapshot(id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto): Promise<SnapshotResponse> {
    return this.projects.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<Project> {
    return this.projects.update(id, dto);
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateProjectDto,
  ): Promise<SnapshotResponse> {
    return this.projects.duplicate(id, dto);
  }
}
