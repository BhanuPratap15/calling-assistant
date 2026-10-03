import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import { CallConfigService } from '../call-config/call-config.service.js';
import type { FollowUpTimingConfig } from '../call-config/call-config.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  NotificationsService,
  type NewNotification,
} from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isEffectivelyAvailable } from '../presence/presence.js';
import { pickEscalationTarget } from './escalation.js';

const BATCH = 200;
type Tx = Prisma.TransactionClient;

export interface TickResult {
  reminders: number;
  due: number;
  escalated: number;
  overdue: number;
}

/**
 * Follow-up "engine" — design doc section 8.1 (4 PM example):
 *   3:59 → reminder (owner)   4:00 → due (owner)
 *   4:10 (grace) → owner unavailable? → doosre available assistant ko ESCALATE
 *                  owner available par call nahi kiya? → Team Leader / Manager ko OVERDUE alert
 *
 * tick(now) har 30 sec BullMQ chalata hai. Design:
 *   - DATABASE source of truth: har tick DB se poochta hai "kya karna baaki hai"
 *     (job miss ho jaaye / server restart ho → agla tick pakad lega)
 *   - Idempotent: har kaam ke baad marker (reminderSentAt...) → dobara notification nahi
 *   - FOR UPDATE SKIP LOCKED: 2 servers ek saath tick karein to bhi ek row ek hi baar
 *   - `now` parameter → tests me time "fast-forward" kar sakte hain
 */
@Injectable()
export class FollowUpSchedulerService {
  private readonly logger = new Logger(FollowUpSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly callConfig: CallConfigService,
  ) {}

  async tick(now: Date = new Date()): Promise<TickResult> {
    const timing = await this.callConfig.getFollowUpTiming();
    const result: TickResult = {
      reminders: await this.sendReminders(now, timing),
      due: await this.sendDueNotifications(now),
      escalated: 0,
      overdue: 0,
    };
    const { escalated, overdue } = await this.escalate(now, timing);
    result.escalated = escalated;
    result.overdue = overdue;
    if (Object.values(result).some(Boolean))
      this.logger.log(`tick: ${JSON.stringify(result)}`);
    return result;
  }

