import type { Profitability, Summary } from '@default-project/types';
import { roundHalfUp } from './money';

/** Contract price, profit and margin from the approved budget and the company markup (CONTRACTS §3). */
export function computeProfitability(
  summary: Pick<Summary, 'approved' | 'forecast'>,
  markupBps: number,
): Profitability {
  const { approved, forecast } = summary;
  const contractPrice = roundHalfUp(
    BigInt(approved) * BigInt(10000 + markupBps),
    BigInt(10000),
  );
  const plannedProfit = contractPrice - approved;
  const forecastProfit = contractPrice - forecast;
  const marginBps =
    contractPrice === 0
      ? 0
      : roundHalfUp(
          BigInt(forecastProfit) * BigInt(10000),
          BigInt(contractPrice),
        );
  return {
    approved,
    contractPrice,
    plannedProfit,
    forecastProfit,
    marginBps,
    profitErosion: plannedProfit - forecastProfit,
  };
}
