import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkSchedule, parseEurToCents, summarizeProject } from '@default-project/budget-engine';
import { isIsoDate } from '@default-project/types';
import { buildOrganizations } from './organizations';
import { buildTauchaSeed } from './taucha';
import { toSnapshot } from './to-snapshot';

// Block 10's e2e fixtures (apps/web-e2e/fixtures) must keep matching the Taucha seed.
const FIXTURES = join(__dirname, '../../../web-e2e/fixtures');
const HEADER = 'itemCode,deliveryNoteNo,kind,date,quantity,invoiceAmountEur';

interface Row {
  itemCode: string;
  deliveryNoteNo: string;
  kind: string;
  date: string;
  quantity: string;
  invoiceAmountEur: string;
}

/** Minimal CSV reader: comma-separated, double quotes around a field that contains a comma. */
function readCsv(name: string): { header: string; rows: Row[] } {
  const [header, ...lines] = readFileSync(join(FIXTURES, name), 'utf8').trim().split('\n');
  const rows = lines.map((line) => {
    const cells = line.match(/("[^"]*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')) ?? [];
    const [itemCode, deliveryNoteNo, kind, date, quantity, invoiceAmountEur] = cells;
    return { itemCode, deliveryNoteNo, kind, date, quantity, invoiceAmountEur };
  });
  return { header, rows };
}

describe('delivery CSV fixtures', () => {
  const seed = buildTauchaSeed();
  const codes = new Set(seed.items.map((i) => i.code));
  const seededNotes = new Set(seed.deliveries.map((d) => `${d.itemCode}|${d.deliveryNoteNo}`));

  it('should list 6 valid rows for existing Taucha items without clashing with seeded delivery notes', () => {
    const { header, rows } = readCsv('deliveries-valid.csv');
    expect(header).toBe(HEADER);
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect([r.itemCode, codes.has(r.itemCode), isIsoDate(r.date), ['EXPECTED', 'DELIVERED'].includes(r.kind)]).toEqual([r.itemCode, true, true, true]);
      expect(seededNotes.has(`${r.itemCode}|${r.deliveryNoteNo}`)).toBe(false);
      if (r.kind === 'DELIVERED') expect(() => parseEurToCents(r.invoiceAmountEur)).not.toThrow();
    }
    expect(new Set(rows.map((r) => `${r.itemCode}|${r.deliveryNoteNo}`)).size).toBe(6);
  });

  it('should avoid the demo conflicts and items whose actual comes from elsewhere', () => {
    const { rows } = readCsv('deliveries-valid.csv');
    const byCode = new Map(seed.items.map((i) => [i.code, i]));
    for (const r of rows) {
      expect(['MAT-WIN-001', 'MAT-HEA-001', 'MAT-DRP-001']).not.toContain(r.itemCode);
      expect([r.itemCode, byCode.get(r.itemCode)?.actualCents]).toEqual([r.itemCode, 0]);
    }
  });

  it('should add no conflict, overdue item or overrun and deliver the front door when the valid rows are applied', () => {
    const { rows } = readCsv('deliveries-valid.csv');
    // block 10's effects (CONTRACTS §5): EXPECTED → deliveryDate; DELIVERED → deliveredDate and actual = Σ invoices
    const items = toSnapshot(seed, buildOrganizations()).items.map((item) => {
      const mine = rows.filter((r) => r.itemCode === item.code);
      const delivered = mine.filter((r) => r.kind === 'DELIVERED');
      const expected = mine.filter((r) => r.kind === 'EXPECTED');
      return {
        ...item,
        deliveryDate: expected.at(-1)?.date ?? item.deliveryDate,
        deliveredDate: delivered.map((r) => r.date).sort().at(-1) ?? item.deliveredDate,
        actualCents: delivered.length ? delivered.reduce((s, r) => s + parseEurToCents(r.invoiceAmountEur), 0) : item.actualCents,
      };
    });
    const before = toSnapshot(seed, buildOrganizations());
    const statuses = (list: typeof items) => Object.values(checkSchedule(list, '2026-10-14')).map((r) => r.status);
    const count = (list: string[], s: string) => list.filter((x) => x === s).length;
    const after = statuses(items);
    expect(count(after, 'LATE_FOR_WORK')).toBe(2);
    expect(count(after, 'OVERDUE')).toBe(0);
    expect(count(after, 'AT_RISK')).toBe(1);
    expect(checkSchedule(items, '2026-10-14')['MAT-WIN-002'].status).toBe('DELIVERED');
    expect(summarizeProject({ ...before, items }).overrunLines).toEqual(summarizeProject(before).overrunLines);
  });

  it('should carry one defect per invalid row plus 2 valid rows', () => {
    const { header, rows } = readCsv('deliveries-invalid.csv');
    expect(header).toBe(HEADER);
    expect(rows).toHaveLength(8);
    expect(codes.has(rows[0].itemCode)).toBe(false); // row 1: unknown code
    expect(isIsoDate(rows[1].date)).toBe(false); // row 2: bad date
    expect(rows[2].quantity.startsWith('-')).toBe(true); // row 3: negative quantity
    expect(rows[3].invoiceAmountEur).toBe('12,5'); // row 4: decimal comma
    expect(`${rows[5].itemCode}|${rows[5].deliveryNoteNo}`).toBe(`${rows[4].itemCode}|${rows[4].deliveryNoteNo}`); // row 6: duplicate of row 5
    expect([rows[6].kind, rows[6].invoiceAmountEur]).toEqual(['DELIVERED', '']); // row 7: delivered without invoice
    for (const valid of [rows[4], rows[7]]) {
      expect([valid.itemCode, codes.has(valid.itemCode), isIsoDate(valid.date)]).toEqual([valid.itemCode, true, true]);
    }
  });
});
