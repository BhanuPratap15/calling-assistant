import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PlatformAction } from './platform.constants.js';

/** Platform panel ka audit log (client ke audit log se alag) */
@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    entry: {
      actorId: string | null;
      action: PlatformAction;
      organizationId?: string | null;
      changes?: Prisma.InputJsonValue;
      metadata?: Prisma.InputJsonValue;
    },
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.platformAuditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        organizationId: entry.organizationId ?? null,
        changes: entry.changes,
        metadata: entry.metadata,
      },
    });
  }

  list(organizationId?: string, take = 100) {
    return this.prisma.platformAuditLog.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }
}
