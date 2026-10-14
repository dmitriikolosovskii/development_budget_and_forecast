import { deriveProject } from './derive';
import { buildTauchaSeed } from './taucha';
import type { LandSeed, PlanSeed, ProjectSeed, UtilitySeed } from './types';

export const TEMPLATE_SLUG = 'template-efh-144';

const utilities = (status: UtilitySeed['status']): UtilitySeed[] => [
  { type: 'POWER', status, distanceM: 0, provider: 'Netz Leipziger Land (fictional)', notes: null },
  { type: 'WATER', status, distanceM: 0, provider: 'Zweckverband Wasser Leipzig-Land (fictional)', notes: null },
  { type: 'SEWER', status, distanceM: 0, provider: 'Zweckverband Wasser Leipzig-Land (fictional)', notes: null },
  { type: 'STORMWATER', status, distanceM: 0, provider: null, notes: 'Infiltration on the plot' },
  { type: 'TELECOM', status, distanceM: 0, provider: 'Glasfaser Leipziger Land (fictional)', notes: null },
  { type: 'GAS', status: 'IN_STREET', distanceM: 5, provider: 'Netz Leipziger Land (fictional)', notes: 'Not connected: heat pump' },
  { type: 'DISTRICT_HEATING', status: 'NOT_AVAILABLE', distanceM: null, provider: null, notes: null },
];

function markranstaedtLand(): LandSeed {
  return {
    address: 'Am Seeblick 7 (fictional)',
    postalCode: '04420',
    municipality: 'Markranstädt',
    district: 'Landkreis Leipzig',
    state: 'Saxony',
    cadastralRef: 'Gemarkung Markranstädt, Flur 4, Flurstück 233/9 (fictional)',
    lat: 51.3019,
    lng: 12.2217,
    areaM2: 600,
    plotWidthCm: 3000,
    plotDepthCm: 2000,
    landValuePerM2Cents: 11200,
    zoningPlan: 'B-Plan "Am Kulkwitzer See" (fictional): general residential area (WA)',
    grzBps: 3000,
    gfzBps: 5000,
    maxStoreys: 1,
    roofRules: 'Hipped roof 20–35° (est.)',
    buildingLineNotes: null,
    soilType: 'Sandy loam over gravel (est.)',
    soilClass: '3 (DIN 18300, easy to excavate) (est.)',
    bearingCapacityKnM2: 200,
    groundwaterDepthCm: 400,
    contaminationNotes: null,
    slopeNotes: 'Flat',
    orientation: 'Garden facing south',
    notes: 'Completed in 2025; all connections in operation.',
    utilities: utilities('CONNECTED'),
  };
}

/** One-storey bungalow: 9 rooms inside a 1220 × 870 cm frame (Σ 106.14 m²). */
function markranstaedtPlan(): PlanSeed {
  const rows: Array<[string, string, string, number, number, number, number]> = [
    ['GF-LIV', 'Living + dining', 'living', 0, 0, 620, 480],
    ['GF-KIT', 'Kitchen', 'kitchen', 620, 0, 300, 300],
    ['GF-BTH', 'Bathroom', 'bath', 620, 300, 300, 250],
    ['GF-STU', 'Study', 'office', 620, 550, 300, 320],
    ['GF-MBR', 'Master bedroom', 'bedroom', 920, 0, 300, 420],
    ['GF-CH1', 'Child', 'bedroom', 920, 420, 300, 450],
    ['GF-HAL', 'Hall', 'hall', 0, 480, 400, 390],
    ['GF-UTL', 'Utility', 'utility', 400, 480, 220, 200],
    ['GF-WC', 'Guest WC', 'wc', 400, 680, 220, 190],
  ];
  return {
    name: "Bungalow 'Seeblick' — 106 m²",
    architectOrgSlug: 'architekten-sommer',
    style: 'Bungalow',
    storeys: 1,
    roofType: 'Hipped roof',
    roofPitchDeg: 25,
    energyStandard: 'KfW EH 55 / GEG 2024',
    heatingSystem: 'Air-to-water heat pump + underfloor heating',
    occupants: 3,
    footprintWidthCm: 1300,
    footprintDepthCm: 950,
    siteOffsetXcm: 800,
    siteOffsetYcm: 500,
    notes: 'Sand-lime brick + ETICS, no basement.',
    rooms: rows.map(([code, name, kind, xCm, yCm, wCm, hCm], sortOrder) => ({ code, floor: 0, name, kind, xCm, yCm, wCm, hCm, sortOrder })),
    components: [], // the takeoff is derived from the demo project's, scaled by area
  };
}

