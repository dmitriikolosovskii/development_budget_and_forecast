import { buildRows } from './row-builder';
import type { CostItemSeed } from './types';

// Rows of the demo project "Stadtvilla Taucha" (GERMANY-DATA §1–§7; net prices, Saxony 2026; "today" = 2026-10-14).
// Demo moments: concrete priced at 192.50 €/m³ against a budget at 154; electrical +7.2 % and 92 sockets instead of 70;
// earthworks change order +3,800; windows arrive 9 days after installation start, the heat pump 18 days; plaster slack 2 days.

const ARCHITECT = 'architekten-sommer';
const ENGINEER = 'ib-poege';
const AGENCY = 'nordlicht-marketing';
const SHELL = 'parthe-bau';
const ROOFER = 'muehlberg-dach';
const ELECTRICIAN = 'elektro-brauer';
const SHK = 'waermekonzept-ns';
const FINISHER = 'lindner-putz';
const MERCHANT = 'rietzschke-baustoffe';
const CONCRETE = 'ltb-nord';
const WINDOWS = 'fensterwerk-sachsen';
const HEATING_WHOLESALE = 'heizungsgrosshandel-mitte';

function landRows(): CostItemSeed[] {
  return [
    ...buildRows({ category: 'LAND', section: 'purchase', kind: 'SERVICE' }, [
      {
        code: 'SRV-PUR-001',
        name: 'Plot 520 m², B-Plan Nr. 55 "Gartenstadt", fully developed',
        description: '260 €/m² (Bodenrichtwert 171 €/m², asking prices ~293 €/m²)',
        unit: 'm2',
        qty: '520',
        price: '260.00',
        money: 'DONE',
        start: '2026-04-15',
      },
    ]),
    ...buildRows({ category: 'LAND', section: 'acquisition-costs', kind: 'SERVICE' }, [
      { code: 'SRV-ACQ-001', name: 'Real estate transfer tax (Grunderwerbsteuer Saxony 5.5 %)', unit: 'lump', qty: '1', price: '7436.00', money: 'DONE', start: '2026-05-20' },
      { code: 'SRV-ACQ-002', name: 'Notary fees (~1.5 %)', unit: 'lump', qty: '1', price: '2028.00', money: 'DONE', start: '2026-04-15' },
      { code: 'SRV-ACQ-003', name: 'Land registry entry (~0.5 %)', unit: 'lump', qty: '1', price: '676.00', money: 'DONE', start: '2026-05-28' },
    ]),
    // Names carry the utility keyword: block 07 maps these rows to UtilityType by name.
    ...buildRows({ category: 'LAND', section: 'site-development', kind: 'SERVICE' }, [
      { code: 'SRV-DEV-001', name: 'Power connection (house connection, meter)', unit: 'lump', qty: '1', price: '2300.00', money: 'CONTRACTED', start: '2027-01-11', end: '2027-01-15' },
      { code: 'SRV-DEV-002', name: 'Water connection', unit: 'lump', qty: '1', price: '3000.00', money: 'CONTRACTED', start: '2027-01-11', end: '2027-01-15' },
      { code: 'SRV-DEV-003', name: 'Sewer & stormwater connection (throttled discharge)', unit: 'lump', qty: '1', price: '3500.00', money: 'CONTRACTED', start: '2027-01-18', end: '2027-01-22' },
      { code: 'SRV-DEV-004', name: 'Telecom (fibre) connection', unit: 'lump', qty: '1', price: '700.00', money: 'CONTRACTED', start: '2027-01-25', end: '2027-01-29' },
      { code: 'SRV-DEV-005', name: 'Multi-utility wall entry', unit: 'lump', qty: '1', price: '600.00', money: 'CONTRACTED', start: '2026-06-08', end: '2026-06-12' },
      { code: 'SRV-DEV-006', name: 'Temporary site power and water', unit: 'lump', qty: '1', price: '900.00', money: 'DONE', start: '2026-05-25', end: '2026-05-29' },
    ]),
    ...buildRows({ category: 'LAND', section: 'surveys', kind: 'SERVICE' }, [
      { code: 'SRV-SUR-001', name: 'Site plan, setting-out and final building survey', unit: 'lump', qty: '1', price: '2000.00', money: 'DONE', contractor: 'vermessung-kuntze', start: '2026-04-20', end: '2026-05-29' },
      { code: 'SRV-SUR-002', name: 'Soil report (geotechnical category GK2)', unit: 'lump', qty: '1', price: '1500.00', money: 'DONE', contractor: ENGINEER, start: '2026-04-20', end: '2026-05-08' },
    ]),
  ];
}

