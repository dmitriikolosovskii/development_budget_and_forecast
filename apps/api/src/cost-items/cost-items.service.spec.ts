import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectScopeService } from '../projects/project-scope.service';
import { CostItemsService } from './cost-items.service';
import type { CreateCostItemDto } from './dto/create-cost-item.dto';

function mockPrisma() {
  return {
    project: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
    budgetLine: { findFirst: jest.fn().mockResolvedValue({ id: 'line-p1' }) },
    boqComponent: { findFirst: jest.fn().mockResolvedValue({ id: 'boq-1' }) },
    organization: { findMany: jest.fn().mockResolvedValue([]) },
    costItem: {
      findFirst: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'new', ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
      delete: jest
        .fn()
        .mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
    },
  };
}

describe('CostItemsService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: CostItemsService;

  beforeEach(async () => {
    prisma = mockPrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CostItemsService,
        ProjectScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CostItemsService);
  });

  const material = {
    id: 'm1',
    projectId: 'p1',
    kind: 'MATERIAL',
    budgetLineId: 'line-p1',
  };

  it('should reject a PATCH with a budgetLineId from another project with 400 [AC-01.10]', async () => {
    prisma.costItem.findFirst.mockResolvedValueOnce(material);
    prisma.budgetLine.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.update('p1', 'm1', { budgetLineId: 'line-of-p2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.budgetLine.findFirst).toHaveBeenCalledWith({
      where: { id: 'line-of-p2', projectId: 'p1' },
      select: { id: true },
    });
    expect(prisma.costItem.update).not.toHaveBeenCalled();
  });

  it('should return 404 when patching an item that does not exist [AC-01.10]', async () => {
    prisma.costItem.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.update('p1', 'missing', { qtyMilli: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.costItem.update).not.toHaveBeenCalled();
  });

  it('should return 404 when the item belongs to another project', async () => {
    prisma.costItem.findFirst.mockResolvedValueOnce(null);

    await expect(service.remove('p1', 'item-of-p2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.costItem.findFirst).toHaveBeenCalledWith({
      where: { id: 'item-of-p2', projectId: 'p1' },
    });
    expect(prisma.costItem.delete).not.toHaveBeenCalled();
  });

  it('should reject requiredForWorkId when the target is not a WORK of the project', async () => {
    prisma.costItem.findFirst
      .mockResolvedValueOnce(material)
      .mockResolvedValueOnce(null);

    await expect(
      service.update('p1', 'm1', { requiredForWorkId: 'other-material' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.costItem.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'other-material', projectId: 'p1', kind: 'WORK' },
      select: { id: true },
    });
  });

  it('should reject requiredForWorkId on a WORK item', async () => {
    prisma.costItem.findFirst.mockResolvedValueOnce({
      ...material,
      kind: 'WORK',
    });

    await expect(
      service.update('p1', 'm1', { requiredForWorkId: 'w1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should clear a nullable field when the patch sends null', async () => {
    prisma.costItem.findFirst.mockResolvedValueOnce(material);

    await service.update('p1', 'm1', {
      deliveryDate: null,
      requiredForWorkId: null,
    });

    expect(prisma.costItem.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { deliveryDate: null, requiredForWorkId: null },
    });
  });

  it('should reject an unknown supplier with 400', async () => {
    prisma.costItem.findFirst.mockResolvedValueOnce(material);

    await expect(
      service.update('p1', 'm1', { supplierId: 'ghost' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  const createDto: CreateCostItemDto = {
    budgetLineId: 'line-p1',
    kind: 'MATERIAL',
    code: 'MAT-ELE-001',
    name: 'NYM-J 3×1.5',
    unit: 'm',
    qtyMilli: 100_000,
    unitPriceCents: 89,
  };

  it('should create an item in the project when the line belongs to it', async () => {
    const item = await service.create('p1', createDto);

    expect(item).toMatchObject({ projectId: 'p1', code: 'MAT-ELE-001' });
  });

  it('should return 404 when creating an item in a missing project', async () => {
    prisma.project.findUnique.mockResolvedValueOnce(null);

    await expect(service.create('nope', createDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.costItem.create).not.toHaveBeenCalled();
  });

  it('should return 409 when the code already exists in the project', async () => {
    prisma.costItem.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '6',
        meta: { target: ['projectId', 'code'] },
      }),
    );

    await expect(service.create('p1', createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
