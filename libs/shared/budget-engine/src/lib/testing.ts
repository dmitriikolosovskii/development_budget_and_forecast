import type {
  BudgetLine,
  CostItem,
  Organization,
  Project,
  ProjectSnapshot,
} from '@default-project/types';

// Test factories shared by every block (CONTRACTS §6). Deterministic ids: `<prefix>-<n>`.
const TS = '2026-10-14T00:00:00.000Z';
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    slug: 'test-project',
    name: 'Test project',
    code: 'TP-2026-01',
    status: 'ACTIVE',
    isTemplate: false,
    clientName: 'Test client',
    city: 'Leipzig',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    markupBps: 1500,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function makeLine(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: nextId('line'),
    projectId: 'project-1',
    category: 'MATERIALS',
    section: 'electrical',
    name: 'Electrical',
    approvedCents: 0,
    sortOrder: 0,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function makeItem(overrides: Partial<CostItem> = {}): CostItem {
  const id = overrides.id ?? nextId('item');
  return {
    id,
    projectId: 'project-1',
    budgetLineId: 'line-1',
    kind: 'MATERIAL',
    code: `MAT-TST-${String(seq).padStart(3, '0')}`,
    name: `Item ${id}`,
    description: null,
    unit: 'pcs',
    qtyMilli: 1000,
    unitPriceCents: 0,
    committedCents: 0,
    actualCents: 0,
    status: 'PLANNED',
    supplierId: null,
    contractorId: null,
    deliveryDate: null,
    deliveredDate: null,
    startDate: null,
    endDate: null,
    requiredForWorkId: null,
    boqComponentId: null,
    sortOrder: 0,
    notes: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function makeOrg(overrides: Partial<Organization> = {}): Organization {
  const id = overrides.id ?? nextId('org');
  return {
    id,
    slug: id,
    name: 'Muster Elektro GmbH',
    role: 'CONTRACTOR',
    legalForm: 'GmbH',
    address: 'Hauptstraße 1',
    city: 'Leipzig',
    website: null,
    email: 'info@muster-elektro.example',
    phone: '+49 341 000000',
    contactPerson: 'Anna Schmidt',
    contactRole: 'Project manager',
    paymentTermsDays: 30,
    rating: 4,
    notes: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<ProjectSnapshot> = {},
): ProjectSnapshot {
  return {
    project: makeProject(),
    budgetLines: [],
    items: [],
    organizations: [],
    land: null,
    plan: null,
    deliveries: [],
    ...overrides,
  };
}
