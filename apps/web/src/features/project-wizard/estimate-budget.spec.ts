import { makeItem, makeLine } from '@default-project/budget-engine';
import { estimateBudget, type EstimateTemplate } from './estimate-budget';

/** A small template: one line per category plus the contingency line (no rows). */
function template(): EstimateTemplate {
  const lines = [
    makeLine({
      id: 'pur',
      category: 'LAND',
      section: 'purchase',
      approvedCents: 9_000_000,
    }),
    makeLine({
      id: 'acq',
      category: 'LAND',
      section: 'acquisition-costs',
      approvedCents: 1_000_000,
    }),
    makeLine({
      id: 'des',
      category: 'ARCHITECTURE',
      section: 'design',
      approvedCents: 4_000_000,
    }),
    makeLine({
      id: 'con',
      category: 'MATERIALS',
      section: 'concrete',
      approvedCents: 1_000_000,
    }),
    makeLine({
      id: 'shl',
      category: 'CONSTRUCTION',
      section: 'shell',
      approvedCents: 500_000,
    }),
    makeLine({
      id: 'ctg',
      category: 'CONSTRUCTION',
      section: 'contingency',
      approvedCents: 100_000,
    }),
    makeLine({
      id: 'web',
      category: 'MARKETING',
      section: 'website-seo',
      approvedCents: 300_000,
    }),
  ];
  const items = [
    makeItem({
      budgetLineId: 'pur',
      code: 'SRV-PUR-001',
      unit: 'm2',
      qtyMilli: 520_000,
      unitPriceCents: 13_000,
    }),
    makeItem({
      budgetLineId: 'acq',
      code: 'SRV-ACQ-001',
      unit: 'lump',
      qtyMilli: 1000,
      unitPriceCents: 743_600,
    }),
    makeItem({
      budgetLineId: 'des',
      code: 'SRV-DES-001',
      unit: 'lump',
      qtyMilli: 1000,
      unitPriceCents: 4_000_000,
    }),
    // 1002 m³ × 1.25 = 1252.5 → 1253 milli, × 1,000.00 € = 1,253.00 €
    makeItem({
      budgetLineId: 'con',
      code: 'MAT-CON-001',
      unit: 'm3',
      qtyMilli: 1002,
      unitPriceCents: 100_000,
    }),
    // counted rows are not scaled: still one piece
    makeItem({
      budgetLineId: 'con',
      code: 'MAT-CON-002',
      unit: 'pcs',
      qtyMilli: 1000,
      unitPriceCents: 800_000,
    }),
    makeItem({
      budgetLineId: 'shl',
      code: 'WRK-SHL-001',
      unit: 'h',
      qtyMilli: 100_000,
      unitPriceCents: 5_000,
    }),
    makeItem({
      budgetLineId: 'web',
      code: 'SRV-WEB-001',
      unit: 'lump',
      qtyMilli: 1000,
      unitPriceCents: 250_000,
    }),
  ];
  return { budgetLines: lines, items };
}

const LAND = { areaM2: 600, landValuePerM2Cents: 30_000, state: 'Bayern' };

describe('estimateBudget', () => {
  it('should recompute land from the plot and the state transfer tax [AC-12.4]', () => {
    const e = estimateBudget({ livingAreaM2: 144, land: LAND }, template());

    // 600 m² × 300 € = 180,000 €; Bavaria 3.5 % = 6,300 €
    expect(e.land).toMatchObject({
      purchase: 18_000_000,
      transferTax: 630_000,
      transferTaxBps: 350,
      taxEstimated: false,
      notary: 270_000,
      registry: 90_000,
    });
    expect(e.approvedByCategory.LAND).toBe(18_000_000 + 630_000);
    expect(
      estimateBudget(
        { livingAreaM2: 144, land: { ...LAND, state: 'Saarland' } },
        template(),
      ).land,
    ).toMatchObject({ transferTaxBps: 500, taxEstimated: true });
  });

  it('should scale materials, construction and HOAI by livingArea / 144 and keep counted rows [AC-12.4]', () => {
    const base = estimateBudget({ livingAreaM2: 144, land: LAND }, template());
    const big = estimateBudget({ livingAreaM2: 180, land: LAND }, template());

    expect(base.plannedByCategory.MATERIALS).toBe(100_200 + 800_000);
    expect(big.plannedByCategory.MATERIALS).toBe(125_300 + 800_000);
    // approved = max(template approved × 1.25, planned)
    expect(big.approvedByCategory.MATERIALS).toBe(1_250_000);
    expect(big.approvedByCategory.ARCHITECTURE).toBe(5_000_000);
    // shell 625,000 (scaled approved ≥ planned 625,000) + contingency 125,000 (no rows)
    expect(big.approvedByCategory.CONSTRUCTION).toBe(625_000 + 125_000);
    expect(big.approvedByCategory.MARKETING).toBe(
      base.approvedByCategory.MARKETING,
    );
  });

  it('should never default a category below its planned cost [AC-12.4]', () => {
    const e = estimateBudget({ livingAreaM2: 250, land: LAND }, template());

    for (const c of [
      'LAND',
      'ARCHITECTURE',
      'MATERIALS',
      'CONSTRUCTION',
      'MARKETING',
    ] as const) {
      expect(e.approvedByCategory[c]).toBeGreaterThanOrEqual(
        e.plannedByCategory[c],
      );
    }
    expect(e.approvedTotal).toBe(
      Object.values(e.approvedByCategory).reduce((a, b) => a + b, 0),
    );
  });

  it('should treat invalid numbers as the template area and an empty plot', () => {
    const e = estimateBudget(
      {
        livingAreaM2: Number.NaN,
        land: { areaM2: Number.NaN, landValuePerM2Cents: -1, state: '' },
      },
      template(),
    );

    expect(e.land.purchase).toBe(0);
    expect(e.plannedByCategory.MATERIALS).toBe(900_200);
  });
});
