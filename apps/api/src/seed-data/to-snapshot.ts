import type { Organization, ProjectSnapshot } from '@default-project/types';
import type { OrganizationSeed, ProjectSeed } from './types';

const TS = '2026-10-14T00:00:00.000Z';

export const lineId = (category: string, section: string) => `line:${category}/${section}`;

/**
 * Maps a seed onto the contract snapshot with synthetic ids (item id = code, org id = slug, …),
 * so the engine (`summarizeProject`, `checkSchedule`) can check the seed without a database.
 */
export function toSnapshot(seed: ProjectSeed, organizations: OrganizationSeed[]): ProjectSnapshot {
  const projectId = seed.project.slug;
  const itemCodes = new Set(seed.items.map((i) => i.code));
  const ref = (code: string | null, known: Set<string>, prefix = '') => {
    if (code === null) return null;
    if (!known.has(code)) throw new Error(`${seed.project.slug}: unknown reference ${code}`);
    return prefix + code;
  };
  const orgSlugs = new Set(organizations.map((o) => o.slug));
  const boqCodes = new Set(seed.plan?.components.map((c) => c.code) ?? []);
  const lineKeys = new Set(seed.budgetLines.map((l) => lineId(l.category, l.section)));

  const items = seed.items.map((i) => {
    const budgetLineId = lineId(i.category, i.section);
    if (!lineKeys.has(budgetLineId)) throw new Error(`${i.code}: no line ${budgetLineId}`);
    return {
      id: i.code,
      projectId,
      budgetLineId,
      kind: i.kind,
      code: i.code,
      name: i.name,
      description: i.description,
      unit: i.unit,
      qtyMilli: i.qtyMilli,
      unitPriceCents: i.unitPriceCents,
      committedCents: i.committedCents,
      actualCents: i.actualCents,
      status: i.status,
      supplierId: ref(i.supplierSlug, orgSlugs),
      contractorId: ref(i.contractorSlug, orgSlugs),
      deliveryDate: i.deliveryDate,
      deliveredDate: i.deliveredDate,
      startDate: i.startDate,
      endDate: i.endDate,
      requiredForWorkId: ref(i.requiredForWorkCode, itemCodes),
      boqComponentId: ref(i.boqCode, boqCodes, 'boq:'),
      sortOrder: i.sortOrder,
      notes: i.notes,
      createdAt: TS,
      updatedAt: TS,
    };
  });

  const referenced = new Set(
    [...seed.items.flatMap((i) => [i.supplierSlug, i.contractorSlug]), seed.plan?.architectOrgSlug ?? null].filter(
      (s): s is string => s !== null,
    ),
  );
  const toOrg = (o: OrganizationSeed): Organization => ({ id: o.slug, ...o, createdAt: TS, updatedAt: TS });

  const landId = `land:${projectId}`;
  const planId = `plan:${projectId}`;
  return {
    project: { id: projectId, ...seed.project, createdAt: TS, updatedAt: TS },
    budgetLines: seed.budgetLines.map((l) => ({
      id: lineId(l.category, l.section),
      projectId,
      ...l,
      createdAt: TS,
      updatedAt: TS,
    })),
    items,
    organizations: organizations.filter((o) => referenced.has(o.slug)).map(toOrg),
    land: seed.land
      ? {
          id: landId,
          projectId,
          ...seed.land,
          createdAt: TS,
          updatedAt: TS,
          utilities: seed.land.utilities.map((u) => ({ id: `${landId}:${u.type}`, landId, ...u })),
        }
      : null,
    plan: seed.plan
      ? {
          id: planId,
          projectId,
          name: seed.plan.name,
          architectOrgId: ref(seed.plan.architectOrgSlug, orgSlugs),
          style: seed.plan.style,
          storeys: seed.plan.storeys,
          roofType: seed.plan.roofType,
          roofPitchDeg: seed.plan.roofPitchDeg,
          energyStandard: seed.plan.energyStandard,
          heatingSystem: seed.plan.heatingSystem,
          occupants: seed.plan.occupants,
          footprintWidthCm: seed.plan.footprintWidthCm,
          footprintDepthCm: seed.plan.footprintDepthCm,
          siteOffsetXcm: seed.plan.siteOffsetXcm,
          siteOffsetYcm: seed.plan.siteOffsetYcm,
          notes: seed.plan.notes,
          createdAt: TS,
          updatedAt: TS,
          rooms: seed.plan.rooms.map((r) => ({ id: `room:${r.code}`, planId, ...r })),
          components: seed.plan.components.map((c) => ({ id: `boq:${c.code}`, planId, ...c })),
        }
      : null,
    deliveries: seed.deliveries.map((d) => ({
      id: `dlv:${d.itemCode}:${d.deliveryNoteNo}`,
      projectId,
      costItemId: ref(d.itemCode, itemCodes) as string,
      batchId: null,
      deliveryNoteNo: d.deliveryNoteNo,
      kind: d.kind,
      date: d.date,
      qtyMilli: d.qtyMilli,
      invoiceCents: d.invoiceCents,
      createdAt: TS,
    })),
  };
}
