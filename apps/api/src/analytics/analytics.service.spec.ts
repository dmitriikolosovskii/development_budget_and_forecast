import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  makeItem,
  makeLine,
  makeProject,
} from '@default-project/budget-engine';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService, DEFAULT_DEMO_TODAY } from './analytics.service';
import { PortfolioQueryDto } from './dto/portfolio-query.dto';

// monthlyCashflow (block 06) has its own spec; a fixed series keeps the merge wiring deterministic here.
jest.mock('@default-project/budget-engine', () => {
  const actual = jest.requireActual('@default-project/budget-engine');
  return {
    ...actual,
    monthlyCashflow: jest.fn(
      (snap: { items: Array<{ projectId: string }> }) => ({
        months: [
          {
            month: snap.items[0]?.projectId === 'p1' ? '2026-01' : '2026-03',
            planned: 100,
            actual: 10,
            forecast: 120,
            cumulativePlanned: 100,
            cumulativeActual: 10,
            cumulativeForecast: 120,
          },
        ],
        unscheduled: { planned: 0, forecast: 0 },
      }),
    ),
  };
});

function dbProject(
  id: string,
  extra: { items?: ReturnType<typeof makeItem>[]; deliveries?: object[] } = {},
) {
  const line = makeLine({ id: `${id}-l`, projectId: id, approvedCents: 1000 });
  return {
    ...makeProject({ id, slug: id, name: id }),
    budgetLines: [line],
    items: (
      extra.items ?? [
        makeItem({
          projectId: id,
          budgetLineId: line.id,
          unitPriceCents: 1500,
        }),
      ]
    ).map((i) => ({
      ...i,
      budgetLineId: line.id,
    })),
    deliveries: extra.deliveries ?? [],
  };
}

describe('AnalyticsService', () => {
  const prisma = {
    project: { findMany: jest.fn() },
    budgetLine: { findMany: jest.fn() },
    costItem: { findMany: jest.fn() },
    delivery: { findMany: jest.fn() },
  };
  const env: Record<string, string | undefined> = {};
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const k of Object.keys(env)) delete env[k];
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
      ],
    }).compile();
    service = moduleRef.get(AnalyticsService);
  });

  it('should load the whole portfolio with one findMany including lines, items and deliveries [AC-11.2]', async () => {
    prisma.project.findMany.mockResolvedValue([
      dbProject('p1'),
      dbProject('p2'),
    ]);

    const result = await service.portfolio('2026-10-14');

    expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isTemplate: false },
        include: { budgetLines: true, items: true, deliveries: true },
      }),
    );
    expect(prisma.budgetLine.findMany).not.toHaveBeenCalled();
    expect(prisma.costItem.findMany).not.toHaveBeenCalled();
    expect(prisma.delivery.findMany).not.toHaveBeenCalled();
    expect(result.projects).toHaveLength(2);
    expect(result.totals.approved).toBe(2000);
    expect(result.totals.forecast).toBe(3000);
  });

  it('should merge per-project cash flows into one continuous portfolio series', async () => {
    prisma.project.findMany.mockResolvedValue([
      dbProject('p1'),
      dbProject('p2'),
    ]);

    const result = await service.portfolio('2026-10-14');

    expect(result.projects[0].cashflow[0].month).toBe('2026-01');
    expect(result.cashflow.map((m) => m.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
    expect(result.cashflow.at(-1)?.cumulativeForecast).toBe(240);
  });

  it('should count overdue materials at the given date and on-time deliveries by block 10 rules [AC-11.11]', async () => {
    const items = [
      makeItem({ id: 'late', kind: 'MATERIAL', deliveryDate: '2026-10-10' }),
      makeItem({ id: 'future', kind: 'MATERIAL', deliveryDate: '2026-10-20' }),
      makeItem({
        id: 'nodue',
        kind: 'MATERIAL',
        deliveryDate: null,
        deliveredDate: '2026-05-01',
      }),
    ];
    const deliveries = [
      { costItemId: 'future', kind: 'DELIVERED', date: '2026-10-20' },
      { costItemId: 'late', kind: 'DELIVERED', date: '2026-10-12' },
      { costItemId: 'late', kind: 'EXPECTED', date: '2026-10-01' },
      { costItemId: 'nodue', kind: 'DELIVERED', date: '2026-05-01' },
    ];
    prisma.project.findMany.mockResolvedValue([
      dbProject('p1', { items, deliveries }),
    ]);

    const at14 = await service.portfolio('2026-10-14');
    const at09 = await service.portfolio('2026-10-09');

    expect(at14.projects[0].delivery).toEqual({
      deliveredRows: 2,
      onTimeRows: 1,
      overdueItems: 1,
    });
    expect(at09.projects[0].delivery.overdueItems).toBe(0);
  });

  it('should use DEMO_TODAY, then the demo date, when the client sends no date', () => {
    expect(service.defaultToday()).toBe(DEFAULT_DEMO_TODAY);
    env['DEMO_TODAY'] = '2027-01-05';
    expect(service.defaultToday()).toBe('2027-01-05');
    env['DEMO_TODAY'] = 'today';
    expect(service.defaultToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(service.defaultToday()).not.toBe('today');
  });
});

describe('PortfolioQueryDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const meta = { type: 'query' as const, metatype: PortfolioQueryDto };

  it.each([
    '2026-13-01',
    '2026-02-30',
    'today',
    '2026-1-5',
    "2026-10-14' OR 1=1",
  ])('should reject today=%s with 400 [AC-11.11]', async (today) => {
    await expect(pipe.transform({ today }, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should accept a real date and an absent date [AC-11.11]', async () => {
    await expect(
      pipe.transform({ today: '2028-02-29' }, meta),
    ).resolves.toEqual({ today: '2028-02-29' });
    await expect(pipe.transform({}, meta)).resolves.toEqual({});
  });
});
