import type { HouseSection } from '@default-project/types';

export interface HouseSectionInfo {
  label: string;
  /** `BOQ-<code>-NNN` for new rows */
  code: string;
  description: string;
  /** MATERIALS line slug suggested for new components (CONTRACTS §4) */
  materialSection: string;
}

/** The 10 standard sections of a detached house (static texts). */
export const HOUSE_SECTION_INFO: Record<HouseSection, HouseSectionInfo> = {
  SITE_FOUNDATION: {
    label: 'Site & foundation',
    code: 'SIT',
    description:
      'Excavation, frost apron, XPS perimeter insulation and the reinforced foundation slab. No basement.',
    materialSection: 'concrete',
  },
  STRUCTURE: {
    label: 'Structure',
    code: 'STR',
    description: 'Load-bearing sand-lime brick walls, the reinforced concrete floor slab, ring beams and lintels.',
    materialSection: 'masonry',
  },
  ROOF: {
    label: 'Roof',
    code: 'ROF',
    description: 'Pyramid roof at 22°: timber roof structure, underlay, battens, concrete tiles, gutters and flashing.',
    materialSection: 'roofing',
  },
  OPENINGS: {
    label: 'Openings',
    code: 'OPN',
    description: 'Triple-glazed PVC windows, front door, roller shutters, interior doors and the timber stair.',
    materialSection: 'windows-doors',
  },
  ELECTRICAL: {
    label: 'Electrical',
    code: 'ELE',
    description: 'Meter cabinet and distribution board, NYM-J cabling, sockets and switches (RAL 2 stars).',
    materialSection: 'electrical',
  },
  PLUMBING: {
    label: 'Plumbing',
    code: 'PLU',
    description: 'Water supply and waste pipes, two bathrooms with sanitary ware and fittings.',
    materialSection: 'plumbing',
  },
  HEATING_VENTILATION: {
    label: 'Heating & ventilation',
    code: 'HVA',
    description: '7 kW air-to-water heat pump, underfloor heating and central ventilation with heat recovery.',
    materialSection: 'heating',
  },
  INTERIOR_FINISHES: {
    label: 'Interior finishes',
    code: 'INT',
    description: 'Plaster, anhydrite screed, drywall, parquet/vinyl flooring, tiles and paint.',
    materialSection: 'drywall-plaster',
  },
  FACADE_INSULATION: {
    label: 'Facade & insulation',
    code: 'FAC',
    description: 'ETICS with 18 cm EPS 032, render and top-floor ceiling insulation (KfW EH 55).',
    materialSection: 'insulation-facade',
  },
  EXTERIOR: {
    label: 'Exterior',
    code: 'EXT',
    description: 'Carport, paths, terrace, fencing and landscaping.',
    materialSection: 'exterior',
  },
};
