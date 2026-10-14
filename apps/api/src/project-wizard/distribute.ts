/**
 * Splits `total` cents over `weights` in proportion, exactly: every share is floored and the leftover cents
 * (fewer than the number of shares) go to the largest weight, the first one on a tie. Σ result === total.
 * All weights 0 → everything goes to the first share.
 */
export function distribute(
  total: number,
  weights: readonly number[],
): number[] {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new RangeError(`total must be a non-negative integer: ${total}`);
  if (weights.length === 0) {
    if (total !== 0)
      throw new RangeError('cannot distribute a non-zero total over no shares');
    return [];
  }
  const sum = weights.reduce((acc, w) => acc + BigInt(w), BigInt(0));
  if (sum === BigInt(0)) return weights.map((_, i) => (i === 0 ? total : 0));

  const shares = weights.map((w) => Number((BigInt(total) * BigInt(w)) / sum));
  const largest = weights.reduce(
    (best, w, i) => (w > weights[best] ? i : best),
    0,
  );
  shares[largest] += total - shares.reduce((acc, s) => acc + s, 0);
  return shares;
}
