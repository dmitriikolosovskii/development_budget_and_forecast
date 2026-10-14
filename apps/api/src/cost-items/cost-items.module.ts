import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { CostItemsController } from './cost-items.controller';
import { CostItemsService } from './cost-items.service';

@Module({
  imports: [ProjectsModule],
  controllers: [CostItemsController],
  providers: [CostItemsService],
})
export class CostItemsModule {}
