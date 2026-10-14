import {
  headerError,
  validateDeliveryRows,
  type ItemRef,
} from './delivery-rows.validator';

const items = new Map<string, ItemRef>([
  ['MAT-CON-001', { id: 'con', kind: 'MATERIAL' }],
  ['MAT-WIN-001', { id: 'win', kind: 'MATERIAL' }],
  ['WRK-SHL-001', { id: 'wrk', kind: 'WORK' }],
]);

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    itemCode: 'MAT-CON-001',
    deliveryNoteNo: 'LS-1',
    kind: 'DELIVERED',
    date: '2026-09-01',
    quantity: '10.5',
    invoiceAmountEur: '100.00',
    ...over,
  };
}

describe('headerError', () => {
  it('should return null when all six headers are present (extra columns allowed)', () => {
    expect(headerError([{ ...row(), extra: 'x' }])).toBeNull();
  });

  it('should accept a BOM and spaces around the first header', () => {
    const { itemCode, ...rest } = row();
    expect(headerError([{ '\uFEFF itemCode ': itemCode, ...rest }])).toBeNull();
  });

  it('should report no data rows when rows are empty [AC-10.4]', () => {
    expect(headerError([])).toMatch(/no data rows/i);
  });

  it('should report the missing header when a column is renamed [AC-10.4]', () => {
    const { itemCode, ...rest } = row();
    expect(headerError([{ Itemcode: itemCode, ...rest }])).toMatch(
      /Wrong headers.*itemCode/,
    );
  });
});

describe('validateDeliveryRows', () => {
  it('should convert a valid DELIVERED row to cents and milli-units', () => {
    const { valid, errors } = validateDeliveryRows([row()], items);
    expect(errors).toEqual([]);
    expect(valid).toEqual([
      {
        row: 1,
        costItemId: 'con',
        itemCode: 'MAT-CON-001',
        deliveryNoteNo: 'LS-1',
        kind: 'DELIVERED',
        date: '2026-09-01',
        qtyMilli: 10500,
        invoiceCents: 10000,
      },
    ]);
  });

  it('should report each bad field with its 1-based row number and keep good rows [AC-10.3]', () => {
    const rows = [
      row({ deliveryNoteNo: 'OK-1' }),
      row({ itemCode: 'MAT-XXX-999', deliveryNoteNo: 'A' }),
      row({ date: '2026-13-01', deliveryNoteNo: 'B' }),
      row({ quantity: '-1', deliveryNoteNo: 'C' }),
      row({ invoiceAmountEur: '12,5', deliveryNoteNo: 'D' }),
      row({ deliveryNoteNo: '' }),
      row({ deliveryNoteNo: 'OK-2' }),
    ];
    const { valid, errors } = validateDeliveryRows(rows, items);
    expect(errors.map((e) => [e.row, e.field])).toEqual([
      [2, 'itemCode'],
      [3, 'date'],
      [4, 'quantity'],
      [5, 'invoiceAmountEur'],
      [6, 'deliveryNoteNo'],
    ]);
    expect(valid.map((v) => v.deliveryNoteNo)).toEqual(['OK-1', 'OK-2']);
    expect(valid.map((v) => v.row)).toEqual([1, 7]);
  });

  it.each([
    ['date', '2026-02-30'],
    ['quantity', '0'],
    ['quantity', '1.0000'],
    ['quantity', '1e3'],
    ['invoiceAmountEur', '10.555'],
    ['invoiceAmountEur', '1,234.00'],
    ['kind', 'SHIPPED'],
  ])('should reject %s = %p', (field, value) => {
    const { valid, errors } = validateDeliveryRows(
      [row({ [field]: value })],
      items,
    );
    expect(valid).toEqual([]);
    expect(errors).toEqual([expect.objectContaining({ row: 1, field })]);
  });

  it('should accept a leap day, 0.001 quantity and a 1-decimal amount', () => {
    const { valid, errors } = validateDeliveryRows(
      [
        row({
          date: '2028-02-29',
          quantity: '0.001',
          invoiceAmountEur: '10.5',
        }),
      ],
      items,
    );
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({ qtyMilli: 1, invoiceCents: 1050 });
  });

  it('should accept EXPECTED without an amount and reject DELIVERED without one', () => {
    const { valid, errors } = validateDeliveryRows(
      [
        row({ kind: 'EXPECTED', invoiceAmountEur: '', deliveryNoteNo: 'E-1' }),
        row({
          kind: 'DELIVERED',
          invoiceAmountEur: '  ',
          deliveryNoteNo: 'D-1',
        }),
      ],
      items,
    );
    expect(valid).toEqual([
      expect.objectContaining({ kind: 'EXPECTED', invoiceCents: null }),
    ]);
    expect(errors).toEqual([
      expect.objectContaining({ row: 2, field: 'invoiceAmountEur' }),
    ]);
  });

  it('should trim fields and accept kind in any case', () => {
    const { valid } = validateDeliveryRows(
      [
        row({
          kind: ' delivered ',
          itemCode: ' MAT-CON-001 ',
          deliveryNoteNo: ' LS-9 ',
        }),
      ],
      items,
    );
    expect(valid[0]).toMatchObject({
      kind: 'DELIVERED',
      itemCode: 'MAT-CON-001',
      deliveryNoteNo: 'LS-9',
    });
  });

  it('should flag the second row with the same itemCode and deliveryNoteNo as duplicate', () => {
    const { valid, errors } = validateDeliveryRows(
      [row(), row({ deliveryNoteNo: ' LS-1 ' })],
      items,
    );
    expect(valid).toHaveLength(1);
    expect(errors).toEqual([
      { row: 2, field: 'deliveryNoteNo', message: 'duplicate deliveryNoteNo' },
    ]);
  });

  it('should reject an item that is not a MATERIAL', () => {
    const { valid, errors } = validateDeliveryRows(
      [row({ itemCode: 'WRK-SHL-001' })],
      items,
    );
    expect(valid).toEqual([]);
    expect(errors[0]).toMatchObject({ row: 1, field: 'itemCode' });
  });

  it('should report a non-string or missing value as a row error instead of throwing', () => {
    const missing = row({ deliveryNoteNo: 'M-1' });
    delete missing.itemCode;
    const { errors } = validateDeliveryRows(
      [row({ quantity: 5 }), missing],
      items,
    );
    expect(errors).toEqual([
      { row: 1, field: 'quantity', message: 'must be text' },
      { row: 2, field: 'itemCode', message: 'must be text' },
    ]);
  });

  it('should reject spreadsheet formulas in text fields', () => {
    const { valid, errors } = validateDeliveryRows(
      [row({ deliveryNoteNo: '=HYPERLINK("x")' })],
      items,
    );
    expect(valid).toEqual([]);
    expect(errors[0]).toMatchObject({ row: 1, field: 'deliveryNoteNo' });
  });
});
