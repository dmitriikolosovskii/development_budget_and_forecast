import type { Prisma, PrismaClient } from '@prisma/client';
import { buildOrganizations } from './organizations';
import { buildAllProjectSeeds } from './projects';
import type { CostItemSeed, OrganizationSeed, ProjectSeed } from './types';

/**
 * Idempotent seed writer: every write is an `upsert` on a unique key (slug, code, composite keys), in dependency order.
 * Running it again restores seeded rows to their seed values; it never deletes rows (user-added rows stay).
 */

type Tx = Prisma.TransactionClient;

export interface SeedStats {
  slug: string;
  lines: number;
  items: number;
  rooms: number;
  components: number;
  utilities: number;
  deliveries: number;
}

const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

export async function upsertOrganizations(db: Tx, orgs: OrganizationSeed[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const { slug, ...data } of orgs) {
    const row = await db.organization.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    ids.set(slug, row.id);
  }
  return ids;
}

export async function writeProjectSeed(db: Tx, seed: ProjectSeed, orgIds: Map<string, string>): Promise<SeedStats> {
  const org = (slug: string | null) => {
    if (slug === null) return null;
    const id = orgIds.get(slug);
    if (!id) throw new Error(`${seed.project.slug}: unknown organisation ${slug}`);
    return id;
  };

  const { slug, ...projectData } = seed.project;
  const project = await db.project.upsert({ where: { slug }, create: seed.project, update: projectData });
  const projectId = project.id;

  const lineIds = new Map<string, string>();
  for (const l of seed.budgetLines) {
    const row = await db.budgetLine.upsert({
      where: { projectId_category_section: { projectId, category: l.category, section: l.section } },
      create: { projectId, ...l },
      update: { name: l.name, approvedCents: l.approvedCents, sortOrder: l.sortOrder },
    });
    lineIds.set(`${l.category}/${l.section}`, row.id);
  }

  let utilities = 0;
  if (seed.land) {
    const { utilities: utilitySeeds, ...landData } = seed.land;
    const land = await db.landParcel.upsert({ where: { projectId }, create: { projectId, ...landData }, update: landData });
    for (const { type, ...u } of utilitySeeds) {
      await db.utilityConnection.upsert({
        where: { landId_type: { landId: land.id, type } },
        create: { landId: land.id, type, ...u },
        update: u,
      });
      utilities += 1;
    }
  }

  const boqIds = new Map<string, string>();
  if (seed.plan) {
    const { rooms, components, architectOrgSlug, ...planData } = seed.plan;
    const data = { ...planData, architectOrgId: org(architectOrgSlug) };
    const plan = await db.architecturePlan.upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
    for (const { code, ...r } of rooms) {
      await db.room.upsert({ where: { planId_code: { planId: plan.id, code } }, create: { planId: plan.id, code, ...r }, update: r });
    }
    for (const { code, ...c } of components) {
      const row = await db.boqComponent.upsert({
        where: { planId_code: { planId: plan.id, code } },
        create: { planId: plan.id, code, ...c },
        update: c,
      });
      boqIds.set(code, row.id);
    }
  }

  // Works and services first: materials point at them through requiredForWorkId.
  const itemIds = new Map<string, string>();
  const ordered = [...seed.items.filter((i) => i.kind !== 'MATERIAL'), ...seed.items.filter((i) => i.kind === 'MATERIAL')];
  for (const item of ordered) {
    const data = itemData(item, {
      budgetLineId: lineIds.get(`${item.category}/${item.section}`),
      supplierId: org(item.supplierSlug),
      contractorId: org(item.contractorSlug),
      requiredForWorkId: item.requiredForWorkCode ? itemIds.get(item.requiredForWorkCode) : null,
      boqComponentId: item.boqCode ? boqIds.get(item.boqCode) : null,
    });
    const row = await db.costItem.upsert({
      where: { projectId_code: { projectId, code: item.code } },
      create: { projectId, code: item.code, ...data },
      update: data,
    });
    itemIds.set(item.code, row.id);
  }

  for (const d of seed.deliveries) {
    const costItemId = itemIds.get(d.itemCode);
    if (!costItemId) throw new Error(`${seed.project.slug}: delivery for unknown item ${d.itemCode}`);
    const data = { kind: d.kind, date: d.date, qtyMilli: d.qtyMilli, invoiceCents: d.invoiceCents };
    await db.delivery.upsert({
      where: { costItemId_deliveryNoteNo: { costItemId, deliveryNoteNo: d.deliveryNoteNo } },
      create: { projectId, costItemId, deliveryNoteNo: d.deliveryNoteNo, ...data },
      update: data,
    });
  }

  return {
    slug,
    lines: seed.budgetLines.length,
    items: seed.items.length,
    rooms: seed.plan?.rooms.length ?? 0,
    components: seed.plan?.components.length ?? 0,
    utilities,
    deliveries: seed.deliveries.length,
  };
}

function itemData(
  i: CostItemSeed,
  refs: {
    budgetLineId: string | undefined;
    supplierId: string | null;
    contractorId: string | null;
    requiredForWorkId: string | null | undefined;
    boqComponentId: string | null | undefined;
  },
) {
  if (!refs.budgetLineId) throw new Error(`${i.code}: no budget line ${i.category}/${i.section}`);
  if (refs.requiredForWorkId === undefined) throw new Error(`${i.code}: unknown work ${i.requiredForWorkCode}`);
  if (refs.boqComponentId === undefined) throw new Error(`${i.code}: unknown BOQ component ${i.boqCode}`);
  return {
    budgetLineId: refs.budgetLineId,
    kind: i.kind,
    name: i.name,
    description: i.description,
    unit: i.unit,
    qtyMilli: i.qtyMilli,
    unitPriceCents: i.unitPriceCents,
    committedCents: i.committedCents,
    actualCents: i.actualCents,
    status: i.status,
    supplierId: refs.supplierId,
    contractorId: refs.contractorId,
    deliveryDate: i.deliveryDate,
    deliveredDate: i.deliveredDate,
    startDate: i.startDate,
    endDate: i.endDate,
    requiredForWorkId: refs.requiredForWorkId,
    boqComponentId: refs.boqComponentId,
    sortOrder: i.sortOrder,
    notes: i.notes,
  };
}

/** `npx prisma db seed`: organisations, then one transaction per project. */
export async function runSeed(prisma: PrismaClient): Promise<SeedStats[]> {
  const orgIds = await prisma.$transaction((tx) => upsertOrganizations(tx, buildOrganizations()), TX_OPTIONS);
  const stats: SeedStats[] = [];
  for (const seed of buildAllProjectSeeds()) {
    stats.push(await prisma.$transaction((tx) => writeProjectSeed(tx, seed, orgIds), TX_OPTIONS));
  }
  return stats;
}
