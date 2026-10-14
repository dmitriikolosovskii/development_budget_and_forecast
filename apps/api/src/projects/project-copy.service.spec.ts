import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectCopyService } from './project-copy.service';

const T = new Date('2026-10-14T00:00:00Z');
const source = {
  id: 'p1',
  slug: 'taucha',
  name: 'Taucha',
  code: 'TA-2026-01',
  status: 'ACTIVE',
  isTemplate: false,
  clientName: 'Familie Neumann',
  city: 'Taucha',
  startDate: '2026-04-01',
  endDate: '2027-03-31',
  markupBps: 1500,
  createdAt: T,
  updatedAt: T,
  budgetLines: [
    {
      id: 'l-mat',
      projectId: 'p1',
      category: 'MATERIALS',
      section: 'windows-doors',
      name: 'Windows',
      approvedCents: 100,
      sortOrder: 0,
      createdAt: T,
      updatedAt: T,
    },
    {
      id: 'l-wrk',
      projectId: 'p1',
      category: 'CONSTRUCTION',
      section: 'windows-install',
      name: 'Install',
      approvedCents: 50,
      sortOrder: 0,
      createdAt: T,
      updatedAt: T,
    },
  ],
  items: [
    // the material comes first in the source order, but its WORK must be inserted before it
    {
      id: 'i-mat',
      projectId: 'p1',
      budgetLineId: 'l-mat',
      kind: 'MATERIAL',
      code: 'MAT-WIN-001',
      requiredForWorkId: 'i-wrk',
      boqComponentId: 'c1',
      supplierId: 'org-1',
      createdAt: T,
      updatedAt: T,
    },
    {
      id: 'i-wrk',
      projectId: 'p1',
      budgetLineId: 'l-wrk',
      kind: 'WORK',
      code: 'WRK-WIN-001',
      requiredForWorkId: null,
      boqComponentId: null,
      supplierId: null,
      createdAt: T,
      updatedAt: T,
    },
  ],
  land: {
    id: 'land-1',
    projectId: 'p1',
    address: 'A',
    createdAt: T,
    updatedAt: T,
    utilities: [
      {
        id: 'u1',
        landId: 'land-1',
        type: 'WATER',
        status: 'CONNECTED',
        distanceM: null,
        provider: null,
        notes: null,
      },
    ],
  },
  plan: {
    id: 'plan-1',
    projectId: 'p1',
    name: 'EFH',
    architectOrgId: 'org-arch',
    createdAt: T,
    updatedAt: T,
    rooms: [{ id: 'r1', planId: 'plan-1', code: 'GF-LIV' }],
    components: [
      { id: 'c1', planId: 'plan-1', code: 'BOQ-OPN-001', qtyMilli: 9000 },
    ],
  },
  importBatches: [
    {
      id: 'b1',
      projectId: 'p1',
      fileName: 'd.csv',
      totalRows: 1,
      okRows: 1,
      failedRows: 0,
      errorsJson: '[]',
      createdAt: T,
    },
  ],
  deliveries: [
    {
      id: 'd1',
      projectId: 'p1',
      costItemId: 'i-mat',
      batchId: 'b1',
      deliveryNoteNo: 'LS-1',
      kind: 'DELIVERED',
      date: '2026-09-01',
      qtyMilli: 1000,
      invoiceCents: 100,
      createdAt: T,
    },
  ],
};

const SOURCE_IDS = new Set([
  'p1',
  'l-mat',
  'l-wrk',
  'i-mat',
  'i-wrk',
  'land-1',
  'u1',
  'plan-1',
  'r1',
  'c1',
  'b1',
  'd1',
]);

function mockTx() {
  const model = () => ({
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
  });
  return {
    project: {
      ...model(),
      findUnique: jest.fn().mockResolvedValue(source),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { slug: 'taucha-copy-1' },
          { slug: 'taucha-copy-x' },
        ]),
    },
    budgetLine: model(),
    costItem: model(),
    landParcel: model(),
    utilityConnection: model(),
    architecturePlan: model(),
    room: model(),
    boqComponent: model(),
    importBatch: model(),
    delivery: model(),
  };
}

const rows = (fn: jest.Mock, call = 0) =>
  fn.mock.calls[call][0].data as Array<Record<string, unknown>>;

