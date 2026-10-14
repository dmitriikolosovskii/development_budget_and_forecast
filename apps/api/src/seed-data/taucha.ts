import { BUDGET_CATALOG } from '@default-project/types';
import { eur, qty } from './money';
import { buildTauchaItems } from './taucha-items';
import type { BoqComponentSeed, BudgetLineSeed, DeliverySeed, LandSeed, PlanSeed, ProjectSeed, RoomSeed } from './types';

export const TAUCHA_SLUG = 'taucha-stadtvilla';

/** Approved amount per line in euros: GERMANY-DATA §9 (Σ 573,861.00 €). */
const TAUCHA_APPROVED_EUR: Record<string, string> = {
  // LAND 159,840
  'LAND/purchase': '135200',
  'LAND/acquisition-costs': '10140',
  'LAND/site-development': '11000',
  'LAND/surveys': '3500',
  // ARCHITECTURE 49,281
  'ARCHITECTURE/design': '39981',
  'ARCHITECTURE/engineering': '6800',
  'ARCHITECTURE/permits': '1800',
  'ARCHITECTURE/insurance': '700',
  // MATERIALS 144,855
  'MATERIALS/concrete': '21900',
  'MATERIALS/masonry': '15000',
  'MATERIALS/roofing': '15500',
  'MATERIALS/windows-doors': '23730',
  'MATERIALS/insulation-facade': '10575',
  'MATERIALS/electrical': '6800',
  'MATERIALS/plumbing': '7200',
  'MATERIALS/heating': '21150',
  'MATERIALS/drywall-plaster': '6650',
  'MATERIALS/flooring-tiles': '5900',
  'MATERIALS/paint': '1650',
  'MATERIALS/exterior': '8800',
  // CONSTRUCTION 199,885
  'CONSTRUCTION/site-setup': '7000',
  'CONSTRUCTION/earthworks': '21100',
  'CONSTRUCTION/shell': '33000',
  'CONSTRUCTION/roof': '15500',
  'CONSTRUCTION/windows-install': '10170',
  'CONSTRUCTION/facade': '12925',
  'CONSTRUCTION/plaster-screed': '9450',
  'CONSTRUCTION/electrical-install': '10200',
  'CONSTRUCTION/plumbing-install': '10800',
  'CONSTRUCTION/heating-install': '10350',
  'CONSTRUCTION/drywall': '3900',
  'CONSTRUCTION/flooring-tiling': '9100',
  'CONSTRUCTION/painting': '3850',
  'CONSTRUCTION/outdoor': '13200',
  'CONSTRUCTION/contingency': '29340',
  // MARKETING 20,000
  'MARKETING/listings': '1600',
  'MARKETING/paid-search': '2700',
  'MARKETING/social': '3000',
  'MARKETING/website-seo': '4100',
  'MARKETING/visuals': '2500',
  'MARKETING/print-signage': '3100',
  'MARKETING/events': '3000',
  'MARKETING/sales-commission': '0',
};

/** One line per catalogue section, in catalogue order. */
export function buildLines(approvedEur: Record<string, string>): BudgetLineSeed[] {
  return BUDGET_CATALOG.map((c) => {
    const amount = approvedEur[`${c.category}/${c.section}`];
    if (amount === undefined) throw new Error(`No approved amount for ${c.category}/${c.section}`);
    return { category: c.category, section: c.section, name: c.name, approvedCents: eur(amount), sortOrder: c.sortOrder };
  });
}

