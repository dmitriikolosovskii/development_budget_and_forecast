import type { CostCategory } from './enums';

export interface CatalogSection {
  category: CostCategory;
  /** stable slug, unique within a category (URL segment, seed key) */
  section: string;
  name: string;
  /** row code prefix: `<KIND>-<codePrefix>-NNN` */
  codePrefix: string;
  /** order within the category */
  sortOrder: number;
}

type Row = readonly [section: string, name: string, codePrefix: string];

const sections = (
  category: CostCategory,
  rows: readonly Row[],
): CatalogSection[] =>
  rows.map(([section, name, codePrefix], i) => ({
    category,
    section,
    name,
    codePrefix,
    sortOrder: (i + 1) * 10,
  }));

/** The budget line catalogue (CONTRACTS §4): the same sections in the seed, `POST /projects` and the wizard. */
export const BUDGET_CATALOG: readonly CatalogSection[] = [
  ...sections('LAND', [
    ['purchase', 'Land purchase', 'PUR'],
    ['acquisition-costs', 'Taxes, notary & land registry', 'ACQ'],
    ['site-development', 'Utility connections & site development', 'DEV'],
    ['surveys', 'Survey & soil report', 'SUR'],
  ]),
  ...sections('ARCHITECTURE', [
    ['design', 'Architect (HOAI)', 'DES'],
    ['engineering', 'Structural & energy engineering', 'ENG'],
    ['permits', 'Permits & authority fees', 'PER'],
    ['insurance', 'Construction insurance', 'INS'],
  ]),
  ...sections('MATERIALS', [
    ['concrete', 'Concrete & reinforcement', 'CON'],
    ['masonry', 'Masonry', 'MAS'],
    ['roofing', 'Roof structure & roofing', 'ROF'],
    ['windows-doors', 'Windows, doors & stairs', 'WIN'],
    ['insulation-facade', 'Insulation & facade', 'INF'],
    ['electrical', 'Electrical', 'ELE'],
    ['plumbing', 'Plumbing & sanitary', 'PLU'],
    ['heating', 'Heating & ventilation', 'HEA'],
    ['drywall-plaster', 'Drywall, plaster & screed', 'DRP'],
    ['flooring-tiles', 'Flooring & tiles', 'FLT'],
    ['paint', 'Paint & finishes', 'PAI'],
    ['exterior', 'Outdoor & landscaping', 'EXT'],
  ]),
  ...sections('CONSTRUCTION', [
    ['site-setup', 'Site setup & logistics', 'SIT'],
    ['earthworks', 'Earthworks & foundation', 'EAR'],
    ['shell', 'Shell construction', 'SHL'],
    ['roof', 'Carpentry & roofing', 'ROO'],
    ['windows-install', 'Window, door & stair installation', 'WIN'],
    ['electrical-install', 'Electrical installation', 'ELE'],
    ['plumbing-install', 'Plumbing installation', 'PLU'],
    ['heating-install', 'Heating & ventilation installation', 'HEA'],
    ['plaster-screed', 'Plaster & screed', 'PLS'],
    ['drywall', 'Drywall', 'DRY'],
    ['flooring-tiling', 'Flooring & tiling', 'FLT'],
    ['painting', 'Painting', 'PAI'],
    ['facade', 'Facade (ETICS)', 'FAC'],
    ['outdoor', 'Outdoor works', 'OUT'],
    ['contingency', 'Contingency reserve', 'CTG'],
  ]),
  ...sections('MARKETING', [
    ['listings', 'Property portals', 'LST'],
    ['paid-search', 'Paid search', 'SEA'],
    ['social', 'Social media ads', 'SOC'],
    ['website-seo', 'Website & SEO', 'WEB'],
    ['visuals', 'Renders, photo & virtual tours', 'VIS'],
    ['print-signage', 'Print & site signage', 'PRT'],
    ['events', 'Show house & open days', 'EVT'],
    ['sales-commission', 'Sales commission', 'COM'],
  ]),
];

/** Catalogue sections of one category, in display order. */
export function catalogSections(category: CostCategory): CatalogSection[] {
  return BUDGET_CATALOG.filter((s) => s.category === category);
}

/** The catalogue entry for a line, or `undefined` for a custom section. */
export function findCatalogSection(
  category: CostCategory,
  section: string,
): CatalogSection | undefined {
  return BUDGET_CATALOG.find(
    (s) => s.category === category && s.section === section,
  );
}
