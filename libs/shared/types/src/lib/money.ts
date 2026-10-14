import { z } from 'zod';

/** Upper bound for every stored money/quantity field: Prisma `Int` is 32-bit (CONTRACTS §1). */
export const MAX_INT_FIELD = 2_000_000_000;
/** Upper bound for a rate in basis points (1000%). */
export const MAX_BPS = 100_000;

/** Euro cents, net, non-negative integer. */
export const centsSchema = z.number().int().min(0).max(MAX_INT_FIELD);
/** Quantity in milli-units, non-negative integer. */
export const qtyMilliSchema = z.number().int().min(0).max(MAX_INT_FIELD);
/** Basis points, non-negative integer. */
export const bpsSchema = z.number().int().min(0).max(MAX_BPS);
/** A signed integer amount (variance, profit). */
export const signedCentsSchema = z.number().int();

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `true` when `value` is a real calendar date written as `YYYY-MM-DD`. */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

/** Calendar date `YYYY-MM-DD` (lexicographic order = date order). */
export const isoDateSchema = z.iso.date({
  error: 'Expected a date in YYYY-MM-DD format',
});

/** Prisma `DateTime` as it arrives over JSON. */
export const timestampSchema = z.string();

/** Record id: cuid from Prisma or a uuid from a deep copy, never a format check. */
export const idSchema = z.string().min(1);
