import {
  daysBetween,
  itemPlannedCents,
  roundHalfUp,
  summarizeProject,
} from '@default-project/budget-engine';
import {
  COST_CATEGORIES,
  MAX_INT_FIELD,
  type CostCategory,
  type WizardInput,
} from '@default-project/types';
import type {
  ArchitecturePlan,
  BoqComponent,
  BudgetLine,
  CostItem,
  LandParcel,
  Prisma,
  Project,
  Room,
  UtilityConnection,
} from '@prisma/client';
import {
  scalePlan,
  scaleQty,
  shiftDate,
  type Factor,
} from '../seed-data/derive';
import type { PlanSeed, Unit } from '../seed-data/types';
import { distribute } from './distribute';
import { transferTaxBps } from './transfer-tax';

/** Living area of `template-efh-144`: the area factor is `livingAreaM2 / 144`. */
export const TEMPLATE_LIVING_AREA_M2 = 144;

type NoTs<T> = Omit<T, 'createdAt' | 'updatedAt'>;

/** The template as read from the database (or a seed fixture): timestamps are not used. */
export interface TemplateSource {
  project: Pick<Project, 'startDate' | 'endDate'>;
  budgetLines: NoTs<BudgetLine>[];
  items: NoTs<CostItem>[];
  land: (NoTs<LandParcel> & { utilities: UtilityConnection[] }) | null;
  plan:
    | (NoTs<ArchitecturePlan> & { rooms: Room[]; components: BoqComponent[] })
    | null;
}

export interface WizardPlanOptions {
  newId: () => string;
  slug: string;
  code: string;
}

/** Create-only payloads in FK write order; `linkedItems` reference rows of `items`. */
export interface WizardPlan {
  project: Prisma.ProjectCreateManyInput & { id: string };
  budgetLines: Prisma.BudgetLineCreateManyInput[];
  land: Prisma.LandParcelCreateManyInput;
  utilities: Prisma.UtilityConnectionCreateManyInput[];
  plan: Prisma.ArchitecturePlanCreateManyInput | null;
  rooms: Prisma.RoomCreateManyInput[];
  components: Prisma.BoqComponentCreateManyInput[];
  items: Prisma.CostItemCreateManyInput[];
  linkedItems: Prisma.CostItemCreateManyInput[];
}

/** Thrown when an amount would not fit the 32-bit Int columns (CONTRACTS §1); the API answers 400. */
export class WizardRangeError extends Error {}

const SCALED_CATEGORIES: ReadonlySet<CostCategory> = new Set<CostCategory>([
  'MATERIALS',
  'CONSTRUCTION',
]);
const NOTARY_BPS = 150;
const LAND_REGISTRY_BPS = 50;
const TO_BE_CONFIRMED = 'To be confirmed';

const ENERGY_LABEL: Record<WizardInput['house']['energyStandard'], string> = {
  EH55: 'KfW EH 55 / GEG 2024',
  EH40: 'KfW EH 40 / GEG 2024',
};
const HEATING_LABEL: Record<WizardInput['house']['heating'], string> = {
  HEAT_PUMP: 'Air-source heat pump + underfloor heating',
  GAS_HYBRID: 'Gas condensing boiler + heat pump (hybrid) + underfloor heating',
};
const WALL_LABEL: Record<WizardInput['house']['wallType'], string> = {
  SAND_LIME_ETICS: 'Sand-lime brick + ETICS',
  MONOLITHIC_BRICK: 'Monolithic insulated brick',
};

const scale = (value: number, f: Factor) =>
  roundHalfUp(BigInt(value) * BigInt(f.num), BigInt(f.den));
const percentOf = (cents: number, bps: number) =>
  roundHalfUp(BigInt(cents) * BigInt(bps), BigInt(10_000));
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.max(lo, hi));

export function areaFactor(livingAreaM2: number): Factor {
  return { num: livingAreaM2, den: TEMPLATE_LIVING_AREA_M2 };
}