function architectureRows(): CostItemSeed[] {
  return [
    // HOAI 2021 § 35, fee zone III, base rate, 300k eligible costs (GERMANY-DATA §4).
    ...buildRows({ category: 'ARCHITECTURE', section: 'design', kind: 'SERVICE', contractor: ARCHITECT }, [
      { code: 'SRV-DES-001', name: 'HOAI LPH 1 — Basic evaluation', unit: 'lump', qty: '1', price: '800.00', money: 'DONE', start: '2026-04-01', end: '2026-04-10' },
      { code: 'SRV-DES-002', name: 'HOAI LPH 2 — Preliminary design', unit: 'lump', qty: '1', price: '2799.00', money: 'DONE', start: '2026-04-13', end: '2026-04-24' },
      { code: 'SRV-DES-003', name: 'HOAI LPH 3 — Final design', unit: 'lump', qty: '1', price: '5997.00', money: 'DONE', start: '2026-04-27', end: '2026-05-15' },
      { code: 'SRV-DES-004', name: 'HOAI LPH 4 — Building permit application', unit: 'lump', qty: '1', price: '1199.00', money: 'DONE', start: '2026-05-18', end: '2026-05-22' },
      { code: 'SRV-DES-005', name: 'HOAI LPH 5 — Construction drawings', unit: 'lump', qty: '1', price: '9995.00', money: 'DONE', start: '2026-05-11', end: '2026-05-29' },
      { code: 'SRV-DES-006', name: 'HOAI LPH 6 — Bills of quantities', unit: 'lump', qty: '1', price: '3998.00', money: 'DONE', start: '2026-05-18', end: '2026-05-29' },
      { code: 'SRV-DES-007', name: 'HOAI LPH 7 — Tendering and contract award', unit: 'lump', qty: '1', price: '1599.00', money: 'DONE', start: '2026-05-25', end: '2026-06-05' },
      { code: 'SRV-DES-008', name: 'HOAI LPH 8 — Site supervision', unit: 'lump', qty: '1', price: '12794.00', money: { status: 'PARTIAL', actual: '6000.00' }, start: '2026-06-01', end: '2027-03-26' },
      { code: 'SRV-DES-009', name: 'HOAI LPH 9 — Defects follow-up', unit: 'lump', qty: '1', price: '800.00', money: 'PLANNED', start: '2027-03-29', end: '2027-03-31' },
    ]),
    ...buildRows({ category: 'ARCHITECTURE', section: 'engineering', kind: 'SERVICE', contractor: ENGINEER }, [
      { code: 'SRV-ENG-001', name: 'Structural design and calculations', unit: 'lump', qty: '1', price: '3500.00', money: 'DONE', start: '2026-04-27', end: '2026-05-22' },
      { code: 'SRV-ENG-002', name: 'Energy certificate / GEG compliance proof', unit: 'lump', qty: '1', price: '800.00', money: 'DONE', start: '2026-05-04', end: '2026-05-15' },
      { code: 'SRV-ENG-003', name: 'KfW EH55 construction supervision', unit: 'lump', qty: '1', price: '2000.00', money: { status: 'PARTIAL', actual: '1000.00' }, start: '2026-06-01', end: '2027-03-26' },
      { code: 'SRV-ENG-004', name: 'Blower-door airtightness test', unit: 'lump', qty: '1', price: '500.00', money: 'PLANNED', start: '2027-03-08', end: '2027-03-08' },
    ]),
    ...buildRows({ category: 'ARCHITECTURE', section: 'permits', kind: 'SERVICE', contractor: 'stadt-taucha' }, [
      { code: 'SRV-PER-001', name: 'Building permit fee (Saxony, 5–7 ‰ of construction cost)', unit: 'lump', qty: '1', price: '1800.00', money: 'DONE', start: '2026-05-25', end: '2026-05-25' },
    ]),
    ...buildRows({ category: 'ARCHITECTURE', section: 'insurance', kind: 'SERVICE' }, [
      { code: 'SRV-INS-001', name: "Builder's liability insurance (Bauherrenhaftpflicht)", unit: 'lump', qty: '1', price: '100.00', money: 'DONE', start: '2026-05-29', end: '2027-03-31' },
      { code: 'SRV-INS-002', name: 'Construction all-risk insurance (Bauleistungsversicherung)', unit: 'lump', qty: '1', price: '600.00', money: 'DONE', start: '2026-05-29', end: '2027-03-31' },
    ]),
  ];
}

