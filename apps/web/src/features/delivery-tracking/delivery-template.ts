import { DELIVERY_CSV_COLUMNS } from '@default-project/types';

/** Header plus two sample rows: an announced delivery and a delivered one with its invoice. */
export const DELIVERY_TEMPLATE_CSV =
  [
    DELIVERY_CSV_COLUMNS.join(','),
    'MAT-WIN-001,AB-2026-0001,EXPECTED,2026-11-03,14,',
    'MAT-CON-001,LS-2026-0001,DELIVERED,2026-10-02,12.5,2406.25',
  ].join('\n') + '\n';

/** Starts a browser download of the template CSV. */
export function downloadDeliveryTemplate(): void {
  const url = URL.createObjectURL(
    new Blob([DELIVERY_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'deliveries-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}
