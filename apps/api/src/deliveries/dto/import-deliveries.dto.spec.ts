import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ImportDeliveriesDto, MAX_IMPORT_ROWS } from './import-deliveries.dto';

// Same options as main.ts: rows must survive whitelist + transform untouched.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const run = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: ImportDeliveriesDto });

const row = {
  itemCode: 'MAT-CON-001',
  deliveryNoteNo: 'LS-1',
  kind: 'DELIVERED',
  date: '2026-09-01',
  quantity: '1',
  invoiceAmountEur: '1.00',
};

describe('ImportDeliveriesDto', () => {
  it('should keep every cell of a row when the global pipe runs', async () => {
    const dto = await run({
      fileName: 'a.csv',
      rows: [{ ...row, extra: 'x' }],
    });
    expect(dto.rows).toEqual([{ ...row, extra: 'x' }]);
  });

  it('should reject more than the row limit', async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => row);
    await expect(run({ fileName: 'a.csv', rows })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      run({ fileName: 'a.csv', rows: rows.slice(1) }),
    ).resolves.toBeDefined();
  });

  it('should reject a missing fileName or non-object rows', async () => {
    await expect(run({ rows: [row] })).rejects.toThrow(BadRequestException);
    await expect(run({ fileName: 'a.csv', rows: ['x'] })).rejects.toThrow(
      BadRequestException,
    );
  });
});
