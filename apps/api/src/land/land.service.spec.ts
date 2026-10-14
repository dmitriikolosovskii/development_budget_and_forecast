import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectScopeService } from '../projects/project-scope.service';
import { LAND_DEFAULTS } from './land-defaults';
import { LandService } from './land.service';

const parcel = { id: 'land-1', projectId: 'p1', ...LAND_DEFAULTS };

function setup() {
  const prisma = {
    landParcel: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    utilityConnection: { upsert: jest.fn() },
  };
  const scope = { assertProject: jest.fn().mockResolvedValue(undefined) };
  return { prisma, scope };
}

async function build(prisma: object, scope: object): Promise<LandService> {
  const module = await Test.createTestingModule({
    providers: [
      LandService,
      { provide: PrismaService, useValue: prisma },
      { provide: ProjectScopeService, useValue: scope },
    ],
  }).compile();
  return module.get(LandService);
}

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('LandService', () => {
  it('should return 404 when the project does not exist [AC-07.1]', async () => {
    const { prisma, scope } = setup();
    scope.assertProject.mockRejectedValue(
      new NotFoundException('Project nope not found'),
    );
    const service = await build(prisma, scope);

    await expect(
      service.updateLand('nope', { areaM2: 520 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.upsertUtility('nope', 'WATER', { status: 'CONNECTED' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.landParcel.upsert).not.toHaveBeenCalled();
    expect(prisma.utilityConnection.upsert).not.toHaveBeenCalled();
  });

  it('should upsert a utility by [landId, type] so a repeated PATCH updates the same row [AC-07.1]', async () => {
    const { prisma, scope } = setup();
    prisma.landParcel.upsert.mockResolvedValue(parcel);
    prisma.utilityConnection.upsert.mockResolvedValue({ id: 'u1' });
    const service = await build(prisma, scope);

    await service.upsertUtility('p1', 'WATER', { status: 'CONNECTED' });
    await service.upsertUtility('p1', 'WATER', { distanceM: 12 });

    const calls = prisma.utilityConnection.upsert.mock.calls.map(
      ([args]) => args,
    );
    expect(calls).toHaveLength(2);
    for (const args of calls)
      expect(args.where).toEqual({
        landId_type: { landId: 'land-1', type: 'WATER' },
      });
    expect(calls[1].update).toEqual({ distanceM: 12 });
  });

  it('should create the parcel from blank defaults plus the patch when the project has none [AC-07.6]', async () => {
    const { prisma, scope } = setup();
    prisma.landParcel.upsert.mockResolvedValue({ ...parcel, areaM2: 520 });
    const service = await build(prisma, scope);

    // A DTO instance may carry declared-but-unset fields as undefined: they must not override defaults.
    await service.updateLand('p1', { areaM2: 520, address: undefined });

    const args = prisma.landParcel.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ projectId: 'p1' });
    expect(args.create).toEqual({
      ...LAND_DEFAULTS,
      areaM2: 520,
      projectId: 'p1',
    });
    expect(args.update).toEqual({ areaM2: 520 });
  });

  it('should pass null through to clear a nullable column [AC-07.6]', async () => {
    const { prisma, scope } = setup();
    prisma.landParcel.upsert.mockResolvedValue(parcel);
    const service = await build(prisma, scope);

    await service.updateLand('p1', { groundwaterDepthCm: null });

    expect(prisma.landParcel.upsert.mock.calls[0][0].update).toEqual({
      groundwaterDepthCm: null,
    });
  });

  it('should update instead when a concurrent first PATCH already created the parcel [AC-07.6]', async () => {
    const { prisma, scope } = setup();
    prisma.landParcel.upsert.mockRejectedValue(uniqueViolation());
    prisma.landParcel.update.mockResolvedValue({ ...parcel, areaM2: 600 });
    const service = await build(prisma, scope);

    const result = await service.updateLand('p1', { areaM2: 600 });

    expect(result.areaM2).toBe(600);
    expect(prisma.landParcel.update).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      data: { areaM2: 600 },
    });
  });

  it('should create the parcel first and default the status when a utility is patched without a parcel [AC-07.7]', async () => {
    const { prisma, scope } = setup();
    prisma.landParcel.upsert.mockResolvedValue(parcel);
    prisma.utilityConnection.upsert.mockResolvedValue({ id: 'u1' });
    const service = await build(prisma, scope);

    await service.upsertUtility('p1', 'GAS', { distanceM: 5 });

    expect(prisma.landParcel.upsert).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      create: { ...LAND_DEFAULTS, projectId: 'p1' },
      update: {},
    });
    expect(prisma.utilityConnection.upsert.mock.calls[0][0].create).toEqual({
      distanceM: 5,
      status: 'NOT_AVAILABLE',
      landId: 'land-1',
      type: 'GAS',
    });
  });
});
