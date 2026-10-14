import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectWizardController } from './project-wizard.controller';
import { ProjectWizardService } from './project-wizard.service';

/** Registered in AppModule before ProjectsModule (block 01). */
@Module({
  imports: [ProjectsModule],
  controllers: [ProjectWizardController],
  providers: [ProjectWizardService],
})
export class ProjectWizardModule {}
