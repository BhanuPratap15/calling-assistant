import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { CallConfigService } from '../call-config/call-config.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  NotificationsService,
  type NewNotification,
} from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACTIVE_STATUSES } from '../telephony/telephony-rules.js';
import { releaseAssignment, type ReleasableAssignment } from './release.js';

const BATCH = 200;

export interface WatchdogResult {
  formReminders: number;
  autoReleased: number;
}

interface StaleRow {
  id: string;
  source: ReleasableAssignment['source'];
  customer_id: string;
  customer_name: string;
  staff_id: string;
  staff_name: string;
  team_id: string | null;
  campaign_id: string | null;
  dials: number;
}

/**
 * Calling watchdog (ADR 0015) — scheduler har tick pe chalata hai (follow-up tick ke saath).
 * Problem (Phase 10 testing me mila): "Save & Next" hamesha agla customer khol deta hai. Assistant
 * shift ke end me browser band karke chala gaya → woh customer us ke naam pe LOCK, koi aur call nahi karta.
 *
 *  1) Form incomplete (design doc section 18): current `incompleteFormMinutes` se khula → assistant ko
 *     EK reminder (assignments.stale_notified_at).
 *  2) Auto-release: `autoReleaseMinutes` se khula AUR assistant away (BREAK / OFFLINE / heartbeat band)
 *     AUR live call nahi chal rahi → customer wapas queue (release.ts) + assistant + TL / manager ko batao.
 * DB source of truth + SKIP LOCKED + markers → idempotent, kai servers pe bhi safe (follow-up scheduler jaisa).
 */
@Injectable()
export class CallingWatchdogService {
  private readonly logger = new Logger(CallingWatchdogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly callConfig: CallConfigService,
  ) {}

  async tick(now: Date = new Date()): Promise<WatchdogResult> {
    const [workflow, timing] = await Promise.all([
      this.callConfig.getCallingWorkflow(),
      this.callConfig.getFollowUpTiming(),
    ]);
    const result: WatchdogResult = {
      formReminders: await this.remindIncompleteForms(
        now,
        workflow.incompleteFormMinutes,
      ),
      autoReleased: workflow.autoReleaseMinutes
        ? await this.releaseAbandoned(
            now,
            workflow.autoReleaseMinutes,
            timing.presenceTimeoutMinutes,
          )
        : 0,
    };
    if (result.formReminders || result.autoReleased)
      this.logger.log(`watchdog: ${JSON.stringify(result)}`);
    return result;
  }

  private remindIncompleteForms(now: Date, minutes: number) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string; staff_id: string; customer_name: string }[]
      >`
        SELECT a.id, a.staff_id, c.name AS customer_name
        FROM assignments a JOIN customers c ON c.id = a.customer_id
        WHERE a.status = 'IN_PROGRESS' AND a.stale_notified_at IS NULL
          AND a.started_at <= ${now}::timestamptz - make_interval(mins => ${minutes}::int)
        ORDER BY a.started_at LIMIT ${BATCH}
        FOR UPDATE OF a SKIP LOCKED`;
      if (!rows.length) return 0;
      await this.notifications.notify(
        rows.map((r) => ({
          recipientId: r.staff_id,
          type: 'FORM_INCOMPLETE' as const,
          title: `Call form pending: ${r.customer_name}`,
          body: `Open for ${minutes}+ min — save the call (Save & Next / Save & Stop) or Stop calling.`,
          link: '/calling',
          data: { assignmentId: r.id },
        })),
        tx,
      );
      await tx.assignment.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { staleNotifiedAt: now },
      });
      return rows.length;
    });
  }

  private releaseAbandoned(
    now: Date,
    minutes: number,
    presenceTimeoutMinutes: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Away = presence.ts ka ulta: BREAK / OFFLINE, ya heartbeat presenceTimeout se purana
      const rows = await tx.$queryRaw<StaleRow[]>`
        SELECT a.id, a.source::text AS source, a.customer_id, c.name AS customer_name,
               a.staff_id, s.name AS staff_name, s.team_id, a.campaign_id,
               (SELECT count(*) FROM call_sessions cs WHERE cs.assignment_id = a.id)::int AS dials
        FROM assignments a
        JOIN customers c ON c.id = a.customer_id
        JOIN staff s ON s.id = a.staff_id
        WHERE a.status = 'IN_PROGRESS'
          AND a.started_at <= ${now}::timestamptz - make_interval(mins => ${minutes}::int)
          AND (s.availability IN ('BREAK', 'OFFLINE') OR s.last_seen_at IS NULL
               OR s.last_seen_at < ${now}::timestamptz - make_interval(mins => ${presenceTimeoutMinutes}::int))
          AND NOT EXISTS (SELECT 1 FROM call_sessions cs
                          WHERE cs.assignment_id = a.id
                            AND cs.status::text = ANY(${ACTIVE_STATUSES as string[]}))
        ORDER BY a.started_at LIMIT ${BATCH}
        FOR UPDATE OF a SKIP LOCKED`;
      if (!rows.length) return 0;

      const leaders = await this.leadersByTeam(
        tx,
        rows.map((r) => r.team_id),
      );
      const managers = (
        await tx.staff.findMany({
          where: { isActive: true, role: { in: ['MANAGER', 'SUPER_ADMIN'] } },
          select: { id: true },
        })
      ).map((m) => m.id);

      const items: NewNotification[] = [];
      for (const r of rows) {
        const result = await releaseAssignment(
          tx,
          this.audit,
          {
            id: r.id,
            source: r.source,
            customerId: r.customer_id,
            staffId: r.staff_id,
            campaignId: r.campaign_id,
          },
          {
            actorId: null, // system ne kiya
            reason: 'assistant_away',
            note: r.dials ? `dialled ${r.dials}x, form not saved` : undefined,
          },
        );
        const where =
          result === 'requeued'
            ? 'kept in your assigned queue'
            : 'returned to the queue';
        items.push({
          recipientId: r.staff_id,
          type: 'ASSIGNMENT_AUTO_RELEASED',
          title: `${r.customer_name} ${where} (you were away)`,
          link: '/calling',
          data: { assignmentId: r.id, customerId: r.customer_id },
        });
        // Team leader ko (khud TL na ho to), warna managers ko
        const lead = r.team_id ? leaders.get(r.team_id) : undefined;
        const supervisors = lead && lead !== r.staff_id ? [lead] : managers;
        for (const id of supervisors) {
          items.push({
            recipientId: id,
            type: 'ASSIGNMENT_AUTO_RELEASED',
            title: `${r.staff_name} was away — ${r.customer_name} released without a call${r.dials ? ` (dialled ${r.dials}x, form not saved)` : ''}`,
            link: `/customers/${r.customer_id}`,
            data: {
              assignmentId: r.id,
              customerId: r.customer_id,
              staffId: r.staff_id,
            },
          });
        }
      }
      await this.notifications.notify(items, tx);
      return rows.length;
    });
  }

  private async leadersByTeam(
    tx: Prisma.TransactionClient,
    teamIds: (string | null)[],
  ) {
    const ids = [...new Set(teamIds.filter((t): t is string => !!t))];
    if (!ids.length) return new Map<string, string>();
    const teams = await tx.team.findMany({
      where: { id: { in: ids } },
      select: { id: true, leader: { select: { id: true, isActive: true } } },
    });
    return new Map(
      teams
        .filter((t) => t.leader?.isActive)
        .map((t) => [t.id, t.leader!.id] as const),
    );
  }
}
