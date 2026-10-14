import Papa from 'papaparse';
import {
  DELIVERY_CSV_COLUMNS,
  type DeliveryImportRow,
} from '@default-project/types';

/** Server cap (DTO `@ArrayMaxSize`) — also keeps the request under the API's 100 kb JSON limit. */
export const MAX_IMPORT_ROWS = 500;
/** Request bodies above this are refused before sending (Express answers 413 at 100 kb). */
export const MAX_IMPORT_BYTES = 95_000;

export interface ParsedDeliveries {
  rows: DeliveryImportRow[];
  /** A reason the whole file cannot be imported (headers, empty, too big); `null` when it can. */
  fileError: string | null;
}

/**
 * Parses a supplier CSV (`,` or `;`, UTF-8 with or without BOM) without type coercion: every cell
 * stays a string. Blank lines are skipped, so row N is the N-th data row as on the server; extra
 * columns are dropped and short rows get `""` for the missing cells.
 */
export function parseDeliveriesCsv(text: string): ParsedDeliveries {
  const result = Papa.parse<Record<string, string | undefined>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
  });
  const fields = result.meta.fields ?? [];
  const missing = DELIVERY_CSV_COLUMNS.filter((c) => !fields.includes(c));
  if (missing.length) {
    return {
      rows: [],
      fileError: `Wrong headers: missing ${missing.join(', ')}. Expected ${DELIVERY_CSV_COLUMNS.join(',')}`,
    };
  }
  const rows = result.data.map((raw) => {
    const row = {} as DeliveryImportRow;
    for (const column of DELIVERY_CSV_COLUMNS) row[column] = raw[column] ?? '';
    return row;
  });
  if (rows.length === 0)
    return { rows, fileError: 'The file has no data rows' };
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      rows,
      fileError: `The file has ${rows.length} rows; split it into files of at most ${MAX_IMPORT_ROWS} rows`,
    };
  }
  return { rows, fileError: null };
}

/** `true` when `{fileName, rows}` would exceed the API body limit. */
export function isPayloadTooLarge(
  fileName: string,
  rows: DeliveryImportRow[],
): boolean {
  return (
    new TextEncoder().encode(JSON.stringify({ fileName, rows })).length >
    MAX_IMPORT_BYTES
  );
}
