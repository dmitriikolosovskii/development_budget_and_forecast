import { checkSchedule, summarizeProject } from '@default-project/budget-engine';
import { projectSnapshotSchema } from '@default-project/types';
import { scalePlan, scaleQty, shiftDate } from './derive';
import { buildOrganizations } from './organizations';
import { buildAllProjectSeeds, buildMarkkleebergSeed, buildMarkranstaedtSeed, buildTemplateSeed } from './projects';
import { buildTauchaSeed } from './taucha';
import { toSnapshot } from './to-snapshot';
import type { ProjectSeed } from './types';

const orgs = buildOrganizations();
const statusCounts = (seed: ProjectSeed, today: string) =>
  Object.values(checkSchedule(toSnapshot(seed, orgs).items, today)).reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {},
  );

describe('derive helpers', () => {
  it('should scale continuous quantities half-up and keep pieces whole when the factor is 110/144', () => {
    expect(scaleQty(22_500, 'm3', { num: 110, den: 144 })).toBe(17_188); // 17.1875 → 17.188
    expect(scaleQty(1_000, 'pcs', { num: 110, den: 144 })).toBe(1_000);
    expect(scaleQty(1_000, 'lump', { num: 160, den: 144 })).toBe(1_000);
  });

  it('should shift dates across month and year ends when given a day offset', () => {
    expect(shiftDate('2026-04-01', -547)).toBe('2024-10-01');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate(null, 5)).toBeNull();
  });

  it('should scale rooms by shared edges so neighbours still touch when the factor is irrational', () => {
    const base = buildTauchaSeed().plan;
    if (!base) throw new Error('Taucha has no plan');
    const rooms = new Map(scalePlan(base, { num: 160, den: 144 }).rooms.map((r) => [r.code, r]));
    const kit = rooms.get('GF-KIT');
    expect(kit && kit.yCm + kit.hCm).toBe(rooms.get('GF-STU')?.yCm);
  });
});

describe('derived projects', () => {
  it('should match the ProjectSnapshot contract for every seeded project', () => {
    for (const seed of buildAllProjectSeeds()) expect(() => projectSnapshotSchema.parse(toSnapshot(seed, orgs))).not.toThrow();
  });

  it('should finish Markranstädt with everything paid and delivered and a small overrun [AC-03.1]', () => {
    const seed = buildMarkranstaedtSeed();
    const summary = summarizeProject(toSnapshot(seed, orgs)).project;
    expect(seed.project.status).toBe('COMPLETED');
    expect(seed.items.every((i) => i.status === 'DONE' && i.actualCents === i.committedCents)).toBe(true);
    expect(seed.items.filter((i) => i.kind === 'MATERIAL').every((i) => i.deliveredDate !== null)).toBe(true);
    expect(summary.overrun).toBe(true);
    expect(summary.forecast / summary.approved).toBeLessThan(1.03);
    expect(seed.land).toMatchObject({ areaM2: 600, landValuePerM2Cents: 11_200 });
    expect(seed.items.find((i) => i.code === 'SRV-PUR-001')).toMatchObject({ qtyMilli: 600_000, unitPriceCents: 11_200 });
  });

  it('should plan Markkleeberg with nothing committed, no overruns and no conflicts [AC-03.1]', () => {
    const seed = buildMarkkleebergSeed();
    const summary = summarizeProject(toSnapshot(seed, orgs));
    expect(seed.project.status).toBe('PLANNING');
    expect(seed.items.every((i) => i.status === 'PLANNED' && i.committedCents === 0 && i.actualCents === 0)).toBe(true);
    expect(summary.overrunLines).toEqual([]);
    expect(statusCounts(seed, '2026-10-14')).toEqual({ ON_TIME: 89, READY: 55 });
    expect(seed.land).toMatchObject({ areaM2: 480, landValuePerM2Cents: 41_200 });
  });

  it('should build the template as a clean, dated copy of the demo project for the wizard [AC-03.1]', () => {
    const taucha = buildTauchaSeed();
    const seed = buildTemplateSeed(taucha);
    const summary = summarizeProject(toSnapshot(seed, orgs));
    expect(seed.project).toMatchObject({ slug: 'template-efh-144', isTemplate: true, startDate: '2026-04-01' });
    expect(seed.budgetLines).toHaveLength(43);
    expect(summary.project.approved).toBeGreaterThanOrEqual(57_386_100);
    expect(summary.overrunLines).toEqual([]);
    expect(seed.items.every((i) => i.status === 'PLANNED' && i.committedCents === 0 && i.actualCents === 0 && i.deliveredDate === null)).toBe(true);
    expect(seed.deliveries).toEqual([]);
    expect(seed.items.every((i) => i.startDate !== null || i.deliveryDate !== null || i.section === 'sales-commission')).toBe(true);
    const links = (s: ProjectSeed) => s.items.filter((i) => i.requiredForWorkCode !== null).length;
    expect(links(seed)).toBe(links(taucha));
    expect(statusCounts(seed, '2026-03-31')).toEqual({ ON_TIME: 89, READY: 55 });
  });

  it('should not copy the demo change order into derived projects', () => {
    for (const seed of [buildMarkranstaedtSeed(), buildMarkkleebergSeed(), buildTemplateSeed()]) {
      expect(seed.items.find((i) => i.code === 'WRK-EAR-006')).toBeUndefined();
    }
  });
});
