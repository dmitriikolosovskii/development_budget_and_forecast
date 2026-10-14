import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService, type PortfolioResponse } from './analytics.service';
import { PortfolioQueryDto } from './dto/portfolio-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('portfolio')
  portfolio(@Query() query: PortfolioQueryDto): Promise<PortfolioResponse> {
    return this.analytics.portfolio(query.today);
  }
}
