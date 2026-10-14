import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectScopeService } from '../projects/project-scope.service';
import { BudgetLinesService } from './budget-lines.service';

describe('BudgetLinesService', () => {
  const prisma = {
    project: { findUnique: jest.fn() },
    budgetLine: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    costItem: { count: jest.fn() },
  };
  let service: BudgetLinesService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetLinesService,
        ProjectScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(BudgetLinesService);
  });

  it('should refuse with 409 when deleting a line that still has items', async () => {
    prisma.budgetLine.findFirst.mockResolvedValue({
      id: 'l1',
      projectId: 'p1',
    });
    prisma.costItem.count.mockResolvedValue(3);

    await expect(service.remove('p1', 'l1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.budgetLine.delete).not.toHaveBeenCalled();
  });

  it('should delete an empty line', async () => {
    prisma.budgetLine.findFirst.mockResolvedValue({
      id: 'l1',
      projectId: 'p1',
    });
    prisma.costItem.count.mockResolvedValue(0);
    prisma.budgetLine.delete.mockResolvedValue({ id: 'l1' });

    await expect(service.remove('p1', 'l1')).resolves.toEqual({ id: 'l1' });
  });

  it('should return 404 when the line belongs to another project', async () => {
    prisma.budgetLine.findFirst.mockResolvedValue(null);

    await expect(
      service.update('p1', 'l-of-p2', { approvedCents: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.budgetLine.update).not.toHaveBeenCalled();
  });

  it('should create a line with approved 0 by default', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.budgetLine.create.mockImplementation(({ data }) =>
      Promise.resolve(data),
    );

    await expect(
      service.create('p1', {
        category: 'MATERIALS',
        section: 'solar',
        name: 'Solar',
      }),
    ).resolves.toMatchObject({
      approvedCents: 0,
      projectId: 'p1',
    });
  });
});
