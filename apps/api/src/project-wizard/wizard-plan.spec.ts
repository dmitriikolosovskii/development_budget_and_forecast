import {
  daysBetween,
  itemPlannedCents,
  summarizeProject,
} from '@default-project/budget-engine';
import { COST_CATEGORIES, type CostCategory } from '@default-project/types';
import {
  deepFreeze,
  sequentialIds,
  templateFixture,
  wizardInput,
} from './wizard-fixtures';
import {
  buildWizardProject,
  WizardRangeError,
  type TemplateSource,
  type WizardPlan,
} from './wizard-plan';

const OPTS = { slug: 'haus-mueller-abc123', code: 'KF-2027-WABC123' };
const build = (template: TemplateSource, input = wizardInput()) =>
  buildWizardProject(template, input, { ...OPTS, newId: sequentialIds() });

/** Half-up for non-negative integers, written independently of the engine: floor((2a + b) / 2b). */
const halfUp = (a: number, b: number) => Math.floor((2 * a + b) / (2 * b));

function allItems(plan: WizardPlan) {
  return [...plan.items, ...plan.linkedItems];
}

function byCode(plan: WizardPlan, code: string) {
  const row = allItems(plan).find((i) => i.code === code);
  if (!row) throw new Error(`no row ${code}`);
  return row;
}

function summary(plan: WizardPlan) {
  return summarizeProject({
    budgetLines: plan.budgetLines,
    items: allItems(plan),
  } as unknown as Parameters<typeof summarizeProject>[0]);
}

