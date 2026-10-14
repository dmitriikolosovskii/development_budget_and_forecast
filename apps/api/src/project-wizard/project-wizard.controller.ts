import { Body, Controller, Get, Post } from '@nestjs/common';
import type { WizardInput } from '@default-project/types';
import type { SnapshotResponse } from '../projects/projects.service';
import { WizardInputDto } from './dto/wizard-input.dto';
import { ProjectWizardService } from './project-wizard.service';

/** Two-segment routes only: a bare `GET /projects/wizard` would be captured by `GET /projects/:id`. */
@Controller('projects/wizard')
export class ProjectWizardController {
  constructor(private readonly wizard: ProjectWizardService) {}

  @Get('template')
  template(): Promise<SnapshotResponse> {
    return this.wizard.template();
  }

  @Post()
  create(@Body() dto: WizardInputDto): Promise<SnapshotResponse> {
    return this.wizard.create(dto as WizardInput);
  }
}
