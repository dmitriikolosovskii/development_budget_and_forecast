import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectScopeService } from '../projects/project-scope.service';
import { ArchitectureService } from './architecture.service';

function mockPrisma() {
  const db = {
    project: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
    organization: { findMany: jest.fn().mockResolvedValue([]) },
    architecturePlan: {
      findUnique: jest.fn().mockResolvedValue({ id: 'plan1', projectId: 'p1' }),
      upsert: jest
        .fn()
        .mockImplementation(({ create }) =>
          Promise.resolve({ id: 'plan1', ...create }),
        ),
    },
    room: {
      findFirst: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 'r-new', ...data })),
      update: jest
        .fn()
        .mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
      delete: jest
        .fn()
        .mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
    },
    boqComponent: {
      findFirst: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 'c-new', ...data })),
      update: jest
        .fn()
        .mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, planId: 'plan1', ...data }),
        ),
      delete: jest
        .fn()
        .mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
    },
    costItem: {
      findMany: jest.fn().mockResolvedValue([{ id: 'mat-1' }, { id: 'mat-2' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    $transaction: jest.fn(),
  };
  // interactive transaction: run the callback against the same mock (tx = db)
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return db;
}

describe('ArchitectureService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: ArchitectureService;

  beforeEach(async () => {
    prisma = mockPrisma();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArchitectureService,
        ProjectScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ArchitectureService);
  });

  describe('updateComponent', () => {
    it('should update the component and every linked item qty in one transaction when qtyMilli changes [AC-08.1]', async () => {
      prisma.boqComponent.findFirst.mockResolvedValueOnce({ id: 'c1' });

      const res = await service.updateComponent('p1', 'c1', { qtyMilli: 15000 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.boqComponent.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { qtyMilli: 15000 },
      });
      expect(prisma.costItem.findMany).toHaveBeenCalledWith({
        where: { boqComponentId: 'c1' },
        select: { id: true },
      });
      expect(prisma.costItem.updateMany).toHaveBeenCalledWith({
        where: { boqComponentId: 'c1' },
        data: { qtyMilli: 15000 },
      });
      expect(res).toEqual({
        component: expect.objectContaining({ id: 'c1', qtyMilli: 15000 }),
        updatedItemIds: ['mat-1', 'mat-2'],
      });
    });

    it('should not touch linked items when qtyMilli is not in the patch [AC-08.1]', async () => {
      prisma.boqComponent.findFirst.mockResolvedValueOnce({ id: 'c1' });

      const res = await service.updateComponent('p1', 'c1', { name: 'Rebar' });

      expect(prisma.costItem.updateMany).not.toHaveBeenCalled();
      expect(res.updatedItemIds).toEqual([]);
    });

    it('should return 404 and write nothing when the component belongs to another project [AC-08.7]', async () => {
      prisma.boqComponent.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateComponent('p1', 'c-of-p2', { qtyMilli: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.boqComponent.findFirst).toHaveBeenCalledWith({
        where: { id: 'c-of-p2', plan: { projectId: 'p1' } },
        select: { id: true },
      });
      expect(prisma.boqComponent.update).not.toHaveBeenCalled();
      expect(prisma.costItem.updateMany).not.toHaveBeenCalled();
    });

    it('should return 409 when the new code is already used in the plan', async () => {
      prisma.boqComponent.findFirst.mockResolvedValueOnce({ id: 'c1' });
      prisma.boqComponent.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.updateComponent('p1', 'c1', { code: 'BOQ-STR-001' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeComponent', () => {
    it('should return 404 for a foreign component and delete nothing [AC-08.7]', async () => {
      prisma.boqComponent.findFirst.mockResolvedValueOnce(null);

      await expect(service.removeComponent('p1', 'c-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.boqComponent.delete).not.toHaveBeenCalled();
    });
  });

  describe('rooms', () => {
    it('should return 404 and write nothing when the room belongs to another project [AC-08.7]', async () => {
      prisma.room.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateRoom('p1', 'r-of-p2', { wCm: 400 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.room.findFirst).toHaveBeenCalledWith({
        where: { id: 'r-of-p2', plan: { projectId: 'p1' } },
        select: { id: true },
      });
      expect(prisma.room.update).not.toHaveBeenCalled();
    });

    it('should save an overlapping room without validation errors when the size changes', async () => {
      prisma.room.findFirst.mockResolvedValueOnce({ id: 'GF-KIT' });

      const room = await service.updateRoom('p1', 'GF-KIT', { wCm: 400 });

      expect(room).toEqual({ id: 'GF-KIT', wCm: 400 });
    });

    it('should create a room in the project plan when the plan exists', async () => {
      const room = await service.createRoom('p1', {
        code: 'GF-NEW',
        floor: 0,
        name: 'Pantry',
        kind: 'storage',
        xCm: 0,
        yCm: 0,
        wCm: 100,
        hCm: 100,
      });

      expect(prisma.room.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ planId: 'plan1', code: 'GF-NEW' }),
      });
      expect(room.id).toBe('r-new');
    });

    it('should return 404 when creating a room in a project without a plan', async () => {
      prisma.architecturePlan.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createRoom('p1', {
          code: 'GF-NEW',
          floor: 0,
          name: 'Pantry',
          kind: 'storage',
          xCm: 0,
          yCm: 0,
          wCm: 100,
          hCm: 100,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.room.create).not.toHaveBeenCalled();
    });
  });

  describe('updatePlan', () => {
    it('should upsert the plan with defaults when the project has no plan yet', async () => {
      await service.updatePlan('p1', { storeys: 2 });

      expect(prisma.architecturePlan.upsert).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
        update: { storeys: 2 },
        create: expect.objectContaining({
          projectId: 'p1',
          storeys: 2,
          footprintWidthCm: 1000,
          footprintDepthCm: 900,
          occupants: 4,
        }),
      });
    });

    it('should return 404 without writing when the project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);

      await expect(service.updatePlan('missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.architecturePlan.upsert).not.toHaveBeenCalled();
    });
  });
});
