import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';

export interface CopyOverrides {
  name?: string;
  /** default: `<source slug>-copy-<n>`, first free n */
  slug?: string;
  isTemplate?: boolean;
  status?: Prisma.ProjectCreateInput['status'];
  clientName?: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  markupBps?: number;
}

const SLUG_RETRIES = 3;

/** A shallow copy without `keys` (timestamps are regenerated, nested relations are created separately). */
function omit<T extends object, K extends keyof T>(
  row: T,
  ...keys: K[]
): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function remap(map: Map<string, string>, id: string | null): string | null {
  return id === null ? null : (map.get(id) ?? null);
}

/**
 * Deep copy of a project (CONTRACTS §5 `POST /projects/:id/duplicate`; reused by the wizard, block 12).
 * New ids are generated up front so every link (requiredForWorkId, boqComponentId, batchId) is remapped
 * to the copy's rows. Organisations are shared, not copied. The source is only read.
 */
@Injectable()
export class ProjectCopyService {
  private readonly logger = new Logger(ProjectCopyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs `deepCopy` in its own transaction; retries a slug collision, then 409. Returns the new project id. */
  async duplicate(
    sourceId: string,
    overrides: CopyOverrides = {},
  ): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction((tx) =>
          this.deepCopy(tx, sourceId, overrides),
        );
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        if (attempt >= SLUG_RETRIES || overrides.slug)
          throw new ConflictException(
            'Could not allocate a unique slug for the copy',
          );
        this.logger.warn(
          `Slug collision while copying ${sourceId}, retry ${attempt}`,
        );
      }
    }
  }

  /** Copies `sourceId` inside the caller's transaction and returns the new project id. */
  async deepCopy(
    tx: Prisma.TransactionClient,
    sourceId: string,
    overrides: CopyOverrides = {},
  ): Promise<string> {
    const src = await tx.project.findUnique({
      where: { id: sourceId },
      include: {
        budgetLines: true,
        items: true,
        land: { include: { utilities: true } },
        plan: { include: { rooms: true, components: true } },
        importBatches: true,
        deliveries: true,
      },
    });
    if (!src) throw new NotFoundException(`Project ${sourceId} not found`);

    const projectId = randomUUID();
    const ids = (rows: Array<{ id: string }>) =>
      new Map(rows.map((r) => [r.id, randomUUID()] as const));
    const lineIds = ids(src.budgetLines);
    const itemIds = ids(src.items);
    const componentIds = ids(src.plan?.components ?? []);
    const batchIds = ids(src.importBatches);

    await tx.project.create({
      data: {
        id: projectId,
        slug: overrides.slug ?? (await this.nextCopySlug(tx, src.slug)),
        name: overrides.name ?? `${src.name} (copy)`,
        code: src.code,
        status: overrides.status ?? src.status,
        isTemplate: overrides.isTemplate ?? false,
        clientName: overrides.clientName ?? src.clientName,
        city: overrides.city ?? src.city,
        startDate: overrides.startDate ?? src.startDate,
        endDate: overrides.endDate ?? src.endDate,
        markupBps: overrides.markupBps ?? src.markupBps,
      },
    });

    if (src.budgetLines.length) {
      await tx.budgetLine.createMany({
        data: src.budgetLines.map((line) => ({
          ...omit(line, 'createdAt', 'updatedAt'),
          id: lineIds.get(line.id) as string,
          projectId,
        })),
      });
    }

    if (src.land) {
      const landId = randomUUID();
      await tx.landParcel.create({
        data: {
          ...omit(src.land, 'utilities', 'createdAt', 'updatedAt'),
          id: landId,
          projectId,
        },
      });
      if (src.land.utilities.length) {
        await tx.utilityConnection.createMany({
          data: src.land.utilities.map((u) => ({
            ...u,
            id: randomUUID(),
            landId,
          })),
        });
      }
    }

    if (src.plan) {
      const planId = randomUUID();
      await tx.architecturePlan.create({
        data: {
          ...omit(src.plan, 'rooms', 'components', 'createdAt', 'updatedAt'),
          id: planId,
          projectId,
        },
      });
      if (src.plan.rooms.length) {
        await tx.room.createMany({
          data: src.plan.rooms.map((r) => ({ ...r, id: randomUUID(), planId })),
        });
      }
      if (src.plan.components.length) {
        await tx.boqComponent.createMany({
          data: src.plan.components.map((c) => ({
            ...c,
            id: componentIds.get(c.id) as string,
            planId,
          })),
        });
      }
    }

    if (src.importBatches.length) {
      await tx.importBatch.createMany({
        data: src.importBatches.map((b) => ({
          ...omit(b, 'createdAt'),
          id: batchIds.get(b.id) as string,
          projectId,
        })),
      });
    }

    // Items in FK order: rows without a link first, then rows linked to them; a link to another linked row
    // (not produced by the API, which only allows MATERIAL → WORK) is set afterwards.
    const toRow = (item: (typeof src.items)[number]) => ({
      ...omit(item, 'createdAt', 'updatedAt'),
      id: itemIds.get(item.id) as string,
      projectId,
      budgetLineId: lineIds.get(item.budgetLineId) as string,
      boqComponentId: remap(componentIds, item.boqComponentId),
      requiredForWorkId: remap(itemIds, item.requiredForWorkId),
    });
    const linked = new Set(
      src.items
        .filter((i) => i.requiredForWorkId && itemIds.has(i.requiredForWorkId))
        .map((i) => i.id),
    );
    const first = src.items.filter((i) => !linked.has(i.id));
    const second = src.items.filter(
      (i) => linked.has(i.id) && !linked.has(i.requiredForWorkId as string),
    );
    const chained = src.items.filter(
      (i) => linked.has(i.id) && linked.has(i.requiredForWorkId as string),
    );
    if (first.length) await tx.costItem.createMany({ data: first.map(toRow) });
    if (second.length)
      await tx.costItem.createMany({ data: second.map(toRow) });
    if (chained.length) {
      await tx.costItem.createMany({
        data: chained.map((i) => ({ ...toRow(i), requiredForWorkId: null })),
      });
      for (const i of chained) {
        await tx.costItem.update({
          where: { id: itemIds.get(i.id) as string },
          data: { requiredForWorkId: remap(itemIds, i.requiredForWorkId) },
        });
      }
    }

    if (src.deliveries.length) {
      await tx.delivery.createMany({
        data: src.deliveries.map((d) => ({
          ...omit(d, 'createdAt'),
          id: randomUUID(),
          projectId,
          costItemId: itemIds.get(d.costItemId) as string,
          batchId: remap(batchIds, d.batchId),
        })),
      });
    }

    this.logger.log(
      `Copied project ${src.slug} → ${projectId} (${src.items.length} items)`,
    );
    return projectId;
  }

  private async nextCopySlug(
    tx: Prisma.TransactionClient,
    slug: string,
  ): Promise<string> {
    const prefix = `${slug}-copy-`;
    const taken = await tx.project.findMany({
      where: { slug: { startsWith: prefix } },
      select: { slug: true },
    });
    const used = taken
      .map((p) => Number(p.slug.slice(prefix.length)))
      .filter((n) => Number.isInteger(n) && n > 0);
    return `${prefix}${used.length ? Math.max(...used) + 1 : 1}`;
  }
}
