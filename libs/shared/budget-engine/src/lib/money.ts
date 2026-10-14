const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

function toSafeNumber(value: bigint, what: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw new RangeError(`${what} is out of the safe integer range: ${value}`);
  return n;
}

/** num / den rounded half away from zero (−2.5 → −3). Throws when den = 0 or the result is not a safe integer. */
export function roundHalfUp(num: bigint, den: bigint): number {
  if (den === ZERO) throw new RangeError('roundHalfUp: division by zero');
  const negative = num < ZERO !== den < ZERO;
  const n = num < ZERO ? -num : num;
  const d = den < ZERO ? -den : den;
  let q = n / d;
  if ((n % d) * TWO >= d) q += ONE;
  return toSafeNumber(negative ? -q : q, 'roundHalfUp result');
}

/** Planned amount of a row: qty (milli-units) × unit price (cents), rounded once (CONTRACTS §3). */
export function itemPlannedCents(item: {
  qtyMilli: number;
  unitPriceCents: number;
}): number {
  return roundHalfUp(
    BigInt(item.qtyMilli) * BigInt(item.unitPriceCents),
    BigInt(1000),
  );
}

// "1234", "1,234" (thousands groups) with an optional fraction; never parsed via float.
const DECIMAL = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;

function parseScaled(
  input: string,
  decimals: number,
  what: string,
  allowEuro: boolean,
): number {
  let s = input.trim();
  if (allowEuro && s.startsWith('€')) s = s.slice(1).trim();
  const m = DECIMAL.exec(s);
  if (!m) throw new Error(`Invalid ${what}: "${input}"`);
  const whole = m[1].replace(/,/g, '');
  const frac = m[2] ?? '';
  if (frac.length > decimals)
    throw new Error(
      `Invalid ${what}: "${input}" has more than ${decimals} decimal places`,
    );
  const scaled = BigInt(whole + frac.padEnd(decimals, '0'));
  return toSafeNumber(scaled, what);
}

/** "1,234.56" → 123456. Accepts an optional leading "€"; rejects negatives and more than 2 decimals. */
export function parseEurToCents(input: string): number {
  return parseScaled(input, 2, 'amount', true);
}

/** "12.5" → 12500 milli-units. Rejects negatives and more than 3 decimals. */
export function parseQtyToMilli(input: string): number {
  return parseScaled(input, 3, 'quantity', false);
}
