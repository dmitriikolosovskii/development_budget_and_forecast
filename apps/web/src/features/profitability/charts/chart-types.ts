/** Data-only chart inputs (integer euro cents). Structural, so block 11 can feed portfolio data. */

export interface CategoryBarRow {
  key: string;
  label: string;
  approved: number;
  actual: number;
  openCommitments: number;
  forecast: number;
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export interface WaterfallStep {
  key: string;
  label: string;
  kind: 'total' | 'up' | 'down';
  /** signed change (for totals: the value itself) */
  delta: number;
  /** invisible stacked base */
  base: number;
  height: number;
}

/** Same shape as `CashflowMonth` and `PortfolioAnalytics.cashflow[i]`. */
export interface CashflowPoint {
  month: string;
  planned: number;
  actual: number;
  forecast: number;
  cumulativePlanned: number;
  cumulativeActual: number;
  cumulativeForecast: number;
}
