import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Delivery, Prisma } from '@prisma/client';
import {
  MAX_INT_FIELD,
  type ImportResult,
  type ImportRowError,
} from '@default-project/types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectScopeService } from '../projects/project-scope.service';
import {
  headerError,
  validateDeliveryRows,
  type ItemRef,
  type ValidDeliveryRow,
} from './delivery-rows.validator';
import type { ImportDeliveriesDto } from './dto/import-deliveries.dto';

/** Up to 500 sequential upserts hold SQLite's write lock; the 5 s default is too tight. */
export const IMPORT_TX_OPTIONS = { timeout: 20_000, maxWait: 5_000 };

type NoteState = { kind: string; invoiceCents: number | null };

const maxDate = (dates: string[]) => dates.reduce((a, b) => (b > a ? b : a));

function deliveredTotal(notes: Map<string, NoteState>): number {
  let sum = 0;
  for (const n of notes.values())
    if (n.kind === 'DELIVERED') sum += n.invoiceCents ?? 0;
  return sum;
}

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectScopeService,
  ) {}

  async list(projectId: string): Promise<Delivery[]> {
    await this.scope.assertProject(projectId);
    return this.prisma.delivery.findMany({
      where: { projectId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Partial, idempotent import (CONTRACTS §5): every row is validated, the valid ones are upserted
   * by (costItemId, deliveryNoteNo) in one transaction and the item effects are recomputed from the
   * stored deliveries, never incremented.
   */
  async import(
    projectId: string,
    dto: ImportDeliveriesDto,
  ): Promise<ImportResult> {
    const problem = headerError(dto.rows);
    if (problem) throw new BadRequestException(problem);
    await this.scope.assertProject(projectId);

    const codes = [
      ...new Set(
        dto.rows
          .map(
            (r) =>
              Object.entries(r).find(
                ([k]) => k.replace(/^\uFEFF/, '').trim() === 'itemCode',
              )?.[1],
          )
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim()),
      ),
    ];
    const items = await this.prisma.costItem.findMany({
      where: { projectId, code: { in: codes } },
      select: { id: true, code: true, kind: true },
    });
    const itemsByCode = new Map<string, ItemRef>(
      items.map((i) => [i.code, { id: i.id, kind: i.kind }]),
    );
    const { valid, errors } = validateDeliveryRows(dto.rows, itemsByCode);

    const result = await this.prisma.$transaction(
      (tx) => this.apply(tx, projectId, dto, valid, errors),
      IMPORT_TX_OPTIONS,
    );
    this.logger.log(
      `Delivery import ${dto.fileName} into ${projectId}: ${result.okRows} ok, ${result.failedRows} failed`,
    );
    return result;
  }

  private async apply(
    tx: Prisma.TransactionClient,
    projectId: string,
    dto: ImportDeliveriesDto,
    valid: ValidDeliveryRow[],
    rowErrors: ImportRowError[],
  ): Promise<ImportResult> {
    const errors = [...rowErrors];
    const touched = [...new Set(valid.map((v) => v.costItemId))];
    const existing = await tx.delivery.findMany({
      where: { costItemId: { in: touched } },
      select: {
        costItemId: true,
        deliveryNoteNo: true,
        kind: true,
        invoiceCents: true,
      },
    });

    // Simulate the final notes per item so a row that would overflow the Int actual is rejected
    // as a row error instead of failing the whole transaction.
    const notesByItem = new Map<string, Map<string, NoteState>>();
    const notesOf = (id: string) => {
      let notes = notesByItem.get(id);
      if (!notes) notesByItem.set(id, (notes = new Map()));
      return notes;
    };
    const hadDelivered = new Set<string>();
    for (const d of existing) {
      notesOf(d.costItemId).set(d.deliveryNoteNo, d);
      if (d.kind === 'DELIVERED') hadDelivered.add(d.costItemId);
    }
    const applied: ValidDeliveryRow[] = [];
    for (const v of valid) {
      const notes = notesOf(v.costItemId);
      const previous = notes.get(v.deliveryNoteNo);
      notes.set(v.deliveryNoteNo, v);
      if (deliveredTotal(notes) > MAX_INT_FIELD) {
        if (previous) notes.set(v.deliveryNoteNo, previous);
        else notes.delete(v.deliveryNoteNo);
        errors.push({
          row: v.row,
          field: 'invoiceAmountEur',
          message: 'invoice total for the item exceeds the limit',
        });
        continue;
      }
      applied.push(v);
    }
    errors.sort((a, b) => a.row - b.row);
    const failedRows = new Set(errors.map((e) => e.row)).size;

    const batch = await tx.importBatch.create({
      data: {
        projectId,
        fileName: dto.fileName,
        totalRows: dto.rows.length,
        okRows: applied.length,
        failedRows,
        errorsJson: JSON.stringify(errors),
      },
    });

    for (const v of applied) {
      const fields = {
        batchId: batch.id,
        kind: v.kind,
        date: v.date,
        qtyMilli: v.qtyMilli,
        invoiceCents: v.invoiceCents,
      };
      await tx.delivery.upsert({
        where: {
          costItemId_deliveryNoteNo: {
            costItemId: v.costItemId,
            deliveryNoteNo: v.deliveryNoteNo,
          },
        },
        create: {
          projectId,
          costItemId: v.costItemId,
          deliveryNoteNo: v.deliveryNoteNo,
          ...fields,
        },
        update: fields,
      });
    }

    const appliedIds = [...new Set(applied.map((v) => v.costItemId))];
    const stored = await tx.delivery.findMany({
      where: { costItemId: { in: appliedIds } },
      select: { costItemId: true, kind: true, date: true, invoiceCents: true },
    });
    for (const id of appliedIds) {
      const data: Prisma.CostItemUpdateInput = {};
      const expected = applied.filter(
        (v) => v.costItemId === id && v.kind === 'EXPECTED',
      );
      if (expected.length)
        data.deliveryDate = maxDate(expected.map((v) => v.date));
      const delivered = stored.filter(
        (d) => d.costItemId === id && d.kind === 'DELIVERED',
      );
      if (delivered.length || hadDelivered.has(id)) {
        data.deliveredDate = delivered.length
          ? maxDate(delivered.map((d) => d.date))
          : null;
        data.actualCents = delivered.reduce(
          (sum, d) => sum + (d.invoiceCents ?? 0),
          0,
        );
      }
      await tx.costItem.update({ where: { id }, data });
    }

    return {
      batchId: batch.id,
      totalRows: dto.rows.length,
      okRows: applied.length,
      failedRows,
      errors,
      updatedItemIds: appliedIds,
    };
  }
}
