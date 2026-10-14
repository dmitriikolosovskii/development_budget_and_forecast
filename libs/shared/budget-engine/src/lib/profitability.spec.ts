import { computeProfitability } from './profitability';

describe('computeProfitability', () => {
  it('should price 573,861.00 € at 15% markup to exactly 659,940.15 € [AC-01.6]', () => {
    const p = computeProfitability(
      { approved: 57_386_100, forecast: 57_386_100 },
      1500,
    );
    expect(p).toEqual({
      approved: 57_386_100,
      contractPrice: 65_994_015,
      plannedProfit: 8_607_915,
      forecastProfit: 8_607_915,
      marginBps: 1304,
      profitErosion: 0,
    });
  });

  it('should allow a negative profit when the forecast exceeds the contract price [AC-01.6]', () => {
    const p = computeProfitability(
      { approved: 100_000, forecast: 200_000 },
      1500,
    );
    expect(p).toMatchObject({
      contractPrice: 115_000,
      forecastProfit: -85_000,
      marginBps: -7391,
      profitErosion: 100_000,
    });
  });

  it('should return a 0 margin when the contract price is 0 [AC-01.6]', () => {
    expect(
      computeProfitability({ approved: 0, forecast: 500 }, 1500),
    ).toMatchObject({ contractPrice: 0, marginBps: 0, forecastProfit: -500 });
  });

  it('should round the contract price half up', () => {
    expect(
      computeProfitability({ approved: 10, forecast: 10 }, 1500).contractPrice,
    ).toBe(12);
  });
});
