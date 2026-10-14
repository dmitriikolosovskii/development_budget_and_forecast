import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from '../health/health.controller';
import { ProjectsModule } from '../projects/projects.module';
import { BudgetLinesModule } from '../budget-lines/budget-lines.module';
import { CostItemsModule } from '../cost-items/cost-items.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { LandModule } from '../land/land.module';
import { ArchitectureModule } from '../architecture/architecture.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ProjectWizardModule } from '../project-wizard/project-wizard.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env'],
    }),
    PrismaModule,
    // Wizard first: its static `projects/wizard` prefix must win over the `projects/:id` routes.
    ProjectWizardModule,
    ProjectsModule,
    BudgetLinesModule,
    CostItemsModule,
    OrganizationsModule,
    LandModule,
    ArchitectureModule,
    DeliveriesModule,
    AnalyticsModule,
    SearchModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
