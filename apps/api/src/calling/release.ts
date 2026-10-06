import type { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import type { Prisma } from '../generated/prisma/client.js';

/** Bina call save kiye current customer chhodna — kyun? (assignments.release_reason) */
export type ReleaseReason = 'stopped_by_assistant' | 'assistant_away';

export interface ReleasableAssignment {
  id: string;
  source: 'AUTO' | 'MANUAL' | 'FOLLOW_UP' | 'DISTRIBUTED';
  customerId: string;
  staffId: string;
  campaignId: string | null;
}

/**
 * Current (IN_PROGRESS) customer ko chhodo — call record NAHI banta (ADR 0015).
 * Source ke hisaab se customer kahan jaata hai:
 *   MANUAL / DISTRIBUTED → manager ne ISI assistant ko diya tha → wapas uski ASSIGNED queue me
 *   FOLLOW_UP            → follow-up wapas PENDING (owner wahi; away raha to escalation sambhaalega)
 *   AUTO                 → CANCELLED → customer wapas pool / campaign queue me
 * Caller: row lock (FOR UPDATE) le chuka ho. Audit isi transaction me.
 */
export async function releaseAssignment(
  tx: Prisma.TransactionClient,
  audit: AuditService,
  a: ReleasableAssignment,
  opts: { actorId: string | null; reason: ReleaseReason; note?: string },
): Promise<'requeued' | 'released'> {
  const now = new Date();
  const backToQueue = a.source === 'MANUAL' || a.source === 'DISTRIBUTED';
  if (backToQueue) {
    await tx.assignment.update({
      where: { id: a.id },
      data: {
        status: 'ASSIGNED',
        inProgressStaffId: null, // "current" slot khali; openCustomerId wahi (customer isi ke paas)
        startedAt: null,
        staleNotifiedAt: null,
      },
    });
  } else {
    if (a.source === 'FOLLOW_UP') {
      await tx.followUp.updateMany({
        where: { openCustomerId: a.customerId, status: 'IN_PROGRESS' },
        data: { status: 'PENDING' },
      });
    }
    await tx.assignment.update({
      where: { id: a.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        openCustomerId: null,
        inProgressStaffId: null,
        releaseReason: opts.reason,
      },
    });
  }
  await audit.record(
    {
      actorId: opts.actorId,
      action: AuditAction.ASSIGNMENT_RELEASED,
      entityType: 'assignment',
      entityId: a.id,
      metadata: {
        customerId: a.customerId,
        staffId: a.staffId,
        source: a.source,
        campaignId: a.campaignId,
        reason: opts.reason,
        note: opts.note ?? null,
        result: backToQueue ? 'requeued' : 'released',
      },
    },
    tx,
  );
  return backToQueue ? 'requeued' : 'released';
}
