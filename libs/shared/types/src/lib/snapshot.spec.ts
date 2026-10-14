import {
  createCostItemInputSchema,
  updateCostItemInputSchema,
} from './cost-item';
import { projectSnapshotSchema } from './snapshot';

describe('projectSnapshotSchema', () => {
  it('should accept an empty snapshot whose ids are uuids from a deep copy', () => {
    const now = '2026-10-14T10:00:00.000Z';
    const snapshot = {
      project: {
        id: '7f1c0c8e-5d0a-4a43-9b8e-1f6a8a1c2d3e',
        slug: 'p-copy-1',
        name: 'P',
        code: 'KF-1',
        status: 'PLANNING',
        isTemplate: false,
        clientName: 'C',
        city: 'Leipzig',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        markupBps: 1500,
        createdAt: now,
        updatedAt: now,
      },
      budgetLines: [],
      items: [],
      organizations: [],
      land: null,
      plan: null,
      deliveries: [],
    };
    expect(projectSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });
});

describe('cost item inputs', () => {
  it('should accept null to clear a nullable field when patching', () => {
    expect(updateCostItemInputSchema.parse({ deliveryDate: null })).toEqual({
      deliveryDate: null,
    });
  });

  it('should reject a code that does not follow <KIND>-<PREFIX>-NNN', () => {
    const base = {
      budgetLineId: 'l1',
      kind: 'MATERIAL',
      name: 'Cable',
      unit: 'm',
      qtyMilli: 1000,
      unitPriceCents: 100,
    };
    expect(
      createCostItemInputSchema.safeParse({ ...base, code: 'MAT-ELE-003' })
        .success,
    ).toBe(true);
    expect(
      createCostItemInputSchema.safeParse({ ...base, code: 'cable-1' }).success,
    ).toBe(false);
  });
});