function materialRows(): CostItemSeed[] {
  return [
    ...buildRows({ category: 'MATERIALS', section: 'concrete', kind: 'MATERIAL', supplier: MERCHANT, contractor: SHELL }, [
      { code: 'MAT-CON-001', name: 'Ready-mix concrete C25/30 — foundation slab', description: '2026 price list 192.50 €/m³ (budget assumed 154 €/m³)', unit: 'm3', qty: '22.5', price: '192.50', money: 'DONE', supplier: CONCRETE, delivery: '2026-06-15', delivered: true, work: 'WRK-EAR-003', boq: 'BOQ-SIT-001' },
      { code: 'MAT-CON-002', name: 'Ready-mix concrete C25/30 — frost apron', unit: 'm3', qty: '9', price: '192.50', money: 'DONE', supplier: CONCRETE, delivery: '2026-06-15', delivered: true, work: 'WRK-EAR-003', boq: 'BOQ-SIT-002' },
      { code: 'MAT-CON-003', name: 'Rebar B500B, cut and bent', unit: 't', qty: '3.6', price: '1250.00', money: 'DONE', delivery: '2026-06-10', delivered: true, work: 'WRK-EAR-003', boq: 'BOQ-SIT-003' },
      { code: 'MAT-CON-004', name: 'XPS perimeter insulation 300 kPa, 120 mm (under slab)', unit: 'm2', qty: '95', price: '28.40', money: 'DONE', delivery: '2026-06-12', delivered: true, work: 'WRK-EAR-003', boq: 'BOQ-SIT-004' },
      { code: 'MAT-CON-005', name: 'Ready-mix concrete C25/30 — floor slab topping', unit: 'm3', qty: '16', price: '192.50', money: 'DONE', supplier: CONCRETE, delivery: '2026-07-27', delivered: true, work: 'WRK-SHL-002', boq: 'BOQ-STR-003' },
      { code: 'MAT-CON-006', name: 'Ready-mix concrete C25/30 — ring beams and lintels', unit: 'm3', qty: '3', price: '192.50', money: 'DONE', supplier: CONCRETE, delivery: '2026-08-10', delivered: true, work: 'WRK-SHL-004' },
      { code: 'MAT-CON-007', name: 'Filigree floor slab elements (precast)', unit: 'm2', qty: '82', price: '49.50', money: 'DONE', delivery: '2026-07-20', delivered: true, work: 'WRK-SHL-002', boq: 'BOQ-STR-004' },
      { code: 'MAT-CON-008', name: 'Precast lintels and U-shells', unit: 'set', qty: '1', price: '1780.00', money: 'DONE', delivery: '2026-06-26', delivered: true, work: 'WRK-SHL-001' },
      { code: 'MAT-CON-009', name: 'Foundation earth electrode, stainless steel strip', unit: 'm', qty: '75', price: '7.40', money: 'DONE', delivery: '2026-06-10', delivered: true, work: 'WRK-EAR-003' },
      { code: 'MAT-CON-010', name: 'PE membrane 0.3 mm under slab', unit: 'm2', qty: '125', price: '2.30', money: 'DONE', delivery: '2026-06-10', delivered: true, work: 'WRK-EAR-003' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'masonry', kind: 'MATERIAL', supplier: MERCHANT, contractor: SHELL }, [
      { code: 'MAT-MAS-001', name: 'Sand-lime brick KS 17.5 cm — outer walls', unit: 'm2', qty: '177', price: '34.80', money: 'DONE', delivery: '2026-06-26', delivered: true, work: 'WRK-SHL-001', boq: 'BOQ-STR-001' },
      { code: 'MAT-MAS-002', name: 'Sand-lime brick KS 11.5 cm — load-bearing interior walls', unit: 'm2', qty: '90', price: '27.90', money: 'DONE', delivery: '2026-06-26', delivered: true, work: 'WRK-SHL-001', boq: 'BOQ-STR-002' },
      { code: 'MAT-MAS-003', name: 'Sand-lime brick KS 24 cm — stair core', unit: 'm2', qty: '42', price: '46.00', money: 'DONE', delivery: '2026-06-26', delivered: true, work: 'WRK-SHL-001' },
      { code: 'MAT-MAS-004', name: 'Partition blocks KS 7 cm', unit: 'm2', qty: '70', price: '22.50', money: 'DONE', delivery: '2026-07-31', delivered: true, work: 'WRK-SHL-003' },
      { code: 'MAT-MAS-005', name: 'Thin-bed mortar, 25 kg bags', unit: 'pcs', qty: '48', price: '11.90', money: 'DONE', delivery: '2026-06-26', delivered: true, work: 'WRK-SHL-001' },
      { code: 'MAT-MAS-006', name: 'Levelling course blocks (Kimmsteine)', unit: 'm', qty: '75', price: '14.50', money: 'DONE', delivery: '2026-06-26', delivered: true, work: 'WRK-SHL-001' },
      { code: 'MAT-MAS-007', name: 'Wall ties, anchors and fixings', unit: 'set', qty: '1', price: '640.00', money: 'DONE', delivery: '2026-06-26', delivered: true, work: 'WRK-SHL-001' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'roofing', kind: 'MATERIAL', supplier: MERCHANT, contractor: ROOFER }, [
      { code: 'MAT-ROF-001', name: 'Structural timber C24 (rafters, purlins, hips)', unit: 'm3', qty: '10.5', price: '540.00', money: 'DONE', delivery: '2026-08-28', delivered: true, work: 'WRK-ROO-001', boq: 'BOQ-ROF-001' },
      { code: 'MAT-ROF-002', name: 'Concrete roof tiles (Frankfurter Pfanne)', unit: 'm2', qty: '130', price: '18.40', money: 'DONE', delivery: '2026-09-15', delivered: true, work: 'WRK-ROO-004', boq: 'BOQ-ROF-002' },
      { code: 'MAT-ROF-003', name: 'Diffusion-open roof underlay membrane', unit: 'm2', qty: '135', price: '3.20', money: 'DONE', delivery: '2026-09-15', delivered: true, work: 'WRK-ROO-003', boq: 'BOQ-ROF-003' },
      { code: 'MAT-ROF-004', name: 'Battens and counter-battens 30/50', unit: 'm', qty: '900', price: '1.15', money: 'DONE', delivery: '2026-09-15', delivered: true, work: 'WRK-ROO-003' },
      { code: 'MAT-ROF-005', name: 'Mineral wool 240 mm — top-floor ceiling insulation', unit: 'm2', qty: '85', price: '17.80', money: 'CONTRACTED', delivery: '2026-10-22', boq: 'BOQ-ROF-004' },
      { code: 'MAT-ROF-006', name: 'Gutters, downpipes and flashing (titanium zinc)', unit: 'set', qty: '1', price: '2350.00', money: 'DONE', delivery: '2026-09-15', delivered: true, work: 'WRK-ROO-005' },
      { code: 'MAT-ROF-007', name: 'Ridge and hip tiles, fasteners', unit: 'set', qty: '1', price: '690.00', money: 'DONE', delivery: '2026-09-15', delivered: true, work: 'WRK-ROO-004' },
      { code: 'MAT-ROF-008', name: 'Vapour barrier and airtightness tape', unit: 'set', qty: '1', price: '480.00', money: 'CONTRACTED', delivery: '2026-10-22' },
      { code: 'MAT-ROF-009', name: 'Insulated attic access hatch', unit: 'pcs', qty: '1', price: '420.00', money: 'CONTRACTED', delivery: '2026-10-22' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'windows-doors', kind: 'MATERIAL', supplier: WINDOWS, contractor: ROOFER }, [
      { code: 'MAT-WIN-001', name: 'Triple-glazed PVC windows Uw 0.8 (14 units)', description: 'Confirmed delivery 2026-10-28: 9 days after installation starts', unit: 'm2', qty: '32', price: '342.00', money: 'CONTRACTED', delivery: '2026-10-28', work: 'WRK-WIN-001', boq: 'BOQ-OPN-001' },
      { code: 'MAT-WIN-002', name: 'Front door, insulated aluminium Ud 0.9', unit: 'pcs', qty: '1', price: '2950.00', money: 'CONTRACTED', delivery: '2026-10-16', work: 'WRK-WIN-002', boq: 'BOQ-OPN-002' },
      { code: 'MAT-WIN-003', name: 'Electric roller shutters with insulated boxes', unit: 'pcs', qty: '14', price: '105.00', money: 'CONTRACTED', delivery: '2026-10-28', work: 'WRK-WIN-003' },
      { code: 'MAT-WIN-004', name: 'Window sills, interior and exterior (aluminium)', unit: 'pcs', qty: '14', price: '30.00', money: 'CONTRACTED', delivery: '2026-10-28', work: 'WRK-WIN-003' },
      { code: 'MAT-WIN-005', name: 'Timber stair, oak, quarter turn', unit: 'set', qty: '1', price: '4550.00', money: 'PLANNED', delivery: '2027-02-10', work: 'WRK-WIN-004', boq: 'BOQ-OPN-003' },
      { code: 'MAT-WIN-006', name: 'Interior doors with frames (CPL white)', unit: 'pcs', qty: '8', price: '420.00', money: 'PLANNED', delivery: '2027-02-08', work: 'WRK-WIN-005', boq: 'BOQ-OPN-004' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'insulation-facade', kind: 'MATERIAL', supplier: MERCHANT, contractor: FINISHER }, [
      { code: 'MAT-INF-001', name: 'EPS 032 insulation boards 180 mm', unit: 'm2', qty: '200', price: '17.20', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-001', boq: 'BOQ-FAC-001' },
      { code: 'MAT-INF-002', name: 'Adhesive and base coat mortar, 25 kg bags', unit: 'pcs', qty: '86', price: '13.90', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-001' },
      { code: 'MAT-INF-003', name: 'Glass-fibre reinforcement mesh', unit: 'm2', qty: '220', price: '1.85', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-002', boq: 'BOQ-FAC-003' },
      { code: 'MAT-INF-004', name: 'Silicone resin render 2 mm, tinted', unit: 'm2', qty: '196', price: '6.40', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-003', boq: 'BOQ-FAC-002' },
      { code: 'MAT-INF-005', name: 'Insulation anchors (dowels)', unit: 'pcs', qty: '1200', price: '0.62', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-001' },
      { code: 'MAT-INF-006', name: 'Plinth, corner and window connection profiles', unit: 'set', qty: '1', price: '980.00', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-001' },
      { code: 'MAT-INF-007', name: 'XPS plinth insulation 120 mm', unit: 'm2', qty: '22', price: '26.50', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-001' },
      { code: 'MAT-INF-008', name: 'Facade primer and paint', unit: 'm2', qty: '196', price: '2.80', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-003' },
      { code: 'MAT-INF-009', name: 'Mineral wool fire barriers', unit: 'm', qty: '45', price: '12.90', money: 'PLANNED', delivery: '2026-10-22', work: 'WRK-FAC-001' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'electrical', kind: 'MATERIAL', supplier: MERCHANT, contractor: ELECTRICIAN }, [
      { code: 'MAT-ELE-001', name: 'Cable NYM-J 3×1.5 mm²', description: '2026 price +7.2 % on the budget (0.70 → 0.76 €/m); 1,000 m delivered and paid, 300 m for the first fix not ordered yet', unit: 'm', qty: '1300', price: '0.76', money: { status: 'PARTIAL', committed: '760.00', actual: '760.00' }, delivery: '2026-10-08', delivered: true, work: 'WRK-ELE-001', boq: 'BOQ-ELE-001' },
      { code: 'MAT-ELE-002', name: 'Cable NYM-J 5×2.5 mm² (cooker, heat pump)', unit: 'm', qty: '180', price: '2.35', money: 'DONE', delivery: '2026-10-08', delivered: true, work: 'WRK-ELE-001' },
      { code: 'MAT-ELE-003', name: 'Meter cabinet with pre-wired distribution board', unit: 'set', qty: '1', price: '2850.00', money: 'DONE', delivery: '2026-10-09', delivered: true, work: 'WRK-ELE-002', boq: 'BOQ-ELE-002' },
      { code: 'MAT-ELE-004', name: 'Flush boxes, conduit and fixings', unit: 'set', qty: '1', price: '640.00', money: 'DONE', delivery: '2026-10-08', delivered: true, work: 'WRK-ELE-001' },
      { code: 'MAT-ELE-005', name: 'Sockets and switches (RAL 2 stars: 92 instead of 70)', unit: 'pcs', qty: '92', price: '17.50', money: 'CONTRACTED', delivery: '2027-02-15', work: 'WRK-ELE-003', boq: 'BOQ-ELE-003' },
      { code: 'MAT-ELE-006', name: 'Network cabling Cat.7 and media panel', unit: 'set', qty: '1', price: '590.00', money: 'DONE', delivery: '2026-10-09', delivered: true, work: 'WRK-ELE-001' },
      { code: 'MAT-ELE-007', name: 'Smoke detectors, 10-year battery', unit: 'pcs', qty: '10', price: '29.50', money: 'PLANNED', delivery: '2027-02-15', work: 'WRK-ELE-003' },
      { code: 'MAT-ELE-008', name: 'LED downlights (bathrooms, hall)', unit: 'pcs', qty: '12', price: '34.00', money: 'PLANNED', delivery: '2027-02-15', work: 'WRK-ELE-003' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'plumbing', kind: 'MATERIAL', supplier: HEATING_WHOLESALE, contractor: SHK }, [
      { code: 'MAT-PLU-001', name: 'Multilayer composite pipes 16–26 mm with fittings', unit: 'set', qty: '1', price: '1350.00', money: 'DONE', delivery: '2026-10-09', delivered: true, work: 'WRK-PLU-001', boq: 'BOQ-PLU-001' },
      { code: 'MAT-PLU-002', name: 'HT/KG drainage pipes and fittings', unit: 'set', qty: '1', price: '780.00', money: 'DONE', delivery: '2026-10-09', delivered: true, work: 'WRK-PLU-001' },
      { code: 'MAT-PLU-003', name: 'Concealed WC frames (Geberit Duofix)', unit: 'pcs', qty: '2', price: '465.00', money: 'DONE', delivery: '2026-10-09', delivered: true, work: 'WRK-PLU-002', boq: 'BOQ-PLU-002' },
      { code: 'MAT-PLU-004', name: 'Sanitary ceramics and taps (2 bathrooms, WC)', unit: 'set', qty: '1', price: '2150.00', money: 'PLANNED', delivery: '2027-02-15', work: 'WRK-PLU-003', boq: 'BOQ-PLU-003' },
      { code: 'MAT-PLU-005', name: 'Shower tray, glass enclosure and bathtub', unit: 'set', qty: '1', price: '1480.00', money: 'PLANNED', delivery: '2027-01-11' },
      { code: 'MAT-PLU-006', name: 'Domestic water station (filter, pressure reducer)', unit: 'set', qty: '1', price: '410.00', money: 'DONE', delivery: '2026-10-09', delivered: true, work: 'WRK-PLU-001' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'heating', kind: 'MATERIAL', supplier: HEATING_WHOLESALE, contractor: SHK }, [
      { code: 'MAT-HEA-001', name: 'Heat pump Vaillant aroTHERM plus VWL 75/8.1 A, 7 kW monoblock', description: 'Confirmed delivery 2026-11-20 (lead time 2–3 months): 18 days after installation starts', unit: 'pcs', qty: '1', price: '5369.00', money: 'CONTRACTED', delivery: '2026-11-20', work: 'WRK-HEA-001', boq: 'BOQ-HVA-001' },
      { code: 'MAT-HEA-002', name: 'Hydraulic station with 190 l DHW cylinder', unit: 'pcs', qty: '1', price: '3980.00', money: 'CONTRACTED', delivery: '2026-10-29', work: 'WRK-HEA-001' },
      { code: 'MAT-HEA-003', name: 'Underfloor heating system (pipes, manifolds, panels)', unit: 'm2', qty: '144', price: '29.50', money: 'CONTRACTED', delivery: '2026-10-29', work: 'WRK-HEA-002', boq: 'BOQ-HVA-002' },
      { code: 'MAT-HEA-004', name: 'MVHR unit with heat recovery (350 m³/h)', unit: 'pcs', qty: '1', price: '3690.00', money: 'CONTRACTED', delivery: '2026-10-29', work: 'WRK-HEA-004', boq: 'BOQ-HVA-003' },
      { code: 'MAT-HEA-005', name: 'Ventilation ducts, valves and silencers', unit: 'set', qty: '1', price: '1890.00', money: 'CONTRACTED', delivery: '2026-10-29', work: 'WRK-HEA-004' },
      { code: 'MAT-HEA-006', name: 'Room thermostats and smart control', unit: 'pcs', qty: '8', price: '68.00', money: 'PLANNED', delivery: '2027-02-15' },
      { code: 'MAT-HEA-007', name: 'Heat pump foundation, wall bracket and condensate kit', unit: 'set', qty: '1', price: '590.00', money: 'CONTRACTED', delivery: '2026-10-29', work: 'WRK-HEA-001' },
      { code: 'MAT-HEA-008', name: 'Buffer tank 50 l and expansion vessel', unit: 'set', qty: '1', price: '520.00', money: 'CONTRACTED', delivery: '2026-10-29', work: 'WRK-HEA-001' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'drywall-plaster', kind: 'MATERIAL', supplier: MERCHANT, contractor: FINISHER }, [
      { code: 'MAT-DRP-001', name: 'Gypsum machine plaster MP 75, 30 kg bags', description: 'Delivery 2 days before plastering starts: at risk', unit: 'pcs', qty: '168', price: '8.90', money: 'PLANNED', delivery: '2026-11-28', work: 'WRK-PLS-001' },
      { code: 'MAT-DRP-002', name: 'Plaster corner beads and stop profiles', unit: 'set', qty: '1', price: '320.00', money: 'PLANNED', delivery: '2026-11-20', work: 'WRK-PLS-002' },
      { code: 'MAT-DRP-003', name: 'Anhydrite flowing screed CA-F5, 50 mm', unit: 'm2', qty: '150', price: '9.80', money: 'PLANNED', delivery: '2026-11-26', work: 'WRK-PLS-003', boq: 'BOQ-INT-001' },
      { code: 'MAT-DRP-004', name: 'Screed edge strips and PE foil', unit: 'set', qty: '1', price: '260.00', money: 'PLANNED', delivery: '2026-11-26', work: 'WRK-PLS-003' },
      { code: 'MAT-DRP-005', name: 'Gypsum boards 12.5 mm (incl. impregnated)', unit: 'm2', qty: '190', price: '4.20', money: 'PLANNED', delivery: '2026-11-18', work: 'WRK-DRY-001', boq: 'BOQ-INT-002' },
      { code: 'MAT-DRP-006', name: 'Metal stud profiles CW/UW 75', unit: 'm', qty: '420', price: '2.10', money: 'PLANNED', delivery: '2026-11-18', work: 'WRK-DRY-001' },
      { code: 'MAT-DRP-007', name: 'Mineral wool acoustic insulation 40 mm', unit: 'm2', qty: '90', price: '4.60', money: 'PLANNED', delivery: '2026-11-18', work: 'WRK-DRY-001' },
      { code: 'MAT-DRP-008', name: 'Jointing compound and tape', unit: 'set', qty: '1', price: '230.00', money: 'PLANNED', delivery: '2026-11-18', work: 'WRK-DRY-003' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'flooring-tiles', kind: 'MATERIAL', supplier: MERCHANT, contractor: FINISHER }, [
      { code: 'MAT-FLT-001', name: 'Engineered oak parquet 13 mm', unit: 'm2', qty: '105', price: '24.50', money: 'PLANNED', delivery: '2027-01-14', work: 'WRK-FLT-002', boq: 'BOQ-INT-003' },
      { code: 'MAT-FLT-002', name: 'Porcelain stoneware tiles 60×60', unit: 'm2', qty: '75', price: '21.90', money: 'PLANNED', delivery: '2027-01-11', work: 'WRK-FLT-001', boq: 'BOQ-INT-004' },
      { code: 'MAT-FLT-003', name: 'Tile adhesive, grout and waterproofing', unit: 'set', qty: '1', price: '520.00', money: 'PLANNED', delivery: '2027-01-11', work: 'WRK-FLT-001' },
      { code: 'MAT-FLT-004', name: 'Impact sound underlay for parquet', unit: 'm2', qty: '105', price: '2.90', money: 'PLANNED', delivery: '2027-01-14', work: 'WRK-FLT-002' },
      { code: 'MAT-FLT-005', name: 'Oak skirting boards', unit: 'm', qty: '120', price: '4.80', money: 'PLANNED', delivery: '2027-01-14', work: 'WRK-FLT-003' },
      { code: 'MAT-FLT-006', name: 'Transition profiles and tile edge trims', unit: 'set', qty: '1', price: '190.00', money: 'PLANNED', delivery: '2027-01-14', work: 'WRK-FLT-003' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'paint', kind: 'MATERIAL', supplier: MERCHANT, contractor: FINISHER }, [
      { code: 'MAT-PAI-001', name: 'Interior emulsion paint, white, scrub class 2 (12.5 l)', unit: 'pcs', qty: '22', price: '38.90', money: 'PLANNED', delivery: '2027-01-27', work: 'WRK-PAI-001' },
      { code: 'MAT-PAI-002', name: 'Deep primer (10 l)', unit: 'pcs', qty: '8', price: '29.50', money: 'PLANNED', delivery: '2027-01-27', work: 'WRK-PAI-001' },
      { code: 'MAT-PAI-003', name: 'Acrylic sealant and filler', unit: 'set', qty: '1', price: '145.00', money: 'PLANNED', delivery: '2027-01-27', work: 'WRK-PAI-003' },
      { code: 'MAT-PAI-004', name: 'Fleece wallpaper', unit: 'm2', qty: '120', price: '1.40', money: 'PLANNED', delivery: '2027-01-27', work: 'WRK-PAI-002' },
      { code: 'MAT-PAI-005', name: 'Masking materials and covers', unit: 'set', qty: '1', price: '85.00', money: 'PLANNED', delivery: '2027-01-27', work: 'WRK-PAI-001' },
      { code: 'MAT-PAI-006', name: 'Tinted feature-wall paint (2.5 l)', unit: 'pcs', qty: '4', price: '34.00', money: 'PLANNED', delivery: '2027-01-27', work: 'WRK-PAI-001' },
    ]),
    ...buildRows({ category: 'MATERIALS', section: 'exterior', kind: 'MATERIAL', supplier: MERCHANT, contractor: SHELL }, [
      { code: 'MAT-EXT-001', name: 'Concrete paving stones 8 cm (driveway, paths)', unit: 'm2', qty: '60', price: '24.50', money: 'PLANNED', delivery: '2027-02-24', work: 'WRK-OUT-001', boq: 'BOQ-EXT-001' },
      { code: 'MAT-EXT-002', name: 'Gravel base 0/32', unit: 't', qty: '45', price: '21.00', money: 'PLANNED', delivery: '2027-02-24', work: 'WRK-OUT-001' },
      { code: 'MAT-EXT-003', name: 'Carport kit, timber, 3 × 6 m', unit: 'set', qty: '1', price: '3450.00', money: 'PLANNED', delivery: '2027-02-24', work: 'WRK-OUT-002', boq: 'BOQ-EXT-003' },
      { code: 'MAT-EXT-004', name: 'Double-rod fence and gate', unit: 'm', qty: '46', price: '39.00', money: 'PLANNED', delivery: '2027-02-24', work: 'WRK-OUT-003', boq: 'BOQ-EXT-002' },
      { code: 'MAT-EXT-005', name: 'Topsoil and turf seed', unit: 'm2', qty: '110', price: '4.60', money: 'PLANNED', delivery: '2027-02-24', work: 'WRK-OUT-004' },
      { code: 'MAT-EXT-006', name: 'Concrete edging kerbs', unit: 'm', qty: '70', price: '6.20', money: 'PLANNED', delivery: '2027-02-24', work: 'WRK-OUT-001' },
    ]),
  ];
}

function constructionRows(): CostItemSeed[] {
  return [
    ...buildRows({ category: 'CONSTRUCTION', section: 'site-setup', kind: 'WORK', contractor: SHELL }, [
      { code: 'WRK-SIT-001', name: 'Site setup: fencing, container, toilet, site sign mounting', unit: 'lump', qty: '1', price: '1850.00', money: 'DONE', start: '2026-06-01', end: '2026-06-05' },
      { code: 'WRK-SIT-002', name: 'Scaffolding incl. 12 weeks hire', unit: 'm2', qty: '260', price: '14.50', money: { status: 'PARTIAL', actual: '1885.00' }, start: '2026-08-17', end: '2026-12-04' },
      { code: 'WRK-SIT-003', name: 'Construction waste skips and disposal', unit: 'pcs', qty: '10', price: '128.00', money: { status: 'PARTIAL', committed: '640.00', actual: '640.00' }, start: '2026-06-01', end: '2027-03-26' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'earthworks', kind: 'WORK', contractor: SHELL }, [
      { code: 'WRK-EAR-001', name: 'Topsoil stripping and excavation (soil class 4)', unit: 'm3', qty: '120', price: '38.00', money: 'DONE', start: '2026-06-01', end: '2026-06-05' },
      { code: 'WRK-EAR-002', name: 'Soil removal and disposal (Z1.1)', unit: 'm3', qty: '95', price: '34.00', money: 'DONE', start: '2026-06-01', end: '2026-06-09' },
      { code: 'WRK-EAR-003', name: 'Foundation slab and frost apron: formwork, reinforcement, pouring', unit: 'm2', qty: '90', price: '128.00', money: 'DONE', start: '2026-06-10', end: '2026-06-26' },
      { code: 'WRK-EAR-004', name: 'Gravel sub-base, compacted', unit: 'm2', qty: '90', price: '13.00', money: 'DONE', start: '2026-06-08', end: '2026-06-10' },
      { code: 'WRK-EAR-005', name: 'Concrete pump and vibrators (2 days)', unit: 'pcs', qty: '2', price: '310.00', money: 'DONE', start: '2026-06-15', end: '2026-06-16' },
      { code: 'WRK-EAR-006', name: 'Change order N-01: till pocket — extra excavation and soil exchange', description: 'Glacial till "nest" found at 1.4 m; addendum +3,800 €', unit: 'lump', qty: '1', price: '3800.00', money: 'DONE', start: '2026-06-04', end: '2026-06-09', changeOrder: true },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'shell', kind: 'WORK', contractor: SHELL }, [
      { code: 'WRK-SHL-001', name: 'Masonry ground-floor walls (labour)', unit: 'm2', qty: '135', price: '62.00', money: 'DONE', start: '2026-06-29', end: '2026-07-17' },
      { code: 'WRK-SHL-002', name: 'Floor slab: filigree elements, reinforcement, topping (labour)', unit: 'm2', qty: '82', price: '78.00', money: 'DONE', start: '2026-07-20', end: '2026-07-31' },
      { code: 'WRK-SHL-003', name: 'Masonry upper-floor walls (labour)', unit: 'm2', qty: '132', price: '62.00', money: 'DONE', start: '2026-08-03', end: '2026-08-21' },
      { code: 'WRK-SHL-004', name: 'Ring beams, lintels and formwork', unit: 'h', qty: '120', price: '48.00', money: 'DONE', start: '2026-07-13', end: '2026-08-28' },
      { code: 'WRK-SHL-005', name: 'Crane and lifting equipment hire', unit: 'lump', qty: '1', price: '2950.00', money: 'DONE', start: '2026-06-29', end: '2026-08-28' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'roof', kind: 'WORK', contractor: ROOFER }, [
      { code: 'WRK-ROO-001', name: 'Pyramid roof structure (carpentry)', unit: 'm2', qty: '120', price: '44.00', money: 'DONE', start: '2026-08-31', end: '2026-09-11' },
      { code: 'WRK-ROO-002', name: 'Eaves boarding and soffits', unit: 'm', qty: '40', price: '38.00', money: 'DONE', start: '2026-09-14', end: '2026-09-18' },
      { code: 'WRK-ROO-003', name: 'Roof membrane, battens and counter-battens', unit: 'm2', qty: '125', price: '18.00', money: { status: 'CONTRACTED', actual: '2250.00' }, start: '2026-09-21', end: '2026-09-30' },
      { code: 'WRK-ROO-004', name: 'Roof tiling incl. ridges and hips', unit: 'm2', qty: '125', price: '32.00', money: { status: 'CONTRACTED', actual: '2000.00' }, start: '2026-09-28', end: '2026-10-14' },
      { code: 'WRK-ROO-005', name: 'Gutters, downpipes and flashing (sheet-metal work)', unit: 'h', qty: '45', price: '52.00', money: 'CONTRACTED', start: '2026-10-12', end: '2026-10-16' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'windows-install', kind: 'WORK', contractor: ROOFER }, [
      { code: 'WRK-WIN-001', name: 'Window installation, RAL-compliant (14 units)', unit: 'm2', qty: '32', price: '135.00', money: 'CONTRACTED', start: '2026-10-19', end: '2026-10-30' },
      { code: 'WRK-WIN-002', name: 'Front door installation', unit: 'pcs', qty: '1', price: '480.00', money: 'CONTRACTED', start: '2026-10-19', end: '2026-10-20' },
      { code: 'WRK-WIN-003', name: 'Roller shutters and window sills installation', unit: 'pcs', qty: '14', price: '98.00', money: 'CONTRACTED', start: '2026-11-02', end: '2026-11-06' },
      { code: 'WRK-WIN-004', name: 'Stair installation', unit: 'set', qty: '1', price: '1950.00', money: 'PLANNED', start: '2027-02-15', end: '2027-02-26' },
      { code: 'WRK-WIN-005', name: 'Interior door installation', unit: 'pcs', qty: '8', price: '165.00', money: 'PLANNED', start: '2027-02-15', end: '2027-02-26' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'electrical-install', kind: 'WORK', contractor: ELECTRICIAN }, [
      { code: 'WRK-ELE-001', name: 'First fix: conduits, boxes and cabling', unit: 'h', qty: '120', price: '52.00', money: { status: 'PARTIAL', actual: '1560.00' }, start: '2026-10-12', end: '2026-11-20' },
      { code: 'WRK-ELE-002', name: 'Meter cabinet and distribution board installation', unit: 'h', qty: '16', price: '52.00', money: 'CONTRACTED', start: '2026-10-19', end: '2026-10-23' },
      { code: 'WRK-ELE-003', name: 'Second fix: sockets, switches, lighting, smoke detectors', unit: 'h', qty: '40', price: '52.00', money: 'PLANNED', start: '2027-02-22', end: '2027-03-05' },
      { code: 'WRK-ELE-004', name: 'Testing and documentation (DIN VDE 0100-600)', unit: 'lump', qty: '1', price: '650.00', money: 'PLANNED', start: '2027-03-08', end: '2027-03-10' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'plumbing-install', kind: 'WORK', contractor: SHK }, [
      { code: 'WRK-PLU-001', name: 'First fix: water supply and drainage pipework', unit: 'h', qty: '110', price: '58.00', money: 'CONTRACTED', start: '2026-10-12', end: '2026-11-20' },
      { code: 'WRK-PLU-002', name: 'Concealed WC frames installation', unit: 'pcs', qty: '2', price: '290.00', money: 'CONTRACTED', start: '2026-10-26', end: '2026-10-30' },
      { code: 'WRK-PLU-003', name: 'Second fix: sanitary ceramics and taps', unit: 'h', qty: '36', price: '58.00', money: 'PLANNED', start: '2027-02-22', end: '2027-03-05' },
      { code: 'WRK-PLU-004', name: 'Pressure test, flushing and commissioning', unit: 'lump', qty: '1', price: '480.00', money: 'PLANNED', start: '2027-03-08', end: '2027-03-09' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'heating-install', kind: 'WORK', contractor: SHK }, [
      { code: 'WRK-HEA-001', name: 'Heat pump and hydraulic station installation', unit: 'h', qty: '48', price: '58.00', money: 'CONTRACTED', start: '2026-11-02', end: '2026-11-27' },
      { code: 'WRK-HEA-002', name: 'Underfloor heating installation and pressure test', unit: 'm2', qty: '144', price: '18.00', money: 'CONTRACTED', start: '2026-11-02', end: '2026-11-13' },
      { code: 'WRK-HEA-003', name: 'Heat pump commissioning and hydraulic balancing', unit: 'lump', qty: '1', price: '690.00', money: 'PLANNED', start: '2027-03-01', end: '2027-03-05' },
      { code: 'WRK-HEA-004', name: 'Ventilation ducting and MVHR installation', unit: 'h', qty: '60', price: '58.00', money: 'CONTRACTED', start: '2026-11-09', end: '2026-11-27' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'facade', kind: 'WORK', contractor: FINISHER }, [
      { code: 'WRK-FAC-001', name: 'ETICS: bonding and anchoring EPS boards', unit: 'm2', qty: '196', price: '32.00', money: 'PLANNED', start: '2026-10-26', end: '2026-11-13' },
      { code: 'WRK-FAC-002', name: 'Base coat with reinforcement mesh', unit: 'm2', qty: '196', price: '14.00', money: 'PLANNED', start: '2026-11-09', end: '2026-11-20' },
      { code: 'WRK-FAC-003', name: 'Finishing render and facade paint', unit: 'm2', qty: '196', price: '15.00', money: 'PLANNED', start: '2026-11-16', end: '2026-11-27' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'drywall', kind: 'WORK', contractor: FINISHER }, [
      { code: 'WRK-DRY-001', name: 'Stud partition walls, double-boarded', unit: 'm2', qty: '45', price: '42.00', money: 'PLANNED', start: '2026-11-23', end: '2026-12-04' },
      { code: 'WRK-DRY-002', name: 'Wet-room boarding and installation walls', unit: 'm2', qty: '18', price: '48.00', money: 'PLANNED', start: '2026-11-30', end: '2026-12-08' },
      { code: 'WRK-DRY-003', name: 'Jointing and filling (Q2)', unit: 'h', qty: '24', price: '45.00', money: 'PLANNED', start: '2026-12-07', end: '2026-12-11' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'plaster-screed', kind: 'WORK', contractor: FINISHER }, [
      { code: 'WRK-PLS-001', name: 'Machine-applied gypsum plaster Q2', unit: 'm2', qty: '420', price: '12.50', money: 'PLANNED', start: '2026-11-30', end: '2026-12-11' },
      { code: 'WRK-PLS-002', name: 'Window reveals and plaster stop beads', unit: 'h', qty: '32', price: '45.00', money: 'PLANNED', start: '2026-11-30', end: '2026-12-04' },
      { code: 'WRK-PLS-003', name: 'Anhydrite flowing screed 50 mm incl. edge strips', unit: 'm2', qty: '150', price: '15.50', money: 'PLANNED', start: '2026-12-14', end: '2026-12-18' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'flooring-tiling', kind: 'WORK', contractor: FINISHER }, [
      { code: 'WRK-FLT-001', name: 'Tiling bathrooms, WC and utility incl. waterproofing', unit: 'm2', qty: '75', price: '62.00', money: 'PLANNED', start: '2027-01-18', end: '2027-02-05' },
      { code: 'WRK-FLT-002', name: 'Parquet laying, floating, incl. underlay', unit: 'm2', qty: '105', price: '28.00', money: 'PLANNED', start: '2027-01-27', end: '2027-02-10' },
      { code: 'WRK-FLT-003', name: 'Skirting boards and transitions', unit: 'h', qty: '30', price: '46.00', money: 'PLANNED', start: '2027-02-08', end: '2027-02-12' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'painting', kind: 'WORK', contractor: FINISHER }, [
      { code: 'WRK-PAI-001', name: 'Interior walls and ceilings, 2 coats', unit: 'm2', qty: '570', price: '5.20', money: 'PLANNED', start: '2027-02-01', end: '2027-02-17' },
      { code: 'WRK-PAI-002', name: 'Fleece wallpaper application', unit: 'm2', qty: '120', price: '4.50', money: 'PLANNED', start: '2027-02-01', end: '2027-02-05' },
      { code: 'WRK-PAI-003', name: 'Sealant joints and touch-ups', unit: 'h', qty: '7', price: '45.00', money: 'PLANNED', start: '2027-02-17', end: '2027-02-19' },
    ]),
    ...buildRows({ category: 'CONSTRUCTION', section: 'outdoor', kind: 'WORK', contractor: SHELL }, [
      { code: 'WRK-OUT-001', name: 'Paving: sub-base and laying (driveway, paths)', unit: 'm2', qty: '60', price: '58.00', money: 'PLANNED', start: '2027-03-01', end: '2027-03-12' },
      { code: 'WRK-OUT-002', name: 'Carport assembly and foundations', unit: 'set', qty: '1', price: '2650.00', money: 'PLANNED', start: '2027-03-08', end: '2027-03-12' },
      { code: 'WRK-OUT-003', name: 'Fence and gate installation', unit: 'm', qty: '46', price: '42.00', money: 'PLANNED', start: '2027-03-15', end: '2027-03-19' },
      { code: 'WRK-OUT-004', name: 'Fine grading, topsoil and turf', unit: 'm2', qty: '110', price: '14.00', money: 'PLANNED', start: '2027-03-19', end: '2027-03-26' },
      { code: 'WRK-OUT-005', name: 'Rainwater cistern and throttled discharge', unit: 'lump', qty: '1', price: '2850.00', money: 'PLANNED', start: '2027-03-01', end: '2027-03-05' },
    ]),
  ];
}

function marketingRows(): CostItemSeed[] {
  const m = (section: string) => ({ category: 'MARKETING' as const, section, kind: 'SERVICE' as const, contractor: AGENCY });
  return [
    ...buildRows(m('listings'), [
      { code: 'SRV-LST-001', name: 'ImmoScout24 project package, 4 months', unit: 'set', qty: '4', price: '250.00', money: 'PLANNED', start: '2026-11-01', end: '2027-02-28' },
      { code: 'SRV-LST-002', name: 'Immowelt project package, 4 months', unit: 'set', qty: '4', price: '150.00', money: 'PLANNED', start: '2026-11-01', end: '2027-02-28' },
    ]),
    ...buildRows(m('paid-search'), [
      { code: 'SRV-SEA-001', name: 'Google Ads "Haus bauen Leipzig", "Neubau Taucha" (30 €/day × 90 days)', unit: 'lump', qty: '1', price: '2700.00', money: 'PLANNED', start: '2026-11-01', end: '2027-02-28' },
    ]),
    ...buildRows(m('social'), [
      { code: 'SRV-SOC-001', name: 'Meta / Instagram lead ads, monthly flights', unit: 'set', qty: '3', price: '1000.00', money: 'PLANNED', start: '2026-11-15', end: '2027-02-15' },
    ]),
    ...buildRows(m('website-seo'), [
      { code: 'SRV-WEB-001', name: 'Project landing page', unit: 'lump', qty: '1', price: '2500.00', money: 'DONE', start: '2026-09-01', end: '2026-09-30' },
      { code: 'SRV-WEB-002', name: 'SEO and local listings, 4 months', unit: 'set', qty: '4', price: '400.00', money: { status: 'PARTIAL', actual: '400.00' }, start: '2026-10-01', end: '2027-01-31' },
    ]),
    ...buildRows(m('visuals'), [
      { code: 'SRV-VIS-001', name: 'Exterior renders (3 views)', unit: 'pcs', qty: '3', price: '500.00', money: 'CONTRACTED', start: '2026-10-01', end: '2026-10-30' },
      { code: 'SRV-VIS-002', name: '360° virtual tour', unit: 'lump', qty: '1', price: '1000.00', money: 'PLANNED', start: '2026-11-02', end: '2026-11-15' },
    ]),
    ...buildRows(m('print-signage'), [
      { code: 'SRV-PRT-001', name: 'Site sign (Bauschild) 3 × 2 m', unit: 'pcs', qty: '1', price: '2000.00', money: 'DONE', start: '2026-07-01', end: '2026-07-03' },
      { code: 'SRV-PRT-002', name: 'Brochures (250 copies)', unit: 'pcs', qty: '250', price: '3.60', money: 'PLANNED', start: '2026-11-02', end: '2026-11-13' },
      { code: 'SRV-PRT-003', name: 'Flyers (1,000 copies)', unit: 'lump', qty: '1', price: '200.00', money: 'PLANNED', start: '2026-11-02', end: '2027-03-31' },
    ]),
    ...buildRows(m('events'), [
      { code: 'SRV-EVT-001', name: 'Open day 1 (shell visit)', unit: 'lump', qty: '1', price: '1500.00', money: 'PLANNED', start: '2027-02-20', end: '2027-02-20' },
      { code: 'SRV-EVT-002', name: 'Open day 2 (finished house)', unit: 'lump', qty: '1', price: '1500.00', money: 'PLANNED', start: '2027-03-13', end: '2027-03-13' },
    ]),
    ...buildRows({ category: 'MARKETING', section: 'sales-commission', kind: 'SERVICE' }, [
      { code: 'SRV-COM-001', name: 'Broker commission — not used (direct sale)', description: '3.57 % gross per side if a broker were used (§ 656c BGB)', unit: 'lump', qty: '1', price: '0', money: 'PLANNED' },
    ]),
  ];
}

export function buildTauchaItems(): CostItemSeed[] {
  return [...landRows(), ...architectureRows(), ...materialRows(), ...constructionRows(), ...marketingRows()];
}
