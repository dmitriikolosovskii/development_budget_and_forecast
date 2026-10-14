import {
  makeItem,
  makeLine,
  makeSnapshot,
} from '@default-project/budget-engine';
import type {
  LandParcel,
  PlanWithDetails,
  ProjectSnapshot,
  UtilityConnection,
} from '@default-project/types';

/** Test data in the shape of the Taucha seed (GERMANY-DATA §1). */
const TS = '2026-10-14T00:00:00.000Z';

export function makeLand(overrides: Partial<LandParcel> = {}): LandParcel {
  return {
    id: 'land-1',
    projectId: 'project-1',
    address: 'Gartenstadt 12',
    postalCode: '04425',
    municipality: 'Taucha',
    district: 'Gartenstadt',
    state: 'Saxony',
    cadastralRef: 'Gemarkung Taucha, Flur 3, Flurstück 512/4',
    lat: 51.3801,
    lng: 12.4936,
    areaM2: 520,
    plotWidthCm: 2600,
    plotDepthCm: 2000,
    landValuePerM2Cents: 26_000,
    zoningPlan: 'B-Plan Nr. 55 "Gartenstadt"',
    grzBps: 4000,
    gfzBps: 8000,
    maxStoreys: 2,
    roofRules: 'Hipped or gabled roof, 18–45°',
    buildingLineNotes: 'Building line ≥ 3 m',
    soilType: 'Glacial till over meltwater sand',
    soilClass:
      '4 (DIN 18300, medium-hard to excavate), geotechnical category GK2 (est.)',
    bearingCapacityKnM2: 200,
    groundwaterDepthCm: 700,
    contaminationNotes: null,
    slopeNotes: 'Flat',
    orientation: 'Garden to the south-west',
    notes: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function makeUtility(
  type: UtilityConnection['type'],
  overrides: Partial<UtilityConnection> = {},
): UtilityConnection {
  return {
    id: `u-${type}`,
    landId: 'land-1',
    type,
    status: 'AT_BOUNDARY',
    distanceM: 3,
    provider: null,
    notes: null,
    ...overrides,
  };
}

export function makePlan(
  overrides: Partial<PlanWithDetails> = {},
): PlanWithDetails {
  return {
    id: 'plan-1',
    projectId: 'project-1',
    name: 'Stadtvilla 144',
    architectOrgId: null,
    style: 'Stadtvilla',
    storeys: 2,
    roofType: 'Pyramid',
    roofPitchDeg: 22,
    energyStandard: 'KfW EH 55',
    heatingSystem: 'Air-source heat pump',
    occupants: 4,
    footprintWidthCm: 1000,
    footprintDepthCm: 900,
    siteOffsetXcm: 800,
    siteOffsetYcm: 400,
    notes: null,
    createdAt: TS,
    updatedAt: TS,
    rooms: [],
    components: [],
    ...overrides,
  };
}

/** A project with the 4 LAND lines; purchase planned 520 × €260 = €135,200 (13,520,000 cents). */
export function landSnapshot(
  overrides: Partial<ProjectSnapshot> = {},
): ProjectSnapshot {
  const purchase = makeLine({
    id: 'l-pur',
    category: 'LAND',
    section: 'purchase',
    name: 'Land purchase',
    approvedCents: 13_520_000,
    sortOrder: 0,
  });
  const acq = makeLine({
    id: 'l-acq',
    category: 'LAND',
    section: 'acquisition-costs',
    name: 'Taxes, notary & land registry',
    approvedCents: 1_014_000,
    sortOrder: 1,
  });
  const dev = makeLine({
    id: 'l-dev',
    category: 'LAND',
    section: 'site-development',
    name: 'Utility connections & site development',
    approvedCents: 1_100_000,
    sortOrder: 2,
  });
  const sur = makeLine({
    id: 'l-sur',
    category: 'LAND',
    section: 'surveys',
    name: 'Survey & soil report',
    approvedCents: 350_000,
    sortOrder: 3,
  });
  const service = { kind: 'SERVICE' as const, unit: 'lump', qtyMilli: 1000 };
  const items = [
    makeItem({
      ...service,
      id: 'i-pur',
      budgetLineId: 'l-pur',
      code: 'SRV-PUR-001',
      name: 'Plot purchase',
      unit: 'm2',
      qtyMilli: 520_000,
      unitPriceCents: 26_000,
      committedCents: 13_520_000,
      actualCents: 13_520_000,
      status: 'DONE',
    }),
    makeItem({
      ...service,
      id: 'i-acq',
      budgetLineId: 'l-acq',
      code: 'SRV-ACQ-001',
      name: 'Real estate transfer tax',
      unitPriceCents: 743_600,
    }),
    makeItem({
      ...service,
      id: 'i-dev1',
      budgetLineId: 'l-dev',
      code: 'SRV-DEV-001',
      name: 'Power connection (house connection, meter)',
      unitPriceCents: 230_000,
    }),
    makeItem({
      ...service,
      id: 'i-dev2',
      budgetLineId: 'l-dev',
      code: 'SRV-DEV-002',
      name: 'Water connection',
      unitPriceCents: 300_000,
    }),
    makeItem({
      ...service,
      id: 'i-dev6',
      budgetLineId: 'l-dev',
      code: 'SRV-DEV-006',
      name: 'Temporary site power and water',
      unitPriceCents: 90_000,
    }),
    makeItem({
      ...service,
      id: 'i-sur',
      budgetLineId: 'l-sur',
      code: 'SRV-SUR-001',
      name: 'Soil survey',
      unitPriceCents: 150_000,
    }),
  ];
  return makeSnapshot({
    budgetLines: [purchase, acq, dev, sur],
    items,
    land: {
      ...makeLand(),
      utilities: [makeUtility('WATER'), makeUtility('POWER')],
    },
    plan: makePlan(),
    ...overrides,
  });
}