describe('ProjectCopyService', () => {
  let tx: ReturnType<typeof mockTx>;
  let service: ProjectCopyService;
  const prisma = { $transaction: jest.fn() };

  beforeEach(async () => {
    tx = mockTx();
    prisma.$transaction
      .mockReset()
      .mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectCopyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ProjectCopyService);
  });

  it('should deep-copy with new ids, links remapped to the copy and the source untouched [AC-01.12]', async () => {
    const newId = await service.duplicate('p1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const proj = tx.project.create.mock.calls[0][0].data;
    expect(proj).toMatchObject({
      id: newId,
      slug: 'taucha-copy-2',
      name: 'Taucha (copy)',
      code: 'TA-2026-01',
      isTemplate: false,
    });

    const lines = rows(tx.budgetLine.createMany);
    const lineMap = new Map([
      ['l-mat', lines[0].id],
      ['l-wrk', lines[1].id],
    ]);
    const [boq] = rows(tx.boqComponent.createMany);
    const [batch] = rows(tx.importBatch.createMany);
    const workRows = rows(tx.costItem.createMany, 0);
    const matRows = rows(tx.costItem.createMany, 1);
    expect(workRows.map((r) => r['code'])).toEqual(['WRK-WIN-001']);
    expect(matRows.map((r) => r['code'])).toEqual(['MAT-WIN-001']);
    const [work] = workRows;
    const [mat] = matRows;

    expect(mat).toMatchObject({
      projectId: newId,
      budgetLineId: lineMap.get('l-mat'),
      requiredForWorkId: work.id,
      boqComponentId: boq.id,
      supplierId: 'org-1', // organisations are shared, not copied
    });
    expect(work).toMatchObject({
      projectId: newId,
      budgetLineId: lineMap.get('l-wrk'),
    });
    const [delivery] = rows(tx.delivery.createMany);
    expect(delivery).toMatchObject({
      projectId: newId,
      costItemId: mat.id,
      batchId: batch.id,
    });
    expect(tx.landParcel.create.mock.calls[0][0].data.projectId).toBe(newId);
    expect(rows(tx.utilityConnection.createMany)[0].landId).toBe(
      tx.landParcel.create.mock.calls[0][0].data.id,
    );
    const plan = tx.architecturePlan.create.mock.calls[0][0].data;
    expect(plan).toMatchObject({
      projectId: newId,
      architectOrgId: 'org-arch',
    });
    expect(rows(tx.room.createMany)[0].planId).toBe(plan.id);
    expect(boq.planId).toBe(plan.id);

    // every written id is new, no timestamps are copied
    const written = [
      proj,
      ...lines,
      ...workRows,
      ...matRows,
      boq,
      batch,
      delivery,
      plan,
      ...rows(tx.room.createMany),
      ...rows(tx.utilityConnection.createMany),
      tx.landParcel.create.mock.calls[0][0].data,
    ];
    for (const r of written) {
      expect(SOURCE_IDS.has(r['id'] as string)).toBe(false);
      expect(r).not.toHaveProperty('createdAt');
    }
    const referenced = written.flatMap((r) =>
      [
        'projectId',
        'budgetLineId',
        'requiredForWorkId',
        'boqComponentId',
        'costItemId',
        'batchId',
        'planId',
        'landId',
      ].map((k) => r[k]),
    );
    expect(referenced.filter((v) => SOURCE_IDS.has(v as string))).toEqual([]);

    // the source is only read
    for (const m of Object.values(tx)) {
      for (const op of [
        'update',
        'delete',
        'deleteMany',
        'upsert',
        'updateMany',
      ] as const) {
        if (op in m)
          expect((m as Record<string, jest.Mock>)[op]).not.toHaveBeenCalled();
      }
    }
  });

  it('should use the given name when one is passed', async () => {
    await service.duplicate('p1', { name: 'E2E copy' });

    expect(tx.project.create.mock.calls[0][0].data.name).toBe('E2E copy');
  });

  it('should return 404 when the source project does not exist', async () => {
    tx.project.findUnique.mockResolvedValue(null);

    await expect(service.duplicate('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it('should retry a slug collision and give up with 409 after 3 attempts', async () => {
    tx.project.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '6',
        meta: { target: ['slug'] },
      }),
    );

    await expect(service.duplicate('p1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});
