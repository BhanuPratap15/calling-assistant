import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Paginated } from '../common/pagination.dto.js';
import { normalizePhone } from '../common/phone.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ConfirmImportDto,
  ListImportRowsQueryDto,
  ListImportsQueryDto,
} from './dto/import.dto.js';
import { ImportFileError, parseImportFile } from './import-parser.js';
import {
  checkRows,
  csvCell,
  IMPORT_FIELDS,
  mapHeaders,
  type ExistingLookup,
  type ImportData,
  type RawRow,
} from './import-rules.js';

/** Background import ek baar me kitni lines (ek transaction) */
export const IMPORT_CHUNK = 1000;
const LOOKUP_CHUNK = 5000;

const batchSelect = {
  id: true,
  fileName: true,
  status: true,
  totalRows: true,
  validRows: true,
  invalidRows: true,
  duplicateRows: true,
  importedRows: true,
  skippedRows: true,
  ignoredColumns: true,
  error: true,
  confirmedAt: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
  tag: { select: { id: true, name: true, color: true } },
} satisfies Prisma.ImportBatchSelect;

/**
 * Bulk import (design doc section 16):
 *   upload → parse → validate → duplicate check → PREVIEW (DB me batch + rows)
 *   → confirm → background job (processBatch) → COMPLETED + notification
 */
