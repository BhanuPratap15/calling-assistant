import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CallConfigService } from '../call-config/call-config.service.js';
import type { Paginated } from '../common/pagination.dto.js';
import { staffScope } from '../common/team-scope.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  FollowUpBucket,
  ListFollowUpsQueryDto,
} from './dto/follow-up.dto.js';

export const followUpSelect = {
  id: true,
  status: true,
  dueAt: true,
  escalationCount: true,
  escalatedAt: true,
  reminderSentAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true, phone: true, priority: true } },
  owner: { select: { id: true, name: true } },
  originalOwner: { select: { id: true, name: true } },
  sourceCall: {
    select: {
      userResponse: true,
      notes: true,
      interestRating: true,
      outcome: { select: { label: true } },
    },
  },
} satisfies Prisma.FollowUpSelect;

type FollowUpRow = Prisma.FollowUpGetPayload<{ select: typeof followUpSelect }>;
const OPEN = ['PENDING', 'IN_PROGRESS'] as const;

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly callConfig: CallConfigService,
  ) {}

  /**
   * Call save hote hi (Save & Next transaction ke ANDAR) — design doc section 8:
   *  1. customer ka koi open follow-up hai → COMPLETED (customer ko call ho gaya)
   *  2. naya call follow-up maangta hai → naya PENDING follow-up (owner = jisne promise kiya)
   */
  async onCallSaved(
    tx: Prisma.TransactionClient,
    args: {
      customerId: string;
      callId: string;
      staffId: string;
      followUpAt: Date | null;
    },
  ) {
    const open = await tx.followUp.findUnique({
      where: { openCustomerId: args.customerId },
    });
    if (open) {
      await tx.followUp.update({
        where: { id: open.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedByCallId: args.callId,
          openCustomerId: null,
        },
      });
      await this.audit.record(
        {
          actorId: args.staffId,
          action: AuditAction.FOLLOW_UP_COMPLETED,
          entityType: 'follow_up',
          entityId: open.id,
          metadata: {
            customerId: args.customerId,
            callId: args.callId,
            dueAt: open.dueAt.toISOString(),
          },
        },
        tx,
      );
    }

    if (args.followUpAt) {
      const created = await tx.followUp.create({
        data: {
          customerId: args.customerId,
          sourceCallId: args.callId,
          ownerId: args.staffId,
          originalOwnerId: args.staffId,
          dueAt: args.followUpAt,
          openCustomerId: args.customerId,
        },
      });
      await this.audit.record(
        {
          actorId: args.staffId,
          action: AuditAction.FOLLOW_UP_CREATED,
          entityType: 'follow_up',
          entityId: created.id,
          metadata: {
            customerId: args.customerId,
            dueAt: args.followUpAt.toISOString(),
          },
        },
        tx,
      );
    }
  }

  async findAll(
    query: ListFollowUpsQueryDto,
    actor: AuthUser,
  ): Promise<Paginated<FollowUpRow>> {
    const where = await this.buildWhere(query.bucket, actor, query.ownerId);
    const done = query.bucket === 'completed' || query.bucket === 'cancelled';
    const [data, total] = await this.prisma.$transaction([
      this.prisma.followUp.findMany({
        where,
        select: followUpSelect,
        orderBy: done ? { updatedAt: 'desc' } : { dueAt: 'asc' }, // sabse purana due sabse upar
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.followUp.count({ where }),
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

  /** Cards: upcoming / due / overdue / aaj complete (role ke scope me) */
  async summary(actor: AuthUser) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [upcoming, due, overdue, completedToday] = await Promise.all([
      this.prisma.followUp.count({
        where: await this.buildWhere('upcoming', actor),
      }),
      this.prisma.followUp.count({
        where: await this.buildWhere('due', actor),
      }),
      this.prisma.followUp.count({
        where: await this.buildWhere('overdue', actor),
      }),
      this.prisma.followUp.count({
        where: {
          ...(await this.buildWhere('completed', actor)),
          completedAt: { gte: startOfDay },
        },
      }),
    ]);
    return { upcoming, due, overdue, completedToday };
  }

  /** Owner khud ya Manager/TL — naya time (future). Notifications dobara jaayengi. */
  async reschedule(id: string, dueAt: Date, actor: AuthUser) {
    if (dueAt.getTime() <= Date.now())
      throw new BadRequestException('dueAt must be in the future');
    const followUp = await this.findAccessible(id, actor);
    if (followUp.status !== 'PENDING') {
      throw new ConflictException(
        `Follow-up is ${followUp.status} — cannot reschedule`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id },
        data: {
          dueAt,
          reminderSentAt: null,
          dueNotifiedAt: null,
          overdueNotifiedAt: null,
          escalatedAt: null,
        },
        select: followUpSelect,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.FOLLOW_UP_RESCHEDULED,
          entityType: 'follow_up',
          entityId: id,
          changes: {
            dueAt: {
              from: followUp.dueAt.toISOString(),
              to: dueAt.toISOString(),
            },
          },
        },
        tx,
      );
      return updated;
    });
  }

  /** Manager / TL: follow-up kisi aur assistant ko */
  async reassign(id: string, staffId: string, actor: AuthUser) {
    if (actor.role === 'ASSISTANT')
      throw new ForbiddenException(
        'Only managers and team leaders can reassign',
      );
    const followUp = await this.findAccessible(id, actor);
    if (followUp.status !== 'PENDING') {
      throw new ConflictException(
        `Follow-up is ${followUp.status} — cannot reassign`,
      );
    }
    if (followUp.ownerId === staffId)
      throw new BadRequestException('Already owned by this staff');
    const target = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    const scope = await staffScope(this.prisma, actor);
    if (
      !target ||
      !target.isActive ||
      !['ASSISTANT', 'TEAM_LEADER'].includes(target.role) ||
      (scope && !scope.includes(staffId))
    ) {
      throw new BadRequestException(
        'staffId must be an active ASSISTANT / TEAM_LEADER in your scope',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id },
        data: {
          ownerId: staffId,
          dueNotifiedAt: null,
          overdueNotifiedAt: null,
        },
        select: followUpSelect,
      });
      await this.notifications.notify(
        [
          {
            recipientId: staffId,
            type: 'FOLLOW_UP_REASSIGNED',
            title: `Follow-up assigned to you: ${updated.customer.name}`,
            body: `Due ${updated.dueAt.toISOString()} — by ${actor.name}`,
            link: '/follow-ups',
            data: { followUpId: id, customerId: updated.customer.id },
          },
        ],
        tx,
      );
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.FOLLOW_UP_REASSIGNED,
          entityType: 'follow_up',
          entityId: id,
          changes: { ownerId: { from: followUp.ownerId, to: staffId } },
        },
        tx,
      );
      return updated;
    });
  }

  async cancel(id: string, actor: AuthUser) {
    if (actor.role === 'ASSISTANT')
      throw new ForbiddenException('Only managers and team leaders can cancel');
    const followUp = await this.findAccessible(id, actor);
    if (followUp.status !== 'PENDING') {
      throw new ConflictException(
        `Follow-up is ${followUp.status} — cannot cancel`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          openCustomerId: null,
        },
        select: followUpSelect,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.FOLLOW_UP_CANCELLED,
          entityType: 'follow_up',
          entityId: id,
        },
        tx,
      );
      return updated;
    });
  }

  // ---------------- helpers ----------------

  private async findAccessible(id: string, actor: AuthUser) {
    const followUp = await this.prisma.followUp.findUnique({ where: { id } });
    if (!followUp) throw new NotFoundException('Follow-up not found');
    const scope = await staffScope(this.prisma, actor);
    if (scope && !scope.includes(followUp.ownerId)) {
      throw new ForbiddenException('This follow-up is not in your scope');
    }
    return followUp;
  }

  private async buildWhere(
    bucket: FollowUpBucket,
    actor: AuthUser,
    ownerId?: string,
  ): Promise<Prisma.FollowUpWhereInput> {
    const scope = await staffScope(this.prisma, actor);
    const owner = scope
      ? { in: ownerId ? scope.filter((id) => id === ownerId) : scope }
      : ownerId;

    const { gracePeriodMinutes } = await this.callConfig.getFollowUpTiming();
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - gracePeriodMinutes * 60_000);

    const byBucket: Record<FollowUpBucket, Prisma.FollowUpWhereInput> = {
      open: { status: { in: [...OPEN] } },
      upcoming: { status: 'PENDING', dueAt: { gt: now } },
      due: { status: { in: [...OPEN] }, dueAt: { lte: now, gt: graceCutoff } },
      overdue: { status: { in: [...OPEN] }, dueAt: { lte: graceCutoff } },
      completed: { status: 'COMPLETED' },
      cancelled: { status: 'CANCELLED' },
    };
    return { ...byBucket[bucket], ownerId: owner };
  }
}
