import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { LandController } from './land.controller';
import { LandService } from './land.service';

@Module({
  imports: [ProjectsModule],
  controllers: [LandController],
  providers: [LandService],
})
export class LandModule {}