function markkleebergLand(): LandSeed {
  return {
    address: 'Auenhainer Weg 3 (fictional)',
    postalCode: '04416',
    municipality: 'Markkleeberg',
    district: 'Landkreis Leipzig',
    state: 'Saxony',
    cadastralRef: 'Gemarkung Markkleeberg, Flur 2, Flurstück 118/6 (fictional)',
    lat: 51.2781,
    lng: 12.3829,
    areaM2: 480,
    plotWidthCm: 2400,
    plotDepthCm: 2000,
    landValuePerM2Cents: 41200,
    zoningPlan: 'B-Plan Nr. 40 "Seepark" (fictional): general residential area (WA)',
    grzBps: 4000,
    gfzBps: 8000,
    maxStoreys: 2,
    roofRules: 'Pyramid or hipped roof 18–30° (est.)',
    buildingLineNotes: 'Building line 5 m from the street (est.)',
    soilType: 'Loess loam over gravel (est.)',
    soilClass: '4 (DIN 18300, medium-hard to excavate) (est.)',
    bearingCapacityKnM2: 160,
    groundwaterDepthCm: 350,
    contaminationNotes: null,
    slopeNotes: 'Gentle slope to the south, ~2 %',
    orientation: 'Garden facing south',
    notes: 'Plot reserved; purchase planned for spring 2027.',
    utilities: utilities('AT_BOUNDARY'),
  };
}

/** COMPLETED 2025: everything paid and delivered, a small overrun (4 trades above plan). */
export function buildMarkranstaedtSeed(base = buildTauchaSeed()): ProjectSeed {
  return deriveProject(base, {
    project: {
      slug: 'markranstaedt-bungalow',
      name: 'Bungalow Markranstädt — Kulkwitzer See',
      code: 'MR-2024-01',
      status: 'COMPLETED',
      isTemplate: false,
      clientName: 'Familie Schubert',
      city: 'Markranstädt',
      startDate: '2024-10-01',
      endDate: '2025-09-30',
      markupBps: 1200,
    },
    mode: 'DONE',
    areaFactor: { num: 110, den: 144 },
    shiftDays: -547,
    land: { seed: markranstaedtLand(), pricePerM2Eur: '112' },
    plan: markranstaedtPlan(),
    overrunBps: { shell: 600, 'heating-install': 800, 'electrical-install': 500, roof: 400 },
  });
}

/** PLANNING: a larger villa next year, nothing committed. */
export function buildMarkkleebergSeed(base = buildTauchaSeed()): ProjectSeed {
  return deriveProject(base, {
    project: {
      slug: 'markkleeberg-villa',
      name: 'Villa Markkleeberg — Seepark',
      code: 'MK-2027-01',
      status: 'PLANNING',
      isTemplate: false,
      clientName: 'Familie Hoffmann',
      city: 'Markkleeberg',
      startDate: '2027-04-01',
      endDate: '2028-03-31',
      markupBps: 1500,
    },
    mode: 'PLANNED',
    areaFactor: { num: 160, den: 144 },
    shiftDays: 365,
    land: { seed: markkleebergLand(), pricePerM2Eur: '412' },
  });
}

/** The wizard's template (block 12): the demo project with dates, everything PLANNED, no money spent, no deliveries. */
export function buildTemplateSeed(base = buildTauchaSeed()): ProjectSeed {
  return deriveProject(base, {
    project: {
      slug: TEMPLATE_SLUG,
      name: 'Template — Stadtvilla EFH 144 m²',
      code: 'TPL-EFH-144',
      status: 'PLANNING',
      isTemplate: true,
      clientName: 'Template',
      city: 'Taucha',
      startDate: base.project.startDate,
      endDate: base.project.endDate,
      markupBps: base.project.markupBps,
    },
    mode: 'PLANNED',
    areaFactor: { num: 1, den: 1 },
    shiftDays: 0,
  });
}

/** Every seeded project, in write order. */
export function buildAllProjectSeeds(): ProjectSeed[] {
  const taucha = buildTauchaSeed();
  return [taucha, buildMarkranstaedtSeed(taucha), buildMarkkleebergSeed(taucha), buildTemplateSeed(taucha)];
}
