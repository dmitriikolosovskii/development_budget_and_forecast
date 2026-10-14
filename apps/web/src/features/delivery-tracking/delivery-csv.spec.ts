import { makeItem } from '@default-project/budget-engine';
import type { Delivery, ScheduleResult } from '@default-project/types';
import { deliveryKpis, planStatus } from './delivery-log';
import { DELIVERY_TEMPLATE_CSV } from './delivery-template';
import {
  isPayloadTooLarge,
  MAX_IMPORT_ROWS,
  parseDeliveriesCsv,
} from './parse-deliveries-csv';
import { validateDeliveryRow } from './validate-delivery-row';

const HEADER = 'itemCode,deliveryNoteNo,kind,date,quantity,invoiceAmountEur';

describe('parseDeliveriesCsv', () => {
  it('should keep cells as strings when the file uses commas', () => {
    const { rows, fileError } = parseDeliveriesCsv(
      `${HEADER}\nMAT-CON-001,LS-1,DELIVERED,2026-09-01,0010.50,100.00\n`,
    );
    expect(fileError).toBeNull();
    expect(rows).toEqual([
      {
        itemCode: 'MAT-CON-001',
        deliveryNoteNo: 'LS-1',
        kind: 'DELIVERED',
        date: '2026-09-01',
        quantity: '0010.50',
        invoiceAmountEur: '100.00',
      },
    ]);
  });

  it('should read semicolons and a BOM, and keep "12,5" as one cell', () => {
    const { rows, fileError } = parseDeliveriesCsv(
      `\uFEFF${HEADER.replaceAll(',', ';')}\r\nMAT-CON-001;LS-1;DELIVERED;2026-09-01;1;12,5\r\n`,
    );
    expect(fileError).toBeNull();
    expect(rows[0]).toMatchObject({
      itemCode: 'MAT-CON-001',
      invoiceAmountEur: '12,5',
    });
  });

  it('should skip blank lines, drop extra columns and fill short rows with empty cells', () => {
    const { rows } = parseDeliveriesCsv(
      `${HEADER},note\n\nMAT-A,LS-1,EXPECTED,2026-09-01,1,,x\n   \nMAT-B,LS-2\n`,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toHaveProperty('note');
    expect(rows[1]).toEqual({
      itemCode: 'MAT-B',
      deliveryNoteNo: 'LS-2',
      kind: '',
      date: '',
      quantity: '',
      invoiceAmountEur: '',
    });
  });

  it('should refuse the file when a header is missing or renamed', () => {
    const { fileError } = parseDeliveriesCsv(
      'itemcode,deliveryNoteNo,kind,date,qty,invoiceAmountEur\nA,B,C,D,E,F\n',
    );
    expect(fileError).toMatch(/Wrong headers: missing itemCode, quantity/);
  });

  it('should refuse an empty file and a file over the row limit', () => {
    expect(parseDeliveriesCsv(`${HEADER}\n`).fileError).toMatch(/no data rows/);
    const many = Array.from(
      { length: MAX_IMPORT_ROWS + 1 },
      (_, i) => `MAT-A,LS-${i},EXPECTED,2026-09-01,1,`,
    ).join('\n');
    expect(parseDeliveriesCsv(`${HEADER}\n${many}`).fileError).toMatch(
      /split it/,
    );
  });

  it('should parse the downloadable template without problems', () => {
    const { rows, fileError } = parseDeliveriesCsv(DELIVERY_TEMPLATE_CSV);
    expect(fileError).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => validateDeliveryRow(r))).toEqual([{}, {}]);
  });

  it('should flag a payload above the body limit', () => {
    const row = {
      itemCode: 'X'.repeat(64),
      deliveryNoteNo: 'Y'.repeat(64),
      kind: 'DELIVERED',
      date: '2026-09-01',
      quantity: '1',
      invoiceAmountEur: '1.00',
    };
    expect(isPayloadTooLarge('a.csv', Array(500).fill(row))).toBe(true);
    expect(isPayloadTooLarge('a.csv', Array(10).fill(row))).toBe(false);
  });
});