describe('buildWizardProject', () => {
  let template: TemplateSource;
  beforeEach(() => {
    template = templateFixture();
  });

  it('should scale continuous quantities by 180/144 with half-up rounding and keep counted rows [AC-12.2]', () => {
    const concrete = template.items.find((i) => i.code === 'MAT-CON-001');
    if (!concrete) throw new Error('fixture lacks MAT-CON-001');
    concrete.qtyMilli = 1002; // 1002 × 1.25 = 1252.5 → 1253
    const counted = template.items.find(
      (i) => i.unit === 'pcs' && i.code.startsWith('MAT-'),
    );
    if (!counted) throw new Error('fixture lacks a pcs material');

    const plan = build(template);

    expect(byCode(plan, 'MAT-CON-001').qtyMilli).toBe(1253);
    expect(byCode(plan, counted.code).qtyMilli).toBe(counted.qtyMilli);
    for (const t of template.items.filter(
      (i) => i.unit === 'm2' && i.code.startsWith('MAT-'),
    )) {
      expect(byCode(plan, t.code).qtyMilli).toBe(halfUp(t.qtyMilli * 5, 4));
    }
  });

  it('should scale BOQ components with the same rule as their linked material rows [AC-12.2]', () => {
    const plan = build(template);
    const qtyById = new Map(plan.components.map((c) => [c.id, c.qtyMilli]));

    const linked = allItems(plan).filter((i) => i.boqComponentId);
    expect(linked.length).toBeGreaterThan(0);
    for (const i of linked)
      expect(qtyById.get(i.boqComponentId as string)).toBe(i.qtyMilli);
  });

  it('should point every link of the new rows to new ids, never to template ids [AC-12.2]', () => {
    const plan = build(template);
    const templateIds = new Set([
      ...template.items.map((i) => i.id),
      ...template.budgetLines.map((l) => l.id),
      ...(template.plan?.components.map((c) => c.id) ?? []),
    ]);
    const newItemIds = new Set(allItems(plan).map((i) => i.id));
    const newLineIds = new Set(plan.budgetLines.map((l) => l.id));
    const newComponentIds = new Set(plan.components.map((c) => c.id));

    const withWork = plan.linkedItems;
    expect(withWork.length).toBeGreaterThan(0);
    expect(plan.items.every((i) => i.requiredForWorkId === null)).toBe(true);
    for (const i of allItems(plan)) {
      expect(templateIds.has(i.id as string)).toBe(false);
      expect(newLineIds.has(i.budgetLineId)).toBe(true);
      if (i.requiredForWorkId) {
        expect(newItemIds.has(i.requiredForWorkId)).toBe(true);
        expect(templateIds.has(i.requiredForWorkId)).toBe(false);
      }
      if (i.boqComponentId) {
        expect(newComponentIds.has(i.boqComponentId)).toBe(true);
        expect(templateIds.has(i.boqComponentId)).toBe(false);
      }
    }
    expect(allItems(plan)).toHaveLength(template.items.length);
    expect(plan.rooms.every((r) => r.planId === plan.plan?.id)).toBe(true);
    expect(plan.utilities.every((u) => u.landId === plan.land.id)).toBe(true);
  });

  it('should leave the template untouched (deep-frozen input) [AC-12.3]', () => {
    const frozen = deepFreeze(templateFixture());
    const before = JSON.stringify(frozen);

    expect(() => build(frozen)).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it('should take land, utilities and land rows from step 2, never from the template [AC-12.7]', () => {
    const input = wizardInput();
    const plan = build(template, input);

    expect(plan.land).toMatchObject({
      address: 'Am Brunnenfeld 7',
      municipality: 'Regensburg',
      state: 'Bayern',
      areaM2: 600,
      landValuePerM2Cents: 30_000,
      lat: 0,
      lng: 0,
      cadastralRef: null,
      groundwaterDepthCm: 420,
    });
    expect(plan.land.zoningPlan).not.toBe(template.land?.zoningPlan);
    expect(plan.land.soilType).not.toBe(template.land?.soilType);
    expect(plan.utilities.map((u) => [u.type, u.status])).toEqual([
      ['WATER', 'AT_BOUNDARY'],
      ['POWER', 'IN_STREET'],
      ['TELECOM', 'NOT_AVAILABLE'],
    ]);
    // 600 m² × 300 € = 180,000 €; Bavaria 3.5 % = 6,300 €; notary 1.5 % = 2,700 €; registry 0.5 % = 900 €.
    expect(itemPlannedCents(byCode(plan, 'SRV-PUR-001') as never)).toBe(
      18_000_000,
    );
    expect(byCode(plan, 'SRV-ACQ-001').unitPriceCents).toBe(630_000);
    expect(byCode(plan, 'SRV-ACQ-001').name).toContain('Bayern 3.5 %');
    expect(byCode(plan, 'SRV-ACQ-002').unitPriceCents).toBe(270_000);
    expect(byCode(plan, 'SRV-ACQ-003').unitPriceCents).toBe(90_000);
  });

  it('should shift every date by (start − template start) and reset money and status [AC-12.7]', () => {
    const plan = build(template, wizardInput({ startDate: '2027-04-01' }));
    const shift = daysBetween(template.project.startDate, '2027-04-01');
    expect(shift).toBe(365);

    for (const t of template.items) {
      const n = byCode(plan, t.code);
      for (const field of ['startDate', 'endDate', 'deliveryDate'] as const) {
        if (t[field] === null) expect(n[field]).toBeNull();
        else
          expect(daysBetween(t[field] as string, n[field] as string)).toBe(
            shift,
          );
      }
      expect(n).toMatchObject({
        status: 'PLANNED',
        committedCents: 0,
        actualCents: 0,
        deliveredDate: null,
      });
    }
    expect(plan.project).toMatchObject({
      startDate: '2027-04-01',
      status: 'PLANNING',
      isTemplate: false,
      slug: OPTS.slug,
    });
  });

  it('should start with no overrun lines when no amounts are given [AC-12.8]', () => {
    const plan = build(template);

    expect(summary(plan).overrunLines).toEqual([]);
    const contingency = plan.budgetLines.find(
      (l) => l.section === 'contingency',
    );
    expect(contingency?.approvedCents).toBeGreaterThan(0);
  });

  it('should make Σ approved per category equal the user amounts exactly [AC-12.8]', () => {
    const amounts: Record<CostCategory, number> = {
      LAND: 21_000_001,
      ARCHITECTURE: 7_500_003,
      MATERIALS: 30_000_002,
      CONSTRUCTION: 26_000_000,
      MARKETING: 1_999_999,
    };
    const plan = build(template, wizardInput({ approvedByCategory: amounts }));

    for (const c of COST_CATEGORIES) {
      const lines = plan.budgetLines.filter((l) => l.category === c);
      expect(lines.reduce((s, l) => s + l.approvedCents, 0)).toBe(amounts[c]);
      expect(
        lines.every(
          (l) => Number.isInteger(l.approvedCents) && l.approvedCents >= 0,
        ),
      ).toBe(true);
    }
  });

  it('should keep the default line split when the user sends the default category sums [AC-12.8]', () => {
    const defaults = build(template);
    const sums = Object.fromEntries(
      COST_CATEGORIES.map((c) => [
        c,
        defaults.budgetLines
          .filter((l) => l.category === c)
          .reduce((s, l) => s + l.approvedCents, 0),
      ]),
    ) as Record<CostCategory, number>;

    const plan = build(template, wizardInput({ approvedByCategory: sums }));

    expect(plan.budgetLines.map((l) => l.approvedCents)).toEqual(
      defaults.budgetLines.map((l) => l.approvedCents),
    );
  });

  it('should keep the house inside the plot and store the house options as text', () => {
    const plan = build(
      template,
      wizardInput({
        house: {
          livingAreaM2: 250,
          storeys: 1,
          energyStandard: 'EH40',
          heating: 'GAS_HYBRID',
          wallType: 'MONOLITHIC_BRICK',
        },
      }),
    );
    const p = plan.plan;
    if (!p) throw new Error('no plan');

    expect(p.siteOffsetXcm + p.footprintWidthCm).toBeLessThanOrEqual(
      plan.land.plotWidthCm,
    );
    expect(p.siteOffsetYcm + p.footprintDepthCm).toBeLessThanOrEqual(
      plan.land.plotDepthCm,
    );
    expect(p.footprintWidthCm).toBeGreaterThan(
      template.plan?.footprintWidthCm ?? Infinity,
    );
    expect(p).toMatchObject({
      storeys: 1,
      energyStandard: 'KfW EH 40 / GEG 2024',
    });
    expect(p.heatingSystem).toContain('hybrid');
    expect(p.notes).toContain('Monolithic');
    expect(plan.rooms).toHaveLength(template.plan?.rooms.length ?? -1);
  });

  it('should reject amounts beyond the 32-bit range [AC-12.9]', () => {
    const input = wizardInput();
    const huge = wizardInput({
      land: { ...input.land, areaM2: 100_000, landValuePerM2Cents: 30_000 },
    });

    expect(() => build(template, huge)).toThrow(WizardRangeError);
    expect(() => build(template, input)).not.toThrow();
  });
});