/** Quantity and price of a template row in the new project (03's derive rules; land rows from step 2). */
function scaledRow(
  item: NoTs<CostItem>,
  category: CostCategory,
  section: string,
  f: Factor,
  land: WizardInput['land'],
): Pick<CostItem, 'name' | 'description' | 'qtyMilli' | 'unitPriceCents'> {
  const row = {
    name: item.name,
    description: item.description,
    qtyMilli: item.qtyMilli,
    unitPriceCents: item.unitPriceCents,
  };
  if (SCALED_CATEGORIES.has(category))
    return { ...row, qtyMilli: scaleQty(item.qtyMilli, item.unit as Unit, f) };
  // HOAI fees follow the eligible construction cost.
  if (category === 'ARCHITECTURE' && section === 'design')
    return { ...row, unitPriceCents: scale(item.unitPriceCents, f) };
  if (category !== 'LAND') return row;

  const purchase = land.areaM2 * land.landValuePerM2Cents;
  switch (item.code) {
    case 'SRV-PUR-001':
      return {
        name: `Plot ${land.areaM2} m², ${land.municipality}`,
        description: `Land value ${land.landValuePerM2Cents / 100} €/m²`,
        qtyMilli: land.areaM2 * 1000,
        unitPriceCents: land.landValuePerM2Cents,
      };
    case 'SRV-ACQ-001': {
      const tax = transferTaxBps(land.state);
      const pct = `${(tax.bps / 100).toFixed(1)} %${tax.estimated ? ' (est.)' : ''}`;
      return {
        ...row,
        name: `Real estate transfer tax (Grunderwerbsteuer ${land.state} ${pct})`,
        qtyMilli: 1000,
        unitPriceCents: percentOf(purchase, tax.bps),
      };
    }
    case 'SRV-ACQ-002':
      return {
        ...row,
        qtyMilli: 1000,
        unitPriceCents: percentOf(purchase, NOTARY_BPS),
      };
    case 'SRV-ACQ-003':
      return {
        ...row,
        qtyMilli: 1000,
        unitPriceCents: percentOf(purchase, LAND_REGISTRY_BPS),
      };
    default:
      return row;
  }
}

/**
 * Default approved amount per line (the weights of the category split):
 * LAND = new planned; MATERIALS/CONSTRUCTION/design = max(template approved × f, planned); others max(approved, planned).
 * The contingency line has no rows, so it keeps template approved × f. A fresh project therefore has no overruns.
 */
function defaultApproved(
  line: NoTs<BudgetLine>,
  planned: number,
  f: Factor,
): number {
  if (line.category === 'LAND') return planned;
  const scaled =
    SCALED_CATEGORIES.has(line.category) ||
    (line.category === 'ARCHITECTURE' && line.section === 'design');
  return Math.max(
    scaled ? scale(line.approvedCents, f) : line.approvedCents,
    planned,
  );
}

function assertInRange(label: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_INT_FIELD)
    throw new WizardRangeError(
      `${label} is outside the supported range (0 … ${MAX_INT_FIELD.toLocaleString('en-US')})`,
    );
}

/**
 * Pure: builds every row of a new project from the template and the wizard input. New ids come from `newId`,
 * every link (line, BOQ component, required work, plan, land) points to the new rows, and the template is only read.
 */
