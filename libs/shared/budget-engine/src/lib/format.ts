import { UNIT_LABELS, type Unit } from '@default-project/types';

const eur = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
});
const eurWhole = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const qty = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 3 });
const pct = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** 123456 → "€1,234.56" (display only; amounts are stored as integer cents). */
export function formatEur(cents: number): string {
  return eur.format(cents / 100);
}

/** 57386100 → "€573,861" */
export function formatEurWhole(cents: number): string {
  return eurWhole.format(cents / 100);
}

/** 12500, 'm3' → "12.5 m³" */
export function formatQty(milli: number, unit?: string): string {
  const n = qty.format(milli / 1000);
  if (!unit) return n;
  return `${n} ${UNIT_LABELS[unit as Unit] ?? unit}`;
}

/** 1500 → "15%" */
export function formatBps(bps: number): string {
  return `${pct.format(bps / 100)}%`;
}

/** "2026-11-03" → "3 Nov 2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return date.format(new Date(Date.UTC(y, m - 1, d)));
}
