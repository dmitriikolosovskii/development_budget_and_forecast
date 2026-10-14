import {
  DELIVERY_CSV_COLUMNS,
  DELIVERY_KINDS,
  isIsoDate,
  MAX_INT_FIELD,
  type DeliveryKind,
  type ImportRowError,
  type ItemKind,
} from '@default-project/types';
import {
  parseEurToCents,
  parseQtyToMilli,
} from '@default-project/budget-engine';

/** A project item as the validator needs it, looked up by its trimmed `code`. */
export interface ItemRef {
  id: string;
  kind: ItemKind;
}

/** A row that passed every check, converted to stored units. */
export interface ValidDeliveryRow {
  /** 1-based data row number (the header is not counted). */
  row: number;
  costItemId: string;
  itemCode: string;
  deliveryNoteNo: string;
  kind: DeliveryKind;
  date: string;
  qtyMilli: number;
  invoiceCents: number | null;
}

type Column = (typeof DELIVERY_CSV_COLUMNS)[number];
type RawRow = Record<string, unknown>;

const MAX_TEXT = 64;
// Plain decimals with a dot only: "12,5" and "1,234.00" are rejected before the engine parser sees them.
const QTY = /^\d+(\.\d{1,3})?$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;
// Cells a spreadsheet would execute as a formula (CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/;

const normaliseKey = (key: string) => key.replace(/^\uFEFF/, '').trim();

function normaliseRow(raw: RawRow): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(raw))
    out.set(normaliseKey(key), value);
  return out;
}

/**
 * Header check on the first row's keys (CONTRACTS §5): `null` when the file can be imported,
 * otherwise the reason for a 400. Extra columns are allowed and ignored.
 */
export function headerError(rows: RawRow[]): string | null {
  if (rows.length === 0) return 'File has no data rows';
  const present = new Set(Object.keys(rows[0]).map(normaliseKey));
  const missing = DELIVERY_CSV_COLUMNS.filter((c) => !present.has(c));
  if (missing.length === 0) return null;
  return `Wrong headers: missing ${missing.join(', ')}. Expected ${DELIVERY_CSV_COLUMNS.join(',')}`;
}

function checkText(
  value: string,
  field: Column,
  errs: ImportRowError[],
  row: number,
): void {
  if (!value) errs.push({ row, field, message: 'is required' });
  else if (value.length > MAX_TEXT)
    errs.push({
      row,
      field,
      message: `must be at most ${MAX_TEXT} characters`,
    });
  else if (FORMULA_START.test(value))
    errs.push({
      row,
      field,
      message: 'must not start with = + - @ or a control character',
    });
}

function parseScaled(
  value: string,
  pattern: RegExp,
  parse: (s: string) => number,
): number | null {
  if (!pattern.test(value)) return null;
  try {
    const n = parse(value);
    return n > MAX_INT_FIELD ? null : n;
  } catch {
    return null; // beyond the safe integer range
  }
}

/**
 * Validates every row independently (CONTRACTS §5, judge constraints 2–4, 10). Pure: the caller
 * supplies the project's items. A row with any error is reported (all its errors) and not applied.
 * A second row with the same (itemCode, deliveryNoteNo) is a "duplicate deliveryNoteNo" error.
 */
export function validateDeliveryRows(
  rows: RawRow[],
  itemsByCode: ReadonlyMap<string, ItemRef>,
): { valid: ValidDeliveryRow[]; errors: ImportRowError[] } {
  const valid: ValidDeliveryRow[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();

  rows.forEach((raw, index) => {
    const row = index + 1;
    const cells = normaliseRow(raw);
    const errs: ImportRowError[] = [];
    const text = {} as Record<Column, string>;
    for (const column of DELIVERY_CSV_COLUMNS) {
      const value = cells.get(column);
      if (typeof value !== 'string') {
        errs.push({ row, field: column, message: 'must be text' });
        text[column] = '';
      } else text[column] = value.trim();
    }
    if (errs.length) {
      errors.push(...errs);
      return;
    }

    checkText(text.itemCode, 'itemCode', errs, row);
    checkText(text.deliveryNoteNo, 'deliveryNoteNo', errs, row);

    const item = itemsByCode.get(text.itemCode);
    if (text.itemCode && !errs.some((e) => e.field === 'itemCode')) {
      if (!item)
        errs.push({
          row,
          field: 'itemCode',
          message: `Unknown item code ${text.itemCode}`,
        });
      else if (item.kind !== 'MATERIAL')
        errs.push({
          row,
          field: 'itemCode',
          message: `${text.itemCode} is not a material item`,
        });
    }

    const kind = text.kind.toUpperCase();
    if (!(DELIVERY_KINDS as readonly string[]).includes(kind))
      errs.push({
        row,
        field: 'kind',
        message: 'must be EXPECTED or DELIVERED',
      });

    if (!isIsoDate(text.date))
      errs.push({
        row,
        field: 'date',
        message: 'must be a real date in YYYY-MM-DD format',
      });

    const qtyMilli = parseScaled(text.quantity, QTY, parseQtyToMilli);
    if (qtyMilli === null || qtyMilli === 0)
      errs.push({
        row,
        field: 'quantity',
        message: 'must be a positive number with a dot and at most 3 decimals',
      });

    let invoiceCents: number | null = null;
    if (text.invoiceAmountEur) {
      invoiceCents = parseScaled(
        text.invoiceAmountEur,
        AMOUNT,
        parseEurToCents,
      );
      if (invoiceCents === null)
        errs.push({
          row,
          field: 'invoiceAmountEur',
          message:
            'must be an amount with a dot and at most 2 decimals, e.g. 1234.50',
        });
    } else if (kind === 'DELIVERED') {
      errs.push({
        row,
        field: 'invoiceAmountEur',
        message: 'is required for DELIVERED rows',
      });
    }

    const key = `${text.itemCode}\u0000${text.deliveryNoteNo}`;
    if (text.itemCode && text.deliveryNoteNo) {
      if (seen.has(key))
        errs.push({
          row,
          field: 'deliveryNoteNo',
          message: 'duplicate deliveryNoteNo',
        });
      seen.add(key);
    }

    if (errs.length || !item) {
      errors.push(...errs);
      return;
    }
    valid.push({
      row,
      costItemId: item.id,
      itemCode: text.itemCode,
      deliveryNoteNo: text.deliveryNoteNo,
      kind: kind as DeliveryKind,
      date: text.date,
      qtyMilli: qtyMilli as number,
      invoiceCents,
    });
  });

  return { valid, errors };
}