export function buildWizardProject(
  template: TemplateSource,
  input: WizardInput,
  opts: WizardPlanOptions,
): WizardPlan {
  if (!template.land || !template.plan)
    throw new Error('Template has no land parcel or architecture plan');
  const f = areaFactor(input.house.livingAreaM2);
  const shiftDays = daysBetween(template.project.startDate, input.startDate);
  const projectId = opts.newId();

  // Lines and rows.
  const lineIds = new Map(
    template.budgetLines.map((l) => [l.id, opts.newId()] as const),
  );
  const itemIds = new Map(
    template.items.map((i) => [i.id, opts.newId()] as const),
  );
  const componentIds = new Map(
    template.plan.components.map((c) => [c.id, opts.newId()] as const),
  );
  const linesById = new Map(
    template.budgetLines.map((l) => [l.id, l] as const),
  );

  const allItems = template.items.map((i): Prisma.CostItemCreateManyInput => {
    const line = linesById.get(i.budgetLineId);
    if (!line) throw new Error(`Template row ${i.code} has no budget line`);
    const target =
      i.requiredForWorkId === null ? null : itemIds.get(i.requiredForWorkId);
    if (target === undefined)
      throw new Error(`Template row ${i.code} links outside the template`);
    const boq =
      i.boqComponentId === null ? null : componentIds.get(i.boqComponentId);
    if (boq === undefined)
      throw new Error(
        `Template row ${i.code} links to an unknown BOQ component`,
      );
    return {
      ...scaledRow(i, line.category, line.section, f, input.land),
      id: itemIds.get(i.id) as string,
      projectId,
      budgetLineId: lineIds.get(i.budgetLineId) as string,
      kind: i.kind,
      code: i.code,
      unit: i.unit,
      committedCents: 0,
      actualCents: 0,
      status: 'PLANNED',
      supplierId: i.supplierId,
      contractorId: i.contractorId,
      deliveryDate: shiftDate(i.deliveryDate, shiftDays),
      deliveredDate: null,
      startDate: shiftDate(i.startDate, shiftDays),
      endDate: shiftDate(i.endDate, shiftDays),
      requiredForWorkId: target,
      boqComponentId: boq,
      sortOrder: i.sortOrder,
      notes: i.notes,
    };
  });

  const plannedByLine = new Map<string, number>();
  for (const i of allItems) {
    const planned = itemPlannedCents({
      qtyMilli: i.qtyMilli,
      unitPriceCents: i.unitPriceCents,
    });
    assertInRange(`Row ${i.code}`, planned);
    plannedByLine.set(
      i.budgetLineId,
      (plannedByLine.get(i.budgetLineId) ?? 0) + planned,
    );
  }

  const budgetLines = template.budgetLines.map(
    (l): Prisma.BudgetLineCreateManyInput => {
      const id = lineIds.get(l.id) as string;
      return {
        id,
        projectId,
        category: l.category,
        section: l.section,
        name: l.name,
        sortOrder: l.sortOrder,
        approvedCents: defaultApproved(l, plannedByLine.get(id) ?? 0, f),
      };
    },
  );
  if (input.approvedByCategory) {
    for (const category of COST_CATEGORIES) {
      const lines = budgetLines.filter((l) => l.category === category);
      const total = input.approvedByCategory[category] ?? 0;
      distribute(
        total,
        lines.map((l) => l.approvedCents),
      ).forEach((cents, k) => (lines[k].approvedCents = cents));
    }
  }
  for (const l of budgetLines)
    assertInRange(`Approved ${l.section}`, l.approvedCents);

  const summary = summarizeProject({
    budgetLines: budgetLines.map((l) => ({
      ...l,
      id: l.id as string,
      approvedCents: l.approvedCents,
    })),
    items: allItems.map((i) => ({
      ...i,
      id: i.id as string,
      committedCents: 0,
      actualCents: 0,
      status: 'PLANNED' as const,
    })),
  } as Parameters<typeof summarizeProject>[0]).project;
  assertInRange('Project budget', summary.approved);
  assertInRange('Project planned cost', summary.planned);

  // Land: only step 2; plot sides follow the area, location unknown (07 hides the map link at 0/0).
  const t = template;
  const landId = opts.newId();
  const side = Math.sqrt(input.land.areaM2 / Math.max(t.land.areaM2, 1));
  const plotWidthCm = Math.round(t.land.plotWidthCm * side);
  const plotDepthCm = Math.round(t.land.plotDepthCm * side);
  const land: Prisma.LandParcelCreateManyInput = {
    id: landId,
    projectId,
    address: input.land.address,
    postalCode: input.land.postalCode,
    municipality: input.land.municipality,
    district: null,
    state: input.land.state,
    cadastralRef: null,
    lat: 0,
    lng: 0,
    areaM2: input.land.areaM2,
    plotWidthCm,
    plotDepthCm,
    landValuePerM2Cents: input.land.landValuePerM2Cents,
    zoningPlan: TO_BE_CONFIRMED,
    grzBps: input.land.grzBps,
    gfzBps: input.land.gfzBps,
    maxStoreys: input.land.maxStoreys,
    roofRules: TO_BE_CONFIRMED,
    buildingLineNotes: null,
    soilType: `${TO_BE_CONFIRMED} (soil report)`,
    soilClass: input.land.soilClass,
    bearingCapacityKnM2: null,
    groundwaterDepthCm: input.land.groundwaterDepthCm ?? null,
    contaminationNotes: null,
    slopeNotes: null,
    orientation: null,
    notes: null,
  };
  const utilities = input.land.utilities.map(
    (u): Prisma.UtilityConnectionCreateManyInput => ({
      id: opts.newId(),
      landId,
      type: u.type,
      status: u.status,
      distanceM: null,
      provider: null,
      notes: null,
    }),
  );

  // Plan: rooms and footprint × √f (03's edge scaling); house options are descriptive only.
  const planId = opts.newId();
  const scaled = scalePlan(
    t.plan as unknown as PlanSeed,
    f,
  ) as unknown as typeof t.plan;
  const plan: Prisma.ArchitecturePlanCreateManyInput = {
    id: planId,
    projectId,
    name: `EFH '${input.name}' — ${input.house.livingAreaM2} m²`,
    architectOrgId: t.plan.architectOrgId,
    style: t.plan.style,
    storeys: input.house.storeys,
    roofType: t.plan.roofType,
    roofPitchDeg: t.plan.roofPitchDeg,
    energyStandard: ENERGY_LABEL[input.house.energyStandard],
    heatingSystem: HEATING_LABEL[input.house.heating],
    occupants: t.plan.occupants,
    footprintWidthCm: scaled.footprintWidthCm,
    footprintDepthCm: scaled.footprintDepthCm,
    siteOffsetXcm: clamp(
      t.plan.siteOffsetXcm,
      0,
      plotWidthCm - scaled.footprintWidthCm,
    ),
    siteOffsetYcm: clamp(
      t.plan.siteOffsetYcm,
      0,
      plotDepthCm - scaled.footprintDepthCm,
    ),
    notes: `Walls: ${WALL_LABEL[input.house.wallType]}. Calculated with the wizard from the 144 m² template; house options are descriptive (cost scales with living area).`,
  };
  const rooms = scaled.rooms.map(
    (r): Prisma.RoomCreateManyInput => ({
      id: opts.newId(),
      planId,
      code: r.code,
      floor: r.floor,
      name: r.name,
      kind: r.kind,
      xCm: r.xCm,
      yCm: r.yCm,
      wCm: r.wCm,
      hCm: r.hCm,
      sortOrder: r.sortOrder,
    }),
  );
  const components = t.plan.components.map(
    (c): Prisma.BoqComponentCreateManyInput => ({
      id: componentIds.get(c.id) as string,
      planId,
      code: c.code,
      houseSection: c.houseSection,
      name: c.name,
      unit: c.unit,
      qtyMilli: scaleQty(c.qtyMilli, c.unit as Unit, f),
      materialSection: c.materialSection,
      notes: c.notes,
      sortOrder: c.sortOrder,
    }),
  );

  const linkedIds = new Set(
    allItems.filter((i) => i.requiredForWorkId).map((i) => i.id),
  );
  if (
    allItems.some(
      (i) => i.requiredForWorkId && linkedIds.has(i.requiredForWorkId),
    )
  )
    throw new Error(
      'Template has chained requiredForWork links (only MATERIAL → WORK is supported)',
    );

  return {
    project: {
      id: projectId,
      slug: opts.slug,
      name: input.name,
      code: opts.code,
      status: 'PLANNING',
      isTemplate: false,
      clientName: input.clientName,
      city: input.city,
      startDate: input.startDate,
      endDate: shiftDate(t.project.endDate, shiftDays) as string,
      markupBps: input.markupBps,
    },
    budgetLines,
    land,
    utilities,
    plan,
    rooms,
    components,
    items: allItems.filter((i) => !i.requiredForWorkId),
    linkedItems: allItems.filter((i) => i.requiredForWorkId),
  };
}
