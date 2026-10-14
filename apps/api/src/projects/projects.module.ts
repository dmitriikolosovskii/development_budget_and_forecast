import { Module } from '@nestjs/common';
import { ProjectCopyService } from './project-copy.service';
import { ProjectScopeService } from './project-scope.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectCopyService, ProjectScopeService],
  exports: [ProjectsService, ProjectCopyService, ProjectScopeService],
})
export class ProjectsModule {}