describe('validateDeliveryRow', () => {
  const ok = {
    itemCode: 'MAT-CON-001',
    deliveryNoteNo: 'LS-1',
    kind: 'DELIVERED',
    date: '2026-09-01',
    quantity: '1',
    invoiceAmountEur: '1.00',
  };

  it.each([
    ['date', '2026-13-01'],
    ['date', '2026-02-30'],
    ['quantity', '-1'],
    ['quantity', '0'],
    ['invoiceAmountEur', '12,5'],
    ['deliveryNoteNo', ' '],
    ['kind', 'SHIPPED'],
  ])('should flag %s = %p', (field, value) => {
    expect(Object.keys(validateDeliveryRow({ ...ok, [field]: value }))).toEqual(
      [field],
    );
  });

  it('should require an amount only for DELIVERED and check codes when known', () => {
    expect(
      validateDeliveryRow({ ...ok, kind: 'expected', invoiceAmountEur: '' }),
    ).toEqual({});
    expect(validateDeliveryRow({ ...ok, invoiceAmountEur: '' })).toHaveProperty(
      'invoiceAmountEur',
    );
    expect(validateDeliveryRow(ok, new Set(['MAT-OTHER']))).toHaveProperty(
      'itemCode',
    );
    expect(validateDeliveryRow(ok, new Set(['MAT-CON-001']))).toEqual({});
  });
});

function delivery(over: Partial<Delivery>): Delivery {
  return {
    id: 'd',
    projectId: 'p',
    costItemId: 'i',
    batchId: null,
    deliveryNoteNo: 'LS',
    kind: 'DELIVERED',
    date: '2026-10-01',
    qtyMilli: 1000,
    invoiceCents: 100,
    createdAt: '',
    ...over,
  };
}

describe('planStatus', () => {
  const today = '2026-10-14';
  it('should be on time when delivered on the planned day and late by the difference after it', () => {
    const item = { deliveryDate: '2026-10-01', deliveredDate: '2026-10-04' };
    expect(planStatus(delivery({ date: '2026-10-01' }), item, today)).toEqual({
      kind: 'ON_TIME',
    });
    expect(planStatus(delivery({ date: '2026-10-04' }), item, today)).toEqual({
      kind: 'LATE',
      days: 3,
    });
  });

  it('should mark an EXPECTED row received, overdue or expected', () => {
    const e = delivery({ kind: 'EXPECTED', date: '2026-10-10' });
    expect(
      planStatus(
        e,
        { deliveryDate: '2026-10-10', deliveredDate: '2026-10-11' },
        today,
      ),
    ).toEqual({ kind: 'RECEIVED' });
    expect(
      planStatus(e, { deliveryDate: '2026-10-10', deliveredDate: null }, today),
    ).toEqual({ kind: 'OVERDUE' });
    expect(
      planStatus(
        { ...e, date: today },
        { deliveryDate: today, deliveredDate: null },
        today,
      ),
    ).toEqual({ kind: 'EXPECTED' });
  });
});

describe('deliveryKpis', () => {
  it('should count this month, on-time share, open expected and engine-overdue items', () => {
    const items = {
      a: makeItem({
        id: 'a',
        deliveryDate: '2026-10-05',
        deliveredDate: '2026-10-07',
      }),
      b: makeItem({ id: 'b', deliveryDate: '2026-10-20', deliveredDate: null }),
      c: makeItem({ id: 'c', deliveryDate: null, deliveredDate: '2026-09-01' }),
    };
    const schedule: Record<string, ScheduleResult> = {
      b: { kind: 'MATERIAL', status: 'OVERDUE' },
      w: {
        kind: 'WORK',
        status: 'READY',
        blockingMaterials: [],
        worstDelayDays: 0,
      },
    };
    const kpis = deliveryKpis(
      [
        delivery({ costItemId: 'a', date: '2026-10-03' }), // on time, this month
        delivery({
          costItemId: 'a',
          date: '2026-10-07',
          deliveryNoteNo: 'LS-2',
        }), // late, this month
        delivery({ costItemId: 'c', date: '2026-09-01' }), // no plan date → not measured
        delivery({ costItemId: 'b', kind: 'EXPECTED', date: '2026-10-20' }), // open
        delivery({ costItemId: 'a', kind: 'EXPECTED', date: '2026-10-05' }), // already received
      ],
      items,
      schedule,
      '2026-10-14',
    );
    expect(kpis).toEqual({
      deliveredThisMonth: 2,
      onTimeBps: 5000,
      openExpected: 1,
      overdueItems: 1,
    });
    expect(deliveryKpis([], items, {}, '2026-10-14').onTimeBps).toBeNull();
  });
});
