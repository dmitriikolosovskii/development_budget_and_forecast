import { BUDGET_CATALOG, catalogSections, findCatalogSection } from './catalog';
import { COST_CATEGORIES } from './enums';

describe('BUDGET_CATALOG', () => {
  it('should hold the 43 sections of CONTRACTS §4 when counted per category', () => {
    const counts = COST_CATEGORIES.map((c) => catalogSections(c).length);
    expect(counts).toEqual([4, 4, 12, 15, 8]);
    expect(BUDGET_CATALOG).toHaveLength(43);
  });

  it('should have unique section slugs and code prefixes within each category', () => {
    for (const c of COST_CATEGORIES) {
      const rows = catalogSections(c);
      expect(new Set(rows.map((r) => r.section)).size).toBe(rows.length);
      expect(new Set(rows.map((r) => r.codePrefix)).size).toBe(rows.length);
    }
  });

  it('should find the electrical materials section with prefix ELE', () => {
    expect(findCatalogSection('MATERIALS', 'electrical')).toMatchObject({
      name: 'Electrical',
      codePrefix: 'ELE',
    });
    expect(findCatalogSection('MATERIALS', 'nope')).toBeUndefined();
  });
});
