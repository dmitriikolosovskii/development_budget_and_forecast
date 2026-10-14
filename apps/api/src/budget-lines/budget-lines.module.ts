import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { BudgetLinesController } from './budget-lines.controller';
import { BudgetLinesService } from './budget-lines.service';

@Module({
  imports: [ProjectsModule],
  controllers: [BudgetLinesController],
  providers: [BudgetLinesService],
})
export class BudgetLinesModule {}