function tauchaLand(): LandSeed {
  return {
    address: 'Gartenstadtallee 14 (fictional)',
    postalCode: '04425',
    municipality: 'Taucha',
    district: 'Landkreis Nordsachsen',
    state: 'Saxony',
    cadastralRef: 'Gemarkung Taucha, Flur 7, Flurstück 412/18 (fictional)',
    lat: 51.3818,
    lng: 12.4931,
    areaM2: 520,
    plotWidthCm: 2600,
    plotDepthCm: 2000,
    landValuePerM2Cents: eur('171'),
    zoningPlan: 'B-Plan Nr. 55 "Gartenstadt": general residential area (WA), detached houses only',
    grzBps: 4000,
    gfzBps: 8000,
    maxStoreys: 2,
    roofRules: 'Hipped/pyramid or gabled roof, 18–45°; eaves height ≤ 6.5 m (est.)',
    buildingLineNotes: 'Building line ≥ 3 m from the street (est.)',
    soilType: 'Saale-age glacial till (Geschiebelehm/-mergel, 0–1.6 m) over meltwater sands',
    // The DIN class number comes first: block 07 parses it for the soil-risk rule.
    soilClass: '4 (DIN 18300, medium-hard to excavate), geotechnical category GK2 (est.)',
    bearingCapacityKnM2: 180,
    groundwaterDepthCm: 700,
    contaminationNotes: 'None found (soil report, April 2026)',
    slopeNotes: 'Flat, slope < 1 %',
    orientation: 'Garden facing south-west',
    notes: 'Sold fully developed ("voll erschlossen"): no development charge. Till drains poorly: rainwater cistern with throttled discharge.',
    utilities: [
      { type: 'POWER', status: 'AT_BOUNDARY', distanceM: 0, provider: 'Netzbetreiber Nordsachsen (fictional)', notes: 'House connection 2,300 € net; application 8–12 weeks ahead' },
      { type: 'WATER', status: 'AT_BOUNDARY', distanceM: 0, provider: 'Wasserversorgung Taucha (fictional)', notes: 'House connection 3,000 € net' },
      { type: 'SEWER', status: 'AT_BOUNDARY', distanceM: 0, provider: 'Abwasserzweckverband Parthe (fictional)', notes: 'Combined with the stormwater connection: 3,500 € net' },
      { type: 'STORMWATER', status: 'AT_BOUNDARY', distanceM: 0, provider: 'Abwasserzweckverband Parthe (fictional)', notes: 'Till drains poorly: cistern with throttled discharge' },
      { type: 'TELECOM', status: 'IN_STREET', distanceM: 8, provider: 'Glasfaser Nordsachsen (fictional)', notes: 'Fibre connection 700 € net' },
      { type: 'GAS', status: 'IN_STREET', distanceM: 6, provider: 'Netzbetreiber Nordsachsen (fictional)', notes: 'Not connected: heat pump (a connection would cost 1,000–3,000 €)' },
      { type: 'DISTRICT_HEATING', status: 'NOT_AVAILABLE', distanceM: null, provider: null, notes: null },
    ],
  };
}