  /** due se `reminderMinutesBefore` pehle (aur abhi due nahi hua) → owner ko reminder */
  private sendReminders(now: Date, timing: FollowUpTimingConfig) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<FollowUpRow[]>`
        SELECT f.id, f.owner_id, f.due_at, c.name AS customer_name, f.customer_id
        FROM follow_ups f JOIN customers c ON c.id = f.customer_id
        WHERE f.status = 'PENDING' AND f.reminder_sent_at IS NULL
          AND f.due_at > ${now}
          AND f.due_at <= ${now}::timestamptz + make_interval(mins => ${timing.reminderMinutesBefore}::int)
        ORDER BY f.due_at LIMIT ${BATCH}
        FOR UPDATE OF f SKIP LOCKED`;
      if (!rows.length) return 0;
      await this.notifications.notify(
        rows.map((r) =>
          this.followUpNotification(
            r,
            r.owner_id,
            'FOLLOW_UP_REMINDER',
            `Follow-up soon: ${r.customer_name}`,
          ),
        ),
        tx,
      );
      await tx.followUp.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { reminderSentAt: now },
      });
      return rows.length;
    });
  }

  /** due time aa gaya → owner ko "abhi call karo" */
  private sendDueNotifications(now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<FollowUpRow[]>`
        SELECT f.id, f.owner_id, f.due_at, c.name AS customer_name, f.customer_id
        FROM follow_ups f JOIN customers c ON c.id = f.customer_id
        WHERE f.status = 'PENDING' AND f.due_notified_at IS NULL AND f.due_at <= ${now}
        ORDER BY f.due_at LIMIT ${BATCH}
        FOR UPDATE OF f SKIP LOCKED`;
      if (!rows.length) return 0;
      await this.notifications.notify(
        rows.map((r) =>
          this.followUpNotification(
            r,
            r.owner_id,
            'FOLLOW_UP_DUE',
            `Follow-up due now: ${r.customer_name}`,
          ),
        ),
        tx,
      );
      await tx.followUp.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { dueNotifiedAt: now, reminderSentAt: now }, // late bana ho to reminder skip
      });
      return rows.length;
    });
  }

  /**
   * Grace nikal gaya aur abhi bhi PENDING:
   *   owner unavailable → available colleague ko escalate (same team pehle, kam load)
   *   owner available / koi aur available nahi → overdue alert (TL ya managers) — sirf ek baar
   * Escalation ke baad naya grace period (escalatedAt se) — ping-pong nahi.
   */
  private escalate(now: Date, timing: FollowUpTimingConfig) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        (FollowUpRow & { overdue_notified_at: Date | null })[]
      >`
        SELECT f.id, f.owner_id, f.due_at, f.overdue_notified_at, c.name AS customer_name, f.customer_id
        FROM follow_ups f JOIN customers c ON c.id = f.customer_id
        WHERE f.status = 'PENDING'
          AND COALESCE(f.escalated_at, f.due_at)
              <= ${now}::timestamptz - make_interval(mins => ${timing.gracePeriodMinutes}::int)
        ORDER BY f.due_at LIMIT ${BATCH}
        FOR UPDATE OF f SKIP LOCKED`;
      let escalated = 0;
      let overdue = 0;
      if (!rows.length) return { escalated, overdue };

      const candidates = await this.availableCallers(tx, now, timing);

      for (const row of rows) {
        const owner = await tx.staff.findUniqueOrThrow({
          where: { id: row.owner_id },
          select: {
            id: true,
            name: true,
            teamId: true,
            availability: true,
            lastSeenAt: true,
            isActive: true,
          },
        });
        const ownerAvailable = isEffectivelyAvailable(
          owner,
          now,
          timing.presenceTimeoutMinutes,
        );
        const target = ownerAvailable
          ? null
          : pickEscalationTarget(candidates, owner);

        if (target) {
          await this.escalateTo(tx, row, owner, target, now);
          target.openFollowUps += 1; // isi tick me load update (agla follow-up kisi aur ko)
          escalated++;
        } else if (!row.overdue_notified_at) {
          await this.notifyOverdue(tx, row, owner, ownerAvailable);
          await tx.followUp.update({
            where: { id: row.id },
            data: { overdueNotifiedAt: now },
          });
          overdue++;
        }
      }
      return { escalated, overdue };
    });
  }

  private async escalateTo(
    tx: Tx,
    row: FollowUpRow,
    owner: { id: string; name: string },
    target: { id: string; name: string },
    now: Date,
  ) {
    await tx.followUp.update({
      where: { id: row.id },
      data: {
        ownerId: target.id,
        escalatedAt: now,
        escalationCount: { increment: 1 },
        dueNotifiedAt: now, // naye owner ko neeche wali notification hi "due" hai
        overdueNotifiedAt: null,
      },
    });
    await this.notifications.notify(
      [
        this.followUpNotification(
          row,
          target.id,
          'FOLLOW_UP_ESCALATED_TO_YOU',
          `Escalated to you: ${row.customer_name} (was ${owner.name})`,
        ),
        this.followUpNotification(
          row,
          owner.id,
          'FOLLOW_UP_ESCALATED_AWAY',
          `${row.customer_name} follow-up moved to ${target.name} (you were unavailable)`,
        ),
      ],
      tx,
    );
    await this.audit.record(
      {
        actorId: null, // system ne kiya
        action: AuditAction.FOLLOW_UP_ESCALATED,
        entityType: 'follow_up',
        entityId: row.id,
        changes: { ownerId: { from: owner.id, to: target.id } },
        metadata: {
          reason: 'owner_unavailable',
          customerId: row.customer_id,
          fromName: owner.name,
          toName: target.name,
        },
      },
      tx,
    );
  }

  /** Overdue alert: owner ki team ka leader; leader nahi to saare active managers */
  private async notifyOverdue(
    tx: Tx,
    row: FollowUpRow,
    owner: { id: string; name: string; teamId: string | null },
    ownerAvailable: boolean,
  ) {
    const leader = owner.teamId
      ? await tx.team.findUnique({
          where: { id: owner.teamId },
          select: { leader: { select: { id: true, isActive: true } } },
        })
      : null;
    const recipients =
      leader?.leader?.isActive && leader.leader.id !== owner.id
        ? [leader.leader.id]
        : (
            await tx.staff.findMany({
              where: {
                isActive: true,
                role: { in: ['MANAGER', 'SUPER_ADMIN'] },
              },
              select: { id: true },
            })
          ).map((m) => m.id);
    const why = ownerAvailable
      ? `${owner.name} has not called yet`
      : 'no available assistant to escalate to';
    await this.notifications.notify(
      recipients.map((id) =>
        this.followUpNotification(
          row,
          id,
          'FOLLOW_UP_OVERDUE',
          `Overdue follow-up: ${row.customer_name} — ${why}`,
        ),
      ),
      tx,
    );
  }

  /** Abhi kaun escalation le sakta hai (presence check + unka open follow-up load) */
  private async availableCallers(
    tx: Tx,
    now: Date,
    timing: FollowUpTimingConfig,
  ) {
    const staff = await tx.staff.findMany({
      where: {
        isActive: true,
        role: { in: ['ASSISTANT', 'TEAM_LEADER'] },
        availability: { in: ['AVAILABLE', 'ON_CALL'] },
      },
      select: {
        id: true,
        name: true,
        teamId: true,
        availability: true,
        lastSeenAt: true,
        isActive: true,
        _count: {
          select: {
            followUpsOwned: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            },
          },
        },
      },
    });
    return staff
      .filter((s) =>
        isEffectivelyAvailable(s, now, timing.presenceTimeoutMinutes),
      )
      .map((s) => ({
        id: s.id,
        name: s.name,
        teamId: s.teamId,
        openFollowUps: s._count.followUpsOwned,
      }));
  }

  private followUpNotification(
    row: FollowUpRow,
    recipientId: string,
    type: NewNotification['type'],
    title: string,
  ): NewNotification {
    return {
      recipientId,
      type,
      title,
      body: `Due at ${new Date(row.due_at).toISOString()}`,
      link: '/follow-ups',
      data: {
        followUpId: row.id,
        customerId: row.customer_id,
        dueAt: new Date(row.due_at).toISOString(),
      },
    };
  }
}

interface FollowUpRow {
  id: string;
  owner_id: string;
  due_at: Date;
  customer_name: string;
  customer_id: string;
}
