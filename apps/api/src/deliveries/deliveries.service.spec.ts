import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectScopeService } from '../projects/project-scope.service';
import { DeliveriesService } from './deliveries.service';
import { FakePrisma, type FakeItem } from './testing/fake-prisma';

function item(
  over: Partial<FakeItem> & Pick<FakeItem, 'id' | 'code'>,
): FakeItem {
  return {
    projectId: 'p1',
    kind: 'MATERIAL',
    deliveryDate: '2026-09-15',
    deliveredDate: null,
    actualCents: 0,
    ...over,
  };
}

function row(over: Record<string, string> = {}): Record<string, string> {
  return {
    itemCode: 'MAT-CON-001',
    deliveryNoteNo: 'LS-1',
    kind: 'DELIVERED',
    date: '2026-09-01',
    quantity: '10',
    invoiceAmountEur: '100.00',
    ...over,
  };
}

describe('DeliveriesService', () => {
  let prisma: FakePrisma;
  let service: DeliveriesService;

  async function build(fake: FakePrisma): Promise<void> {
    prisma = fake;
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeliveriesService,
        ProjectScopeService,
        { provide: PrismaService, useValue: fake },
      ],
    }).compile();
    service = moduleRef.get(DeliveriesService);
  }

  beforeEach(() =>
    build(
      new FakePrisma({
        projects: ['p1', 'p2'],
        items: [
          item({ id: 'con', code: 'MAT-CON-001' }),
          item({ id: 'win', code: 'MAT-WIN-001', deliveryDate: '2026-10-20' }),
          item({
            id: 'wrk',
            code: 'WRK-SHL-001',
            kind: 'WORK',
            deliveryDate: null,
          }),
          item({ id: 'other', code: 'MAT-CON-001', projectId: 'p2' }),
        ],
      }),
    ),
  );

  const twoInvoices = [
    row({
      deliveryNoteNo: 'LS-1',
      date: '2026-09-01',
      invoiceAmountEur: '100.00',
    }),
    row({
      deliveryNoteNo: 'LS-2',
      date: '2026-09-03',
      invoiceAmountEur: '50.50',
    }),
  ];

  it('should set actualCents to the sum of DELIVERED invoices when valid rows are imported [AC-10.1]', async () => {
    const result = await service.import('p1', {
      fileName: 'a.csv',
      rows: [
        ...twoInvoices,
        row({
          deliveryNoteNo: 'AV-9',
          kind: 'EXPECTED',
          date: '2026-09-20',
          invoiceAmountEur: '999.00',
        }),
      ],
    });

    expect(prisma.item('con')).toMatchObject({
      actualCents: 15050,
      deliveredDate: '2026-09-03',
    });
    expect(prisma.item('con').actualCents).not.toBe(15050 + 99900); // EXPECTED amounts are not actuals
    expect(prisma.state.deliveries).toHaveLength(3);
    expect(result).toMatchObject({
      totalRows: 3,
      okRows: 3,
      failedRows: 0,
      errors: [],
      updatedItemIds: ['con'],
    });
    expect(prisma.item('other').actualCents).toBe(0); // same code in another project is untouched
    expect(prisma.transactions).toEqual([{ timeout: 20000, maxWait: 5000 }]);
  });

  it('should keep deliveries and actualCents unchanged when the same rows are re-imported [AC-10.2]', async () => {
    await service.import('p1', { fileName: 'a.csv', rows: twoInvoices });
    const firstIds = prisma.state.deliveries.map((d) => d.id);

    const again = await service.import('p1', {
      fileName: 'a.csv',
      rows: twoInvoices.map((r) => ({
        ...r,
        deliveryNoteNo: ` ${r.deliveryNoteNo} `,
      })),
    });

    expect(prisma.state.deliveries.map((d) => d.id)).toEqual(firstIds);
    expect(prisma.item('con').actualCents).toBe(15050);
    expect(prisma.item('con').actualCents).not.toBe(30100);
    expect(again.okRows).toBe(2);
    expect(prisma.state.batches).toHaveLength(2); // every import is recorded
    expect(
      prisma.state.deliveries.every((d) => d.batchId === again.batchId),
    ).toBe(true);
  });

  it('should report row-numbered errors and apply good rows when the file is mixed [AC-10.3]', async () => {
    const result = await service.import('p1', {
      fileName: 'mixed.csv',
      rows: [
        row({ deliveryNoteNo: 'OK-1' }),
        row({ itemCode: 'MAT-XXX-999', deliveryNoteNo: 'A' }),
        row({ date: '2026-13-01', deliveryNoteNo: 'B' }),
        row({ quantity: '-1', deliveryNoteNo: 'C' }),
        row({ invoiceAmountEur: '12,5', deliveryNoteNo: 'D' }),
        row({ deliveryNoteNo: '' }),
      ],
    });

    expect(result.errors.map((e) => [e.row, e.field])).toEqual([
      [2, 'itemCode'],
      [3, 'date'],
      [4, 'quantity'],
      [5, 'invoiceAmountEur'],
      [6, 'deliveryNoteNo'],
    ]);
    expect(result).toMatchObject({ totalRows: 6, okRows: 1, failedRows: 5 });
    expect(prisma.state.deliveries.map((d) => d.deliveryNoteNo)).toEqual([
      'OK-1',
    ]);
    expect(prisma.item('con').actualCents).toBe(10000);
    const batch = prisma.state.batches[0];
    expect(batch).toMatchObject({
      fileName: 'mixed.csv',
      totalRows: 6,
      okRows: 1,
      failedRows: 5,
    });
    expect(JSON.parse(batch.errorsJson)).toEqual(result.errors);
  });

  it.each([
    ['empty rows', []],
    [
      'a renamed header',
      [(({ itemCode, ...rest }) => ({ ...rest, Itemcode: itemCode }))(row())],
    ],
  ])(
    'should throw BadRequest without a transaction when the file has %s [AC-10.4]',
    async (_label, rows) => {
      const before = structuredClone(prisma.state);

      await expect(
        service.import('p1', { fileName: 'x.csv', rows: rows as never }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.transactions).toHaveLength(0);
      expect(prisma.state).toEqual(before);
    },
  );

  it('should move deliveryDate when an EXPECTED row is imported [AC-10.5]', async () => {
    const result = await service.import('p1', {
      fileName: 'e.csv',
      rows: [
        row({
          itemCode: 'MAT-WIN-001',
          deliveryNoteNo: 'AV-1',
          kind: 'EXPECTED',
          date: '2026-10-18',
          invoiceAmountEur: '',
        }),
      ],
    });

    expect(prisma.item('win')).toMatchObject({
      deliveryDate: '2026-10-18',
      deliveredDate: null,
      actualCents: 0,
    });
    expect(prisma.item('win').deliveryDate).not.toBe('2026-10-20');
    expect(result.updatedItemIds).toEqual(['win']);
  });

  it('should take the latest EXPECTED date of the file when an item has several', async () => {
    await service.import('p1', {
      fileName: 'e.csv',
      rows: [
        row({
          itemCode: 'MAT-WIN-001',
          deliveryNoteNo: 'AV-2',
          kind: 'EXPECTED',
          date: '2026-10-25',
          invoiceAmountEur: '',
        }),
        row({
          itemCode: 'MAT-WIN-001',
          deliveryNoteNo: 'AV-1',
          kind: 'EXPECTED',
          date: '2026-10-18',
          invoiceAmountEur: '',
        }),
      ],
    });

    expect(prisma.item('win').deliveryDate).toBe('2026-10-25');
  });

  it('should clear deliveredDate and actual when a note switches from DELIVERED to EXPECTED', async () => {
    await service.import('p1', { fileName: 'a.csv', rows: [row()] });
    expect(prisma.item('con').deliveredDate).toBe('2026-09-01');

    await service.import('p1', {
      fileName: 'b.csv',
      rows: [row({ kind: 'EXPECTED', invoiceAmountEur: '' })],
    });

    expect(prisma.item('con')).toMatchObject({
      deliveredDate: null,
      actualCents: 0,
      deliveryDate: '2026-09-01',
    });
    expect(prisma.state.deliveries).toHaveLength(1);
  });

  it('should keep a manual actual when the item never had a DELIVERED delivery', async () => {
    prisma.item('win').actualCents = 4200;

    await service.import('p1', {
      fileName: 'e.csv',
      rows: [
        row({
          itemCode: 'MAT-WIN-001',
          kind: 'EXPECTED',
          invoiceAmountEur: '',
        }),
      ],
    });

    expect(prisma.item('win').actualCents).toBe(4200);
  });

  it('should reject a row that would push the item invoice total over the Int limit', async () => {
    const result = await service.import('p1', {
      fileName: 'big.csv',
      rows: [
        row({ deliveryNoteNo: 'B-1', invoiceAmountEur: '15000000.00' }),
        row({ deliveryNoteNo: 'B-2', invoiceAmountEur: '15000000.00' }),
      ],
    });

    expect(result.errors).toEqual([
      {
        row: 2,
        field: 'invoiceAmountEur',
        message: expect.stringMatching(/exceeds/),
      },
    ]);
    expect(result).toMatchObject({ okRows: 1, failedRows: 1 });
    expect(prisma.item('con').actualCents).toBe(1_500_000_000);
  });

  it('should commit nothing when a write fails inside the transaction', async () => {
    prisma.failOnUpsert = 2;
    const before = structuredClone(prisma.state);

    await expect(
      service.import('p1', { fileName: 'a.csv', rows: twoInvoices }),
    ).rejects.toThrow('simulated failure');

    expect(prisma.state).toEqual(before);
  });

  it('should throw NotFound when the project does not exist', async () => {
    await expect(
      service.import('nope', { fileName: 'a.csv', rows: [row()] }),
    ).rejects.toThrow(NotFoundException);
    await expect(service.list('nope')).rejects.toThrow(NotFoundException);
    expect(prisma.transactions).toHaveLength(0);
  });

  it('should list only the project deliveries, newest date first', async () => {
    await service.import('p1', { fileName: 'a.csv', rows: twoInvoices });

    const list = await service.list('p1');

    expect(list.map((d) => d.deliveryNoteNo)).toEqual(['LS-2', 'LS-1']);
    expect(await service.list('p2')).toEqual([]);
  });
});
