/** Real-estate transfer tax (Grunderwerbsteuer) by Bundesland, in bps; the web keeps the same table for its hint. */
const RATES: Record<string, number> = {
  sachsen: 550,
  saxony: 550,
  bayern: 350,
  bavaria: 350,
  'nordrhein-westfalen': 650,
  'north rhine-westphalia': 650,
  nrw: 650,
  berlin: 600,
  brandenburg: 650,
  hessen: 600,
  hesse: 600,
  'baden-württemberg': 500,
  'baden-wuerttemberg': 500,
};

/** Rate used for any other state (an estimate, shown as such in the UI). */
export const DEFAULT_TRANSFER_TAX_BPS = 500;

export function transferTaxBps(state: string): {
  bps: number;
  estimated: boolean;
} {
  const bps = RATES[state.trim().toLowerCase()];
  return bps === undefined
    ? { bps: DEFAULT_TRANSFER_TAX_BPS, estimated: true }
    : { bps, estimated: false };
}
