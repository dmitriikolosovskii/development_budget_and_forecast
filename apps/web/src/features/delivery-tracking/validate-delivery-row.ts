import { isIsoDate, type DeliveryImportRow } from '@default-project/types';

type Column = keyof DeliveryImportRow;
export type RowProblems = Partial<Record<Column, string>>;

// Same rules as the API validator (apps/api/src/deliveries/delivery-rows.validator.ts); the server
// re-checks everything, this only highlights problems in the preview before sending.
const QTY = /^\d+(\.\d{1,3})?$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

/** Problems of one preview row, by column. `knownCodes` (MATERIAL codes of the project) is optional. */
export function validateDeliveryRow(
  row: DeliveryImportRow,
  knownCodes?: ReadonlySet<string>,
): RowProblems {
  const problems: RowProblems = {};
  const v = (c: Column) => row[c].trim();
  const kind = v('kind').toUpperCase();

  if (!v('itemCode')) problems.itemCode = 'Item code is required';
  else if (knownCodes && !knownCodes.has(v('itemCode')))
    problems.itemCode = 'Unknown material code';
  if (!v('deliveryNoteNo'))
    problems.deliveryNoteNo = 'Delivery note no. is required';
  if (kind !== 'EXPECTED' && kind !== 'DELIVERED')
    problems.kind = 'Use EXPECTED or DELIVERED';
  if (!isIsoDate(v('date'))) problems.date = 'Use a real date as YYYY-MM-DD';
  if (!QTY.test(v('quantity')) || /^0+(\.0+)?$/.test(v('quantity')))
    problems.quantity = 'Use a positive number with a dot, e.g. 12.5';
  if (v('invoiceAmountEur')) {
    if (!AMOUNT.test(v('invoiceAmountEur')))
      problems.invoiceAmountEur = 'Use an amount with a dot, e.g. 1234.50';
  } else if (kind === 'DELIVERED')
    problems.invoiceAmountEur = 'Invoice amount is required for DELIVERED';
  return problems;
}
