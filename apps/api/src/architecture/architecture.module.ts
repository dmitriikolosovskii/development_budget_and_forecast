import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ArchitectureController } from './architecture.controller';
import { ArchitectureService } from './architecture.service';

@Module({
  imports: [ProjectsModule],
  controllers: [ArchitectureController],
  providers: [ArchitectureService],
})
export class ArchitectureModule {}
