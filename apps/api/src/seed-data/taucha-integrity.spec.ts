import { BUDGET_CATALOG, HOUSE_SECTIONS, ITEM_KIND_CODE } from '@default-project/types';
import { buildOrganizations } from './organizations';
import { buildAllProjectSeeds } from './projects';
import { buildTauchaSeed } from './taucha';
import type { ProjectSeed, RoomSeed } from './types';

const orgRole = new Map(buildOrganizations().map((o) => [o.slug, o.role]));
const MATERIAL_SECTIONS = BUDGET_CATALOG.filter((c) => c.category === 'MATERIALS').map((c) => c.section);
const CONSTRUCTION_SECTIONS = BUDGET_CATALOG.filter((c) => c.category === 'CONSTRUCTION' && c.section !== 'contingency').map(
  (c) => c.section,
);

describe('Taucha seed: integrity', () => {
  const seed = buildTauchaSeed();
  const byCode = new Map(seed.items.map((i) => [i.code, i]));

  it('should give every material row a supplier and an installing contractor [AC-03.3]', () => {
    for (const i of seed.items.filter((r) => r.kind === 'MATERIAL')) {
      expect([i.code, orgRole.get(i.supplierSlug ?? ''), orgRole.get(i.contractorSlug ?? '')]).toEqual([i.code, 'SUPPLIER', 'CONTRACTOR']);
    }
  });

  it('should give every work row a contractor and start on or before its end [AC-03.3]', () => {
    for (const w of seed.items.filter((r) => r.kind === 'WORK')) {
      expect([w.code, orgRole.get(w.contractorSlug ?? '')]).toEqual([w.code, 'CONTRACTOR']);
      expect([w.code, w.startDate !== null && w.endDate !== null && w.startDate <= w.endDate]).toEqual([w.code, true]);
    }
  });

  it('should have at least 6 material rows per materials section and 3 work rows per construction section [AC-03.3]', () => {
    for (const section of MATERIAL_SECTIONS) {
      const n = seed.items.filter((i) => i.section === section && i.kind === 'MATERIAL').length;
      expect([section, n >= 6]).toEqual([section, true]);
    }
    for (const section of CONSTRUCTION_SECTIONS) {
      const n = seed.items.filter((i) => i.category === 'CONSTRUCTION' && i.section === section && i.kind === 'WORK').length;
      expect([section, n >= 3]).toEqual([section, true]);
    }
    expect(seed.items.filter((i) => i.section === 'contingency')).toEqual([]);
  });

  it('should point every requiredForWork link at a work row [AC-03.3]', () => {
    for (const m of seed.items.filter((i) => i.requiredForWorkCode !== null)) {
      expect([m.code, m.kind, byCode.get(m.requiredForWorkCode ?? '')?.kind]).toEqual([m.code, 'MATERIAL', 'WORK']);
    }
  });

  it('should link BOQ components to material rows with the same quantity in every project [AC-03.4]', () => {
    for (const s of buildAllProjectSeeds()) {
      const components = new Map((s.plan?.components ?? []).map((c) => [c.code, c]));
      const linked = s.items.filter((i) => i.boqCode !== null);
      expect(linked.length).toBe(components.size);
      for (const i of linked) {
        const c = components.get(i.boqCode ?? '');
        expect([s.project.slug, i.code, c?.qtyMilli, c?.unit, c?.materialSection]).toEqual([s.project.slug, i.code, i.qtyMilli, i.unit, i.section]);
      }
    }
  });

  it('should use catalogue material sections and at least 3 components per house section [AC-03.4]', () => {
    const components = seed.plan?.components ?? [];
    for (const c of components) expect(MATERIAL_SECTIONS).toContain(c.materialSection);
    for (const hs of HOUSE_SECTIONS) {
      expect([hs, components.filter((c) => c.houseSection === hs).length >= 3]).toEqual([hs, true]);
    }
  });

  it('should seed 7 distinct utilities and the 14 rooms of GERMANY-DATA §2 (143.65 m²) [AC-03.4]', () => {
    const types = seed.land?.utilities.map((u) => u.type) ?? [];
    expect(new Set(types).size).toBe(7);
    const rooms = seed.plan?.rooms ?? [];
    expect(rooms).toHaveLength(14);
    expect(rooms.reduce((s, r) => s + r.wCm * r.hCm, 0)).toBe(1_436_500);
  });

  it('should keep rooms inside the footprint and free of overlaps in every project [AC-03.4]', () => {
    const overlap = (a: RoomSeed, b: RoomSeed) =>
      a.floor === b.floor && a.xCm < b.xCm + b.wCm && b.xCm < a.xCm + a.wCm && a.yCm < b.yCm + b.hCm && b.yCm < a.yCm + a.hCm;
    for (const s of buildAllProjectSeeds()) {
      const plan = s.plan;
      if (!plan) throw new Error(`${s.project.slug}: no plan`);
      for (const r of plan.rooms) {
        expect([s.project.slug, r.code, r.xCm + r.wCm <= plan.footprintWidthCm && r.yCm + r.hCm <= plan.footprintDepthCm]).toEqual([s.project.slug, r.code, true]);
        expect([s.project.slug, r.code, r.floor < plan.storeys]).toEqual([s.project.slug, r.code, true]);
      }
      const pairs = plan.rooms.flatMap((a, i) => plan.rooms.slice(i + 1).filter((b) => overlap(a, b)).map((b) => `${a.code}/${b.code}`));
      expect([s.project.slug, pairs]).toEqual([s.project.slug, []]);
    }
  });

  it('should keep deliveries consistent with item actuals and dates (block 10 rule) [AC-03.4]', () => {
    expect(seed.deliveries.length).toBeGreaterThanOrEqual(5);
    expect(seed.deliveries.length).toBeLessThanOrEqual(8);
    const keys = seed.deliveries.map((d) => `${d.itemCode}|${d.deliveryNoteNo}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const code of new Set(seed.deliveries.map((d) => d.itemCode))) {
      const item = byCode.get(code);
      const delivered = seed.deliveries.filter((d) => d.itemCode === code && d.kind === 'DELIVERED');
      const expected = seed.deliveries.filter((d) => d.itemCode === code && d.kind === 'EXPECTED');
      if (delivered.length) {
        expect([code, item?.actualCents]).toEqual([code, delivered.reduce((s, d) => s + (d.invoiceCents ?? 0), 0)]);
        expect([code, item?.actualCents]).toEqual([code, item?.committedCents]);
        expect([code, item?.deliveredDate]).toEqual([code, delivered.map((d) => d.date).sort().at(-1)]);
      }
      for (const d of expected) expect([code, d.date]).toEqual([code, item?.deliveryDate]);
    }
    expect(seed.deliveries.filter((d) => d.kind === 'EXPECTED').map((d) => d.itemCode).sort()).toEqual(['MAT-HEA-001', 'MAT-WIN-001']);
  });

  it('should use unique codes with the catalogue prefix of their line in every project [AC-03.6]', () => {
    const prefix = new Map(BUDGET_CATALOG.map((c) => [`${c.category}/${c.section}`, c.codePrefix]));
    const check = (s: ProjectSeed) => {
      const codes = s.items.map((i) => i.code);
      expect([s.project.slug, new Set(codes).size]).toEqual([s.project.slug, codes.length]);
      for (const i of s.items) {
        const re = new RegExp(`^${ITEM_KIND_CODE[i.kind]}-${prefix.get(`${i.category}/${i.section}`)}-\\d{3}$`);
        expect([i.code, re.test(i.code)]).toEqual([i.code, true]);
      }
    };
    for (const s of buildAllProjectSeeds()) check(s);
  });
});
