import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  mergeCashflows,
  monthlyCashflow,
  summarizePortfolioExtended,
} from '@default-project/budget-engine';
import type { CashflowMonth, PortfolioAnalytics } from '@default-project/types';
import { PrismaService } from '../prisma/prisma.service';
import { deliveryStats, type DeliveryStats } from './delivery-stats';

export const DEFAULT_DEMO_TODAY = '2026-10-14';

/** PortfolioAnalytics plus the optional per-project fields of CR-11. */
export type PortfolioResponse = Omit<PortfolioAnalytics, 'projects'> & {
  projects: Array<
    PortfolioAnalytics['projects'][number] & {
      startDate: string;
      endDate: string;
      overrunLineCount: number;
      cashflow: CashflowMonth[];
      delivery: DeliveryStats;
    }
  >;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** "Today" when the client sends none: DEMO_TODAY (or `today` = the current UTC date), else the demo date. */
  defaultToday(): string {
    const env = this.config.get<string>('DEMO_TODAY');
    if (env === 'today') return new Date().toISOString().slice(0, 10);
    return env || DEFAULT_DEMO_TODAY;
  }

  async portfolio(today = this.defaultToday()): Promise<PortfolioResponse> {
    // One query for the whole portfolio (no N+1); templates are not projects.
    const projects = await this.prisma.project.findMany({
      where: { isTemplate: false },
      include: { budgetLines: true, items: true, deliveries: true },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
    });
    const base = summarizePortfolioExtended(
      projects.map((p) => ({
        project: p,
        budgetLines: p.budgetLines,
        items: p.items,
      })),
    );
    const rows = base.projects.map((row, i) => {
      const p = projects[i];
      return {
        ...row,
        cashflow: monthlyCashflow(
          { budgetLines: p.budgetLines, items: p.items },
          today,
        ).months,
        delivery: deliveryStats(p.items, p.deliveries, today),
      };
    });
    return {
      totals: base.totals,
      profitability: base.profitability,
      byCategory: base.byCategory,
      projects: rows,
      cashflow: mergeCashflows(rows.map((r) => r.cashflow)),
    };
  }
}
