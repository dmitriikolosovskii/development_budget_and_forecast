import { makeItem } from '@default-project/budget-engine';
import {
  allowedFootprintCm2,
  footprintStatus,
  formatCm2AsM2,
  hasCoordinates,
  houseFootprintCm2,
  osmUrl,
  parseSoilClass,
  plotPriceCents,
  soilRisk,
  utilityCosts,
  utilityTypeForItem,
} from './land-calc';

describe('land-calc: footprint', () => {
  it('should allow 208 m² when the plot is 520 m² with GRZ 0.4 [AC-07.2]', () => {
    const allowed = allowedFootprintCm2(520, 4000);

    expect(allowed).toBe(2_080_000);
    expect(formatCm2AsM2(allowed ?? 0)).toBe('208 m²');
  });

  it('should be within the limit when the house footprint is 90 m² [AC-07.2]', () => {
    const actual = houseFootprintCm2({
      footprintWidthCm: 1000,
      footprintDepthCm: 900,
    });

    expect(actual).toBe(900_000);
    expect(footprintStatus(2_080_000, actual)).toBe('WITHIN');
  });

  it('should be within the limit when the footprint equals it and exceed it by 1 cm² [AC-07.2]', () => {
    expect(footprintStatus(2_080_000, 2_080_000)).toBe('WITHIN');
    expect(footprintStatus(2_080_000, 2_080_001)).toBe('EXCEEDS');
  });

  it('should report "not set" when area, GRZ or the plan is missing [AC-07.2]', () => {
    expect(allowedFootprintCm2(0, 4000)).toBeNull();
    expect(allowedFootprintCm2(520, 0)).toBeNull();
    expect(houseFootprintCm2(null)).toBeNull();
    expect(footprintStatus(null, 900_000)).toBeNull();
    expect(footprintStatus(2_080_000, null)).toBeNull();
  });
});

describe('land-calc: soil risk', () => {
  const soil = (
    groundwaterDepthCm: number | null,
    soilClass = '4 (DIN 18300, medium-hard)',
  ) => soilRisk({ groundwaterDepthCm, soilClass });

  it('should flag a risk when groundwater is 150 cm deep [AC-07.3]', () => {
    const result = soil(150);

    expect(result.risk).toBe(true);
    expect(result.reasons).toEqual(['Groundwater at 1.50 m (< 2 m)']);
  });

  it('should not flag groundwater at exactly 2 m or unknown groundwater [AC-07.3]', () => {
    expect(soil(200).risk).toBe(false);
    expect(soil(null).risk).toBe(false);
  });

  it('should flag soil class 5 and not class 4 [AC-07.3]', () => {
    expect(soil(700, '5').risk).toBe(true);
    expect(
      soil(
        700,
        '4 (DIN 18300, medium-hard to excavate), geotechnical category GK2 (est.)',
      ).risk,
    ).toBe(false);
  });

  it('should read "DIN 18300 class 4" as class 4, never as 18300 [AC-07.3]', () => {
    expect(parseSoilClass('DIN 18300 class 4')).toBe(4);
    expect(soil(700, 'DIN 18300 class 4').risk).toBe(false);
    expect(parseSoilClass('Klasse 6')).toBe(6);
    expect(parseSoilClass('DIN 18300')).toBeNull();
    expect(parseSoilClass('')).toBeNull();
  });
});

describe('land-calc: plot price and utility costs', () => {
  it('should price the plot as area × land value per m² [AC-07.10]', () => {
    expect(plotPriceCents(520, 26_000)).toBe(13_520_000);
    expect(plotPriceCents(0, 26_000)).toBeNull();
    expect(plotPriceCents(520, 0)).toBeNull();
  });

  it('should map a row to at most one utility by the leading word of its name [AC-07.10]', () => {
    expect(
      utilityTypeForItem('Power connection (house connection, meter)'),
    ).toBe('POWER');
    expect(utilityTypeForItem('Water connection')).toBe('WATER');
    expect(
      utilityTypeForItem('Sewer & stormwater connection (throttled discharge)'),
    ).toBe('SEWER');
    expect(utilityTypeForItem('Telecom (fibre) connection')).toBe('TELECOM');
    expect(utilityTypeForItem('District heating connection')).toBe(
      'DISTRICT_HEATING',
    );
    expect(utilityTypeForItem('Temporary site power and water')).toBeNull();
    expect(utilityTypeForItem('Multi-utility wall entry')).toBeNull();
  });

  it('should sum planned costs per type and put the rest under "other" without double counting [AC-07.10]', () => {
    const rows = [
      makeItem({
        name: 'Power connection',
        qtyMilli: 1000,
        unitPriceCents: 230_000,
      }),
      makeItem({
        name: 'Water connection',
        qtyMilli: 1000,
        unitPriceCents: 300_000,
      }),
      makeItem({
        name: 'Temporary site power and water',
        qtyMilli: 1000,
        unitPriceCents: 90_000,
      }),
    ];

    const costs = utilityCosts(rows);

    expect(costs.byType).toEqual({ POWER: 230_000, WATER: 300_000 });
    expect(costs.otherCents).toBe(90_000);
    expect(costs.totalCents).toBe(620_000);
  });
});

describe('land-calc: coordinates', () => {
  it('should treat 0,0 as unset and build an OpenStreetMap link otherwise [AC-07.9]', () => {
    expect(hasCoordinates(0, 0)).toBe(false);
    expect(hasCoordinates(51.3801, 12.4936)).toBe(true);
    expect(osmUrl(51.3801, 12.4936)).toBe(
      'https://www.openstreetmap.org/?mlat=51.3801&mlon=12.4936#map=17/51.3801/12.4936',
    );
  });
});
