/** Grunderwerbsteuer by Bundesland in bps; the same table as `apps/api/src/project-wizard/transfer-tax.ts`. */
export const GERMAN_STATES: ReadonlyArray<{
  name: string;
  bps: number | null;
}> = [
  { name: 'Sachsen', bps: 550 },
  { name: 'Bayern', bps: 350 },
  { name: 'Nordrhein-Westfalen', bps: 650 },
  { name: 'Berlin', bps: 600 },
  { name: 'Brandenburg', bps: 650 },
  { name: 'Hessen', bps: 600 },
  { name: 'Baden-Württemberg', bps: 500 },
  { name: 'Other state', bps: null },
];

/** Rate used for any other state (an estimate, labelled as such). */
export const DEFAULT_TRANSFER_TAX_BPS = 500;

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

export function transferTaxBps(state: string): {
  bps: number;
  estimated: boolean;
} {
  const bps = RATES[state.trim().toLowerCase()];
  return bps === undefined
    ? { bps: DEFAULT_TRANSFER_TAX_BPS, estimated: true }
    : { bps, estimated: false };
}