@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------- 1) upload → preview ----------------

  async preview(
    file: { buffer: Buffer; originalname: string },
    actor: AuthUser,
  ) {
    let parsed;
    try {
      parsed = await parseImportFile(file.buffer, file.originalname);
    } catch (e) {
      if (e instanceof ImportFileError)
        throw new BadRequestException(e.message);
      throw e;
    }

    const mapping = mapHeaders(parsed.headers);
    if (mapping.missing.length) {
      throw new BadRequestException(
        `Missing required column(s): ${mapping.missing.join(', ')}. ` +
          `Found: ${parsed.headers.filter(Boolean).join(', ') || '(none)'}`,
      );
    }
    if (mapping.duplicates.length) {
      throw new BadRequestException(
        `Same field in more than one column: ${mapping.duplicates.join(', ')}`,
      );
    }

    const rows = parsed.rows.map(({ rowNumber, cells }) => {
      const raw: RawRow = {};
      for (const [index, field] of mapping.columns)
        raw[field] = cells[index] ?? '';
      return { rowNumber, raw };
    });

    const checked = checkRows(
      rows,
      await this.findExisting(rows.map((r) => r.raw)),
    );
    const count = (s: string) => checked.filter((r) => r.status === s).length;

    // 20k rows bhi ek transaction me: ya poora preview bane ya kuch nahi
    const batch = await this.prisma.$transaction(
      async (tx) => {
        const batch = await tx.importBatch.create({
          data: {
            fileName: file.originalname.slice(0, 255),
            totalRows: checked.length,
            validRows: count('VALID'),
            invalidRows: count('INVALID'),
            duplicateRows: count('DUPLICATE'),
            ignoredColumns: mapping.ignored,
            createdById: actor.id,
          },
          select: { id: true, totalRows: true, validRows: true },
        });
        for (let i = 0; i < checked.length; i += IMPORT_CHUNK) {
          await tx.importRow.createMany({
            data: checked.slice(i, i + IMPORT_CHUNK).map((r) => ({
              batchId: batch.id,
              rowNumber: r.rowNumber,
              raw: r.raw,
              data: (r.data ?? undefined) as Prisma.InputJsonValue | undefined,
              status: r.status,
              errors: r.errors,
              customerId: r.customerId,
            })),
          });
        }
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.IMPORT_PREVIEWED,
            entityType: 'import',
            entityId: batch.id,
            metadata: {
              fileName: file.originalname,
              total: checked.length,
              valid: count('VALID'),
              invalid: count('INVALID'),
              duplicate: count('DUPLICATE'),
            },
          },
          tx,
        );
        return batch;
      },
      { timeout: 120_000 },
    );
    return this.findOne(batch.id);
  }

  /** File ke phones / external IDs me se jo DB me pehle se hain (chunks me — 20k ek IN() me nahi) */
  private async findExisting(raws: RawRow[]): Promise<ExistingLookup> {
    const phones = [
      ...new Set(
        raws
          .map((r) => (r.phone?.trim() ? normalizePhone(r.phone.trim()) : null))
          .filter((p): p is string => Boolean(p)),
      ),
    ];
    const externalIds = [
      ...new Set(
        raws
          .map((r) => r.externalId?.trim())
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const lookup: ExistingLookup = {
      byPhone: new Map(),
      byExternalId: new Map(),
    };
    for (let i = 0; i < phones.length; i += LOOKUP_CHUNK) {
      const found = await this.prisma.customer.findMany({
        where: { phone: { in: phones.slice(i, i + LOOKUP_CHUNK) } },
        select: { id: true, name: true, phone: true },
      });
      for (const c of found) lookup.byPhone.set(c.phone, c);
    }
    for (let i = 0; i < externalIds.length; i += LOOKUP_CHUNK) {
      const found = await this.prisma.customer.findMany({
        where: { externalId: { in: externalIds.slice(i, i + LOOKUP_CHUNK) } },
        select: { id: true, name: true, externalId: true },
      });
      for (const c of found) lookup.byExternalId.set(c.externalId!, c);
    }
    return lookup;
  }

  // ---------------- read ----------------

  async findAll(query: ListImportsQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.ImportBatchWhereInput = { status: query.status };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: batchSelect,
      }),
      this.prisma.importBatch.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(id: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id },
      select: batchSelect,
    });
    if (!batch) throw new NotFoundException('Import not found');
    return batch;
  }

  async listRows(id: string, query: ListImportRowsQueryDto) {
    await this.findOne(id);
    const where: Prisma.ImportRowWhereInput = {
      batchId: id,
      status: query.status,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.importRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          rowNumber: true,
          raw: true,
          status: true,
          errors: true,
          customerId: true,
        },
      }),
      this.prisma.importRow.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  /**
   * Jo lines import nahi huin (INVALID / DUPLICATE / SKIPPED) — CSV me, wajah ke saath.
   * Columns template wale hi hain → manager theek karke yahi file dobara upload kar sakta hai.
   */
  async problemRowsCsv(id: string): Promise<string> {
    await this.findOne(id);
    const rows = await this.prisma.importRow.findMany({
      where: {
        batchId: id,
        status: { in: ['INVALID', 'DUPLICATE', 'SKIPPED'] },
      },
      orderBy: { rowNumber: 'asc' },
      select: { rowNumber: true, raw: true, status: true, errors: true },
    });
    const header = ['row', 'status', 'problem', ...IMPORT_FIELDS.map(snake)];
    const lines = rows.map((r) => {
      const raw = r.raw as RawRow;
      return [
        r.rowNumber,
        r.status,
        r.errors.join('; '),
        ...IMPORT_FIELDS.map((f) => raw[f]),
      ]
        .map(csvCell)
        .join(',');
    });
    return [header.join(','), ...lines].join('\r\n') + '\r\n';
  }

  // ---------------- 2) confirm / cancel / retry ----------------

  /** PREVIEW → QUEUED. Asli kaam background job (ImportRunner) karta hai. */
  async confirm(id: string, dto: ConfirmImportDto, actor: AuthUser) {
    const batch = await this.findOne(id);
    if (batch.status !== 'PREVIEW')
      throw new BadRequestException(`Import is ${batch.status}, not PREVIEW`);
    if (batch.validRows === 0)
      throw new BadRequestException('No valid rows to import');

    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: dto.campaignId },
        select: { status: true },
      });
      if (!campaign) throw new BadRequestException('Campaign not found');
      if (campaign.status === 'COMPLETED')
        throw new BadRequestException('Campaign is completed');
    }
    if (dto.tagId) {
      const tag = await this.prisma.tag.findUnique({
        where: { id: dto.tagId },
      });
      if (!tag?.isActive)
        throw new BadRequestException('Tag not found or inactive');
    }

    await this.prisma.$transaction(async (tx) => {
      // Do tabs se ek saath confirm → sirf ek jeetega (status condition)
      const { count } = await tx.importBatch.updateMany({
        where: { id, status: 'PREVIEW' },
        data: {
          status: 'QUEUED',
          confirmedAt: new Date(),
          campaignId: dto.campaignId,
          tagId: dto.tagId,
        },
      });
      if (!count) throw new BadRequestException('Import was already confirmed');
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.IMPORT_CONFIRMED,
          entityType: 'import',
          entityId: id,
          metadata: {
            valid: batch.validRows,
            campaignId: dto.campaignId,
            tagId: dto.tagId,
          },
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  async cancel(id: string, actor: AuthUser) {
    const batch = await this.findOne(id);
    if (batch.status !== 'PREVIEW')
      throw new BadRequestException('Only a preview can be cancelled');
    await this.prisma.$transaction(async (tx) => {
      await tx.importBatch.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.IMPORT_CANCELLED,
          entityType: 'import',
          entityId: id,
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  /** FAILED → QUEUED (jo lines bachi hain wahin se aage; IMPORTED wali dobara nahi banti) */
  async retry(id: string) {
    const { count } = await this.prisma.importBatch.updateMany({
      where: { id, status: 'FAILED' },
      data: { status: 'QUEUED', error: null },
    });
    if (!count)
      throw new BadRequestException('Only a failed import can be retried');
    return this.findOne(id);
  }

  /** Server restart ke baad adhoore imports (QUEUED / PROCESSING) — dobara queue karne ke liye */
  async pendingBatchIds(): Promise<string[]> {
    const rows = await this.prisma.importBatch.findMany({
      where: { status: { in: ['QUEUED', 'PROCESSING'] } },
      select: { id: true },
      orderBy: { confirmedAt: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  // ---------------- 3) background processing ----------------

  /**
   * Customers banao — IMPORT_CHUNK lines ek transaction me.
   * Idempotent: sirf VALID lines uthata hai, to beech me ruk gaya to dobara chalane pe wahin se aage.
   */
  async processBatch(id: string): Promise<void> {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch || !['QUEUED', 'PROCESSING'].includes(batch.status)) return;
    await this.prisma.importBatch.update({
      where: { id },
      data: { status: 'PROCESSING', startedAt: batch.startedAt ?? new Date() },
    });

    try {
      for (;;) {
        const rows = await this.prisma.importRow.findMany({
          where: { batchId: id, status: 'VALID' },
          orderBy: { rowNumber: 'asc' },
          take: IMPORT_CHUNK,
          select: { id: true, data: true },
        });
        if (!rows.length) break;
        await this.importChunk(batch, rows);
      }

      const done = await this.prisma.$transaction(async (tx) => {
        const done = await tx.importBatch.update({
          where: { id },
          data: { status: 'COMPLETED', finishedAt: new Date() },
        });
        await this.audit.record(
          {
            actorId: done.createdById,
            action: AuditAction.IMPORT_COMPLETED,
            entityType: 'import',
            entityId: id,
            metadata: {
              imported: done.importedRows,
              skipped: done.skippedRows,
            },
          },
          tx,
        );
        if (done.createdById) {
          await this.notifications.notify(
            [
              {
                recipientId: done.createdById,
                type: 'IMPORT_COMPLETED',
                title: `Import complete: ${done.importedRows} customers added`,
                body: `${done.fileName}${done.skippedRows ? ` · ${done.skippedRows} skipped` : ''}`,
                link: `/imports/${id}`,
              },
            ],
            tx,
          );
        }
        return done;
      });
      this.logger.log(
        `Import ${id}: ${done.importedRows} imported, ${done.skippedRows} skipped`,
      );
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      this.logger.error(`Import ${id} failed`, error as Error);
      await this.prisma.$transaction(async (tx) => {
        await tx.importBatch.update({
          where: { id },
          data: { status: 'FAILED', error: message },
        });
        await this.audit.record(
          {
            actorId: batch.createdById,
            action: AuditAction.IMPORT_FAILED,
            entityType: 'import',
            entityId: id,
            metadata: { error: message },
          },
          tx,
        );
        if (batch.createdById) {
          await this.notifications.notify(
            [
              {
                recipientId: batch.createdById,
                type: 'IMPORT_FAILED',
                title: 'Import failed',
                body: `${batch.fileName}: ${message}`,
                link: `/imports/${id}`,
              },
            ],
            tx,
          );
        }
      });
    }
  }

  private async importChunk(
    batch: {
      id: string;
      createdById: string | null;
      campaignId: string | null;
      tagId: string | null;
    },
    rows: { id: string; data: Prisma.JsonValue }[],
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const data = rows.map((r) => r.data as unknown as ImportData);
        // skipDuplicates: preview ke baad kisi ne same phone/externalId se customer bana diya → chhod do
        const created = await tx.customer.createManyAndReturn({
          data: data.map((d) => ({ ...d, createdById: batch.createdById })),
          skipDuplicates: true,
          select: { id: true, phone: true },
        });
        const idByPhone = new Map(created.map((c) => [c.phone, c.id]));

        const imported = rows.filter((_, i) => idByPhone.has(data[i].phone));
        const skipped = rows.filter((_, i) => !idByPhone.has(data[i].phone));
        if (imported.length) {
          // 1000 alag UPDATE nahi — ek query (unnest = arrays ko table jaisa)
          const rowIds = imported.map((r) => r.id);
          const customerIds = imported.map((r) =>
            idByPhone.get((r.data as unknown as ImportData).phone)!,
          );
          await tx.$executeRaw`
            UPDATE import_rows AS r
            SET status = 'IMPORTED'::import_row_status, customer_id = v.customer_id
            FROM unnest(${rowIds}::uuid[], ${customerIds}::uuid[]) AS v(row_id, customer_id)
            WHERE r.id = v.row_id`;
        }
        if (skipped.length) {
          await tx.importRow.updateMany({
            where: { id: { in: skipped.map((r) => r.id) } },
            data: {
              status: 'SKIPPED',
              errors: [
                'Phone or externalId already exists (added after preview)',
              ],
            },
          });
        }

        const customerIds = created.map((c) => c.id);
        if (batch.campaignId && customerIds.length) {
          await tx.campaignCustomer.createMany({
            data: customerIds.map((customerId) => ({
              campaignId: batch.campaignId!,
              customerId,
              addedById: batch.createdById,
            })),
            skipDuplicates: true,
          });
          await tx.campaign.update({
            where: { id: batch.campaignId },
            data: { exhaustedNotifiedAt: null }, // naye customers → "khatam" alert reset
          });
        }
        if (batch.tagId && customerIds.length) {
          await tx.customerTag.createMany({
            data: customerIds.map((customerId) => ({
              customerId,
              tagId: batch.tagId!,
              addedById: batch.createdById,
            })),
            skipDuplicates: true,
          });
        }
        // Progress (UI har 2s me padhta hai)
        await tx.importBatch.update({
          where: { id: batch.id },
          data: {
            importedRows: { increment: imported.length },
            skippedRows: { increment: skipped.length },
          },
        });
      },
      { timeout: 60_000 },
    );
  }
}

/** alternatePhone → alternate_phone (CSV header, template jaisa) */
function snake(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
