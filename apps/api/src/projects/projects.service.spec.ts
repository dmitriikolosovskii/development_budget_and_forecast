import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BUDGET_CATALOG } from '@default-project/types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectCopyService } from './project-copy.service';
import { ProjectsService } from './projects.service';

const project = {
  id: 'p1',
  slug: 'taucha',
  name: 'Taucha',
  code: 'TA-1',
  status: 'ACTIVE',
  isTemplate: false,
  clientName: 'C',
  city: 'Taucha',
  startDate: '2026-04-01',
  endDate: '2027-03-31',
  markupBps: 1500,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ProjectsService', () => {
  const prisma = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: { findMany: jest.fn() },
  };
  const copier = { duplicate: jest.fn() };
  let service: ProjectsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectCopyService, useValue: copier },
      ],
    }).compile();
    service = moduleRef.get(ProjectsService);
  });

  it('should exclude templates and attach the engine summary when listing projects [AC-01.10]', async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        ...project,
        budgetLines: [
          {
            id: 'l1',
            category: 'MATERIALS',
            section: 'concrete',
            name: 'Concrete',
            approvedCents: 10_000,
          },
        ],
        items: [
          {
            id: 'i1',
            budgetLineId: 'l1',
            kind: 'MATERIAL',
            status: 'PLANNED',
            qtyMilli: 2000,
            unitPriceCents: 6000,
            committedCents: 0,
            actualCents: 0,
          },
        ],
      },
    ]);

    const [row] = await service.findAll();

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isTemplate: false } }),
    );
    expect(row).not.toHaveProperty('items');
    expect(row.summary).toMatchObject({
      approved: 10_000,
      forecast: 12_000,
      variance: -2_000,
      overrun: true,
    });
    expect(row.profitability).toMatchObject({
      contractPrice: 11_500,
      forecastProfit: -500,
    });
  });

  it('should return 404 when the project does not exist', async () => {
    prisma.project.findUnique.mockResolvedValue(null);

    await expect(service.getSnapshot('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should load the snapshot with one include and the referenced organisations incl. the architect', async () => {
    prisma.project.findUnique.mockResolvedValue({
      ...project,
      budgetLines: [],
      items: [
        { id: 'i1', supplierId: 'o-sup', contractorId: 'o-con' },
        { id: 'i2', supplierId: 'o-sup', contractorId: null },
      ],
      land: null,
      plan: { id: 'plan', architectOrgId: 'o-arch', rooms: [], components: [] },
      deliveries: [],
    });
    prisma.organization.findMany.mockResolvedValue([
      { id: 'o-sup' },
      { id: 'o-con' },
      { id: 'o-arch' },
    ]);

    const snap = await service.getSnapshot('p1');

    expect(prisma.project.findUnique).toHaveBeenCalledTimes(1);
    const where = prisma.organization.findMany.mock.calls[0][0].where.id.in;
    expect([...where].sort()).toEqual(['o-arch', 'o-con', 'o-sup']);
    expect(snap.project).toMatchObject({ id: 'p1', slug: 'taucha' });
    expect(snap.project).not.toHaveProperty('items');
    expect(snap.organizations).toHaveLength(3);
  });

  it('should create a project with every catalogue line at approved 0', async () => {
    prisma.project.create.mockResolvedValue({ id: 'new' });
    prisma.project.findUnique.mockResolvedValue({
      ...project,
      id: 'new',
      budgetLines: [],
      items: [],
      land: null,
      plan: null,
      deliveries: [],
    });

    await service.create({
      name: 'Haus Müller',
      code: 'HM-1',
      clientName: 'M',
      city: 'Leipzig',
      startDate: '2026-05-01',
      endDate: '2027-05-01',
    });

    const data = prisma.project.create.mock.calls[0][0].data;
    expect(data.slug).toBe('haus-muller');
    expect(data.budgetLines.create).toHaveLength(BUDGET_CATALOG.length);
    expect(
      data.budgetLines.create.every(
        (l: { approvedCents: number }) => l.approvedCents === 0,
      ),
    ).toBe(true);
  });

  it('should reject a PATCH whose end date falls before the stored start date', async () => {
    prisma.project.findUnique.mockResolvedValue(project);

    await expect(
      service.update('p1', { endDate: '2026-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
