import { Injectable } from '@nestjs/common';
import type { Paginated } from '../common/pagination.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditEntry } from './audit.types.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

/** Normal client ya transaction client — dono chalenge */
type DbClient = PrismaService | Prisma.TransactionClient;

const auditLogSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  changes: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, name: true, role: true } },
} satisfies Prisma.AuditLogSelect;

type AuditLogRow = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Audit entry likho.
   * Asli change ke SAATH same transaction me likhna ho to `db` me tx pass karo:
   *   await this.prisma.$transaction(async (tx) => {
   *     const staff = await tx.staff.create(...);
   *     await this.audit.record({...}, tx);   // ← change fail = audit bhi rollback
   *   });
   */
  async record(entry: AuditEntry, db: DbClient = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        changes: entry.changes as Prisma.InputJsonValue | undefined,
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findAll(query: ListAuditLogsQueryDto): Promise<Paginated<AuditLogRow>> {
    const { page, pageSize, entityType, entityId, actorId, action, from, to } =
      query;
    const where: Prisma.AuditLogWhereInput = {
      entityType,
      entityId,
      actorId,
      action,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: auditLogSelect,
        orderBy: { createdAt: 'desc' }, // naya sabse upar
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }
}
