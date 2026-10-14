import {
  makeItem,
  makeLine,
  makeOrg,
  makeSnapshot,
} from '@default-project/budget-engine';
import type { CostItem, ProjectSnapshot } from '@default-project/types';

/** Test-only fixture (GERMANY-DATA §7 dates, today 2026-10-14). Never imported by the page. */
export const PID = 'project-1';
export const TODAY = '2026-10-14';

export const LINE = {
  windowsInstall: 'l-win-inst',
  heatingInstall: 'l-hea-inst',
  shell: 'l-shell',
  contingency: 'l-ctg',
  windowsDoors: 'l-mat-win',
  heating: 'l-mat-hea',
  concrete: 'l-mat-con',
  electrical: 'l-mat-ele',
} as const;

export function constructionSnapshot(
  overrides: { items?: (items: CostItem[]) => CostItem[] } = {},
): ProjectSnapshot {
  const contractor = makeOrg({
    id: 'org-fenster',
    name: 'Fensterbau Leipzig GmbH',
    role: 'CONTRACTOR',
  });
  const budgetLines = [
    makeLine({
      id: LINE.shell,
      category: 'CONSTRUCTION',
      section: 'shell',
      name: 'Shell construction',
      approvedCents: 5_000_000,
      sortOrder: 30,
    }),
    makeLine({
      id: LINE.windowsInstall,
      category: 'CONSTRUCTION',
      section: 'windows-install',
      name: 'Window, door & stair installation',
      approvedCents: 800_000,
      sortOrder: 50,
    }),
    makeLine({
      id: LINE.heatingInstall,
      category: 'CONSTRUCTION',
      section: 'heating-install',
      name: 'Heating & ventilation installation',
      approvedCents: 900_000,
      sortOrder: 80,
    }),
    makeLine({
      id: LINE.contingency,
      category: 'CONSTRUCTION',
      section: 'contingency',
      name: 'Contingency reserve',
      approvedCents: 2_000_000,
      sortOrder: 150,
    }),
    makeLine({
      id: LINE.windowsDoors,
      category: 'MATERIALS',
      section: 'windows-doors',
      name: 'Windows, doors & stairs',
      approvedCents: 3_000_000,
      sortOrder: 40,
    }),
    makeLine({
      id: LINE.heating,
      category: 'MATERIALS',
      section: 'heating',
      name: 'Heating & ventilation',
      approvedCents: 3_000_000,
      sortOrder: 80,
    }),
    // Over budget by 100.00 € and 250.00 € (AC-05.6).
    makeLine({
      id: LINE.concrete,
      category: 'MATERIALS',
      section: 'concrete',
      name: 'Concrete & reinforcement',
      approvedCents: 90_000,
      sortOrder: 10,
    }),
    makeLine({
      id: LINE.electrical,
      category: 'MATERIALS',
      section: 'electrical',
      name: 'Electrical',
      approvedCents: 75_000,
      sortOrder: 60,
    }),
  ];
  const base: CostItem[] = [
    makeItem({
      id: 'w-shell',
      budgetLineId: LINE.shell,
      kind: 'WORK',
      code: 'WRK-SHL-001',
      name: 'Shell walls',
      unit: 'm2',
      qtyMilli: 100_000,
      unitPriceCents: 5_000,
      status: 'DONE',
      startDate: '2026-06-29',
      endDate: '2026-08-28',
    }),
    makeItem({
      id: 'w-win',
      budgetLineId: LINE.windowsInstall,
      kind: 'WORK',
      code: 'WRK-WIN-001',
      name: 'Window installation',
      unit: 'h',
      qtyMilli: 80_000,
      unitPriceCents: 6_500,
      status: 'CONTRACTED',
      contractorId: contractor.id,
      startDate: '2026-10-19',
      endDate: '2026-10-30',
    }),
    makeItem({
      id: 'w-hea',
      budgetLineId: LINE.heatingInstall,
      kind: 'WORK',
      code: 'WRK-HEA-001',
      name: 'Heating installation',
      unit: 'h',
      qtyMilli: 120_000,
      unitPriceCents: 7_000,
      status: 'CONTRACTED',
      startDate: '2026-11-02',
      endDate: '2026-11-27',
    }),
    makeItem({
      id: 'm-win',
      budgetLineId: LINE.windowsDoors,
      kind: 'MATERIAL',
      code: 'MAT-WIN-001',
      name: 'Windows',
      unit: 'pcs',
      qtyMilli: 14_000,
      unitPriceCents: 90_000,
      deliveryDate: '2026-10-28',
      requiredForWorkId: 'w-win',
    }),
    makeItem({
      id: 'm-door',
      budgetLineId: LINE.windowsDoors,
      kind: 'MATERIAL',
      code: 'MAT-WIN-002',
      name: 'Front door',
      unit: 'pcs',
      qtyMilli: 1_000,
      unitPriceCents: 300_000,
      deliveryDate: '2026-10-16',
      requiredForWorkId: 'w-win',
    }),
    makeItem({
      id: 'm-hp',
      budgetLineId: LINE.heating,
      kind: 'MATERIAL',
      code: 'MAT-HEA-001',
      name: 'Heat pump',
      unit: 'pcs',
      qtyMilli: 1_000,
      unitPriceCents: 1_400_000,
      deliveryDate: '2026-11-20',
      requiredForWorkId: 'w-hea',
    }),
    makeItem({
      id: 'm-con',
      budgetLineId: LINE.concrete,
      kind: 'MATERIAL',
      code: 'MAT-CON-001',
      name: 'Ready-mix concrete C25/30',
      unit: 'm3',
      qtyMilli: 1_000,
      unitPriceCents: 100_000,
      deliveredDate: '2026-06-15',
      deliveryDate: '2026-06-15',
    }),
    makeItem({
      id: 'm-ele',
      budgetLineId: LINE.electrical,
      kind: 'MATERIAL',
      code: 'MAT-ELE-001',
      name: 'NYM-J 3×1.5 mm² cable',
      unit: 'm',
      qtyMilli: 1_000,
      unitPriceCents: 100_000,
    }),
  ];
  return makeSnapshot({
    budgetLines,
    items: overrides.items ? overrides.items(base) : base,
    organizations: [contractor],
  });
}

/** Replaces fields of one item in a list (fixture variants). */
export const patchItem =
  (id: string, patch: Partial<CostItem>) =>
  (items: CostItem[]): CostItem[] =>
    items.map((i) => (i.id === id ? { ...i, ...patch } : i));