/** GERMANY-DATA §2: 14 rectangles inside a 920 × 820 cm frame (Σ 143.65 m²). */
function tauchaRooms(): RoomSeed[] {
  const rows: Array<[string, number, string, string, number, number, number, number]> = [
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
  return rows.map(([code, floor, name, kind, xCm, yCm, wCm, hCm], sortOrder) => ({ code, floor, name, kind, xCm, yCm, wCm, hCm, sortOrder }));
}

/** Takeoff: ≥ 3 components per house section; each links 1:1 to a MATERIAL row with the same quantity (`boq` in the rows). */
function tauchaComponents(): BoqComponentSeed[] {
  const rows: Array<[string, BoqComponentSeed['houseSection'], string, BoqComponentSeed['unit'], string, string]> = [
    ['BOQ-SIT-001', 'SITE_FOUNDATION', 'Foundation slab concrete C25/30', 'm3', '22.5', 'concrete'],
    ['BOQ-SIT-002', 'SITE_FOUNDATION', 'Frost apron concrete C25/30', 'm3', '9', 'concrete'],
    ['BOQ-SIT-003', 'SITE_FOUNDATION', 'Reinforcement B500B', 't', '3.6', 'concrete'],
    ['BOQ-SIT-004', 'SITE_FOUNDATION', 'Perimeter insulation XPS under slab', 'm2', '95', 'concrete'],
    ['BOQ-STR-001', 'STRUCTURE', 'Outer walls, sand-lime brick 17.5 cm', 'm2', '177', 'masonry'],
    ['BOQ-STR-002', 'STRUCTURE', 'Load-bearing interior walls 11.5 cm', 'm2', '90', 'masonry'],
    ['BOQ-STR-003', 'STRUCTURE', 'Floor slab topping concrete', 'm3', '16', 'concrete'],
    ['BOQ-STR-004', 'STRUCTURE', 'Filigree floor slab elements', 'm2', '82', 'concrete'],
    ['BOQ-ROF-001', 'ROOF', 'Roof structure timber C24', 'm3', '10.5', 'roofing'],
    ['BOQ-ROF-002', 'ROOF', 'Roof covering, concrete tiles', 'm2', '130', 'roofing'],
    ['BOQ-ROF-003', 'ROOF', 'Roof underlay membrane', 'm2', '135', 'roofing'],
    ['BOQ-ROF-004', 'ROOF', 'Top-floor ceiling insulation 240 mm', 'm2', '85', 'roofing'],
    ['BOQ-OPN-001', 'OPENINGS', 'Windows, triple glazed (14 units)', 'm2', '32', 'windows-doors'],
    ['BOQ-OPN-002', 'OPENINGS', 'Front door', 'pcs', '1', 'windows-doors'],
    ['BOQ-OPN-003', 'OPENINGS', 'Stair', 'set', '1', 'windows-doors'],
    ['BOQ-OPN-004', 'OPENINGS', 'Interior doors', 'pcs', '8', 'windows-doors'],
    ['BOQ-ELE-001', 'ELECTRICAL', 'Cable NYM-J 3×1.5 mm²', 'm', '1300', 'electrical'],
    ['BOQ-ELE-002', 'ELECTRICAL', 'Meter cabinet and distribution board', 'set', '1', 'electrical'],
    ['BOQ-ELE-003', 'ELECTRICAL', 'Sockets and switches', 'pcs', '92', 'electrical'],
    ['BOQ-PLU-001', 'PLUMBING', 'Water supply pipework', 'set', '1', 'plumbing'],
    ['BOQ-PLU-002', 'PLUMBING', 'Concealed WC frames', 'pcs', '2', 'plumbing'],
    ['BOQ-PLU-003', 'PLUMBING', 'Sanitary ceramics and taps', 'set', '1', 'plumbing'],
    ['BOQ-HVA-001', 'HEATING_VENTILATION', 'Air-to-water heat pump 7 kW', 'pcs', '1', 'heating'],
    ['BOQ-HVA-002', 'HEATING_VENTILATION', 'Underfloor heating', 'm2', '144', 'heating'],
    ['BOQ-HVA-003', 'HEATING_VENTILATION', 'MVHR unit', 'pcs', '1', 'heating'],
    ['BOQ-INT-001', 'INTERIOR_FINISHES', 'Anhydrite screed 50 mm', 'm2', '150', 'drywall-plaster'],
    ['BOQ-INT-002', 'INTERIOR_FINISHES', 'Gypsum boards', 'm2', '190', 'drywall-plaster'],
    ['BOQ-INT-003', 'INTERIOR_FINISHES', 'Parquet', 'm2', '105', 'flooring-tiles'],
    ['BOQ-INT-004', 'INTERIOR_FINISHES', 'Tiles', 'm2', '75', 'flooring-tiles'],
    ['BOQ-FAC-001', 'FACADE_INSULATION', 'ETICS insulation EPS 032, 180 mm', 'm2', '200', 'insulation-facade'],
    ['BOQ-FAC-002', 'FACADE_INSULATION', 'Silicone resin render', 'm2', '196', 'insulation-facade'],
    ['BOQ-FAC-003', 'FACADE_INSULATION', 'Reinforcement mesh', 'm2', '220', 'insulation-facade'],
    ['BOQ-EXT-001', 'EXTERIOR', 'Paving (driveway, paths)', 'm2', '60', 'exterior'],
    ['BOQ-EXT-002', 'EXTERIOR', 'Fence and gate', 'm', '46', 'exterior'],
    ['BOQ-EXT-003', 'EXTERIOR', 'Carport', 'set', '1', 'exterior'],
  ];
  return rows.map(([code, houseSection, name, unit, quantity, materialSection], sortOrder) => ({
    code,
    houseSection,
    name,
    unit,
    qtyMilli: qty(quantity),
    materialSection,
    notes: null,
    sortOrder,
  }));
}

function tauchaPlan(): PlanSeed {
  return {
    name: "Stadtvilla 'Familie 4' — 144 m²",
    architectOrgSlug: 'architekten-sommer',
    style: 'Urban villa (Stadtvilla)',
    storeys: 2,
    roofType: 'Pyramid roof',
    roofPitchDeg: 22,
    energyStandard: 'KfW EH 55 / GEG 2024',
    heatingSystem: 'Air-to-water heat pump (7 kW monoblock) + underfloor heating + MVHR',
    occupants: 4,
    footprintWidthCm: 1000,
    footprintDepthCm: 900,
    siteOffsetXcm: 800,
    siteOffsetYcm: 400,
    notes: 'Sand-lime brick 17.5 cm + 18 cm EPS ETICS, no basement, gross floor area 180 m². Rooms sit in a 920 × 820 cm inner frame.',
    rooms: tauchaRooms(),
    components: tauchaComponents(),
  };
}

/** Delivery notes: DELIVERED invoices sum to the item's actual (block 10's rule); EXPECTED dates equal the item's deliveryDate. */
function tauchaDeliveries(): DeliverySeed[] {
  return [
    { itemCode: 'MAT-CON-001', deliveryNoteNo: 'LS-LTB-260615-01', kind: 'DELIVERED', date: '2026-06-15', qtyMilli: qty('12'), invoiceCents: eur('2310.00') },
    { itemCode: 'MAT-CON-001', deliveryNoteNo: 'LS-LTB-260615-02', kind: 'DELIVERED', date: '2026-06-15', qtyMilli: qty('10.5'), invoiceCents: eur('2021.25') },
    { itemCode: 'MAT-CON-002', deliveryNoteNo: 'LS-LTB-260615-03', kind: 'DELIVERED', date: '2026-06-15', qtyMilli: qty('9'), invoiceCents: eur('1732.50') },
    { itemCode: 'MAT-CON-003', deliveryNoteNo: 'LS-RTZ-260610-01', kind: 'DELIVERED', date: '2026-06-10', qtyMilli: qty('3.6'), invoiceCents: eur('4500.00') },
    { itemCode: 'MAT-ROF-002', deliveryNoteNo: 'LS-RTZ-260915-01', kind: 'DELIVERED', date: '2026-09-15', qtyMilli: qty('130'), invoiceCents: eur('2392.00') },
    { itemCode: 'MAT-WIN-001', deliveryNoteNo: 'AB-FWS-2026-0412', kind: 'EXPECTED', date: '2026-10-28', qtyMilli: qty('32'), invoiceCents: null },
    { itemCode: 'MAT-HEA-001', deliveryNoteNo: 'AB-HGH-2026-1187', kind: 'EXPECTED', date: '2026-11-20', qtyMilli: qty('1'), invoiceCents: null },
  ];
}

export function buildTauchaSeed(): ProjectSeed {
  return {
    project: {
      slug: TAUCHA_SLUG,
      name: 'Stadtvilla Taucha — Family of 4',
      code: 'TA-2026-01',
      status: 'ACTIVE',
      isTemplate: false,
      clientName: 'Familie Neumann',
      city: 'Taucha',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      markupBps: 1500,
    },
    budgetLines: buildLines(TAUCHA_APPROVED_EUR),
    items: buildTauchaItems(),
    land: tauchaLand(),
    plan: tauchaPlan(),
    deliveries: tauchaDeliveries(),
  };
}
