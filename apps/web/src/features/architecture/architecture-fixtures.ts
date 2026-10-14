import type { ArchitecturePlan, BoqComponent, LandParcel, Room } from '@default-project/types';

/** Test fixtures: the Stadtvilla of GERMANY-DATA §2 (14 rooms, 143.65 m²) on the 26 × 20 m Taucha plot. */
const ROOMS: Array<[code: string, floor: number, name: string, kind: string, x: number, y: number, w: number, h: number]> = [
  ['GF-LIV', 0, 'Living + dining', 'living', 0, 0, 560, 590],
  ['GF-KIT', 0, 'Kitchen', 'kitchen', 560, 0, 360, 280],
  ['GF-STU', 0, 'Study / guest', 'office', 560, 280, 360, 270],
  ['GF-UTL', 0, 'Utility / technical', 'utility', 560, 550, 360, 190],
  ['GF-WC', 0, 'Shower / WC', 'bath', 0, 590, 250, 200],
  ['GF-HAL', 0, 'Hall + stairs', 'hall', 250, 590, 310, 230],
  ['UF-MBR', 1, 'Master bedroom', 'bedroom', 0, 0, 450, 340],
  ['UF-DRS', 1, 'Dressing', 'storage', 0, 340, 200, 200],
  ['UF-CH1', 1, 'Child 1', 'bedroom', 450, 0, 470, 270],
  ['UF-CH2', 1, 'Child 2', 'bedroom', 450, 270, 470, 270],
  ['UF-GAL', 1, 'Landing + stairs', 'hall', 200, 340, 250, 300],
  ['UF-BTH', 1, 'Bathroom', 'bath', 450, 540, 470, 230],
  ['UF-STO', 1, 'Storage', 'storage', 0, 540, 200, 150],
  ['UF-HOB', 1, 'Home office nook', 'office', 0, 690, 450, 130],
];

export function makeRooms(planId = 'plan-1'): Room[] {
  return ROOMS.map(([code, floor, name, kind, xCm, yCm, wCm, hCm], i) => ({
    id: code,
    planId,
    code,
    floor,
    name,
    kind,
    xCm,
    yCm,
    wCm,
    hCm,
    sortOrder: i,
  }));
}

export function makePlan(overrides: Partial<ArchitecturePlan> = {}): ArchitecturePlan {
  return {
    id: 'plan-1',
    projectId: 'project-1',
    name: "EFH 'Familie 4' — 144 m²",
    architectOrgId: null,
    style: 'Stadtvilla',
    storeys: 2,
    roofType: 'Pyramid roof',
    roofPitchDeg: 22,
    energyStandard: 'KfW EH 55 / GEG 2024',
    heatingSystem: 'Air-source heat pump + underfloor heating',
    occupants: 4,
    footprintWidthCm: 1000,
    footprintDepthCm: 900,
    siteOffsetXcm: 800,
    siteOffsetYcm: 400,
    notes: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeComponent(overrides: Partial<BoqComponent> = {}): BoqComponent {
  return {
    id: 'boq-1',
    planId: 'plan-1',
    code: 'BOQ-STR-001',
    houseSection: 'STRUCTURE',
    name: 'Ready-mix concrete C25/30',
    unit: 'm3',
    qtyMilli: 50_000,
    materialSection: 'concrete',
    notes: null,
    sortOrder: 0,
    ...overrides,
  };
}

export function makeLand(overrides: Partial<LandParcel> = {}): LandParcel {
  return {
    id: 'land-1',
    projectId: 'project-1',
    address: 'Gartenstadt 12',
    postalCode: '04425',
    municipality: 'Taucha',
    district: null,
    state: 'Saxony',
    cadastralRef: null,
    lat: 51.38,
    lng: 12.49,
    areaM2: 520,
    plotWidthCm: 2600,
    plotDepthCm: 2000,
    landValuePerM2Cents: 26_000,
    zoningPlan: 'B-Plan Nr. 55',
    grzBps: 4000,
    gfzBps: 8000,
    maxStoreys: 2,
    roofRules: 'Any',
    buildingLineNotes: null,
    soilType: 'Loam',
    soilClass: '3',
    bearingCapacityKnM2: null,
    groundwaterDepthCm: null,
    contaminationNotes: null,
    slopeNotes: null,
    orientation: null,
    notes: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}
