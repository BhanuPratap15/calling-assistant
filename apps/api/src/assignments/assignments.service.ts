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
import type { Paginated } from '../common/pagination.dto.js';
import { withUniqueConflict } from '../common/prisma-errors.js';
import { staffScope } from '../common/team-scope.js';
import { Prisma, type AssignmentStatus } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { planDistribution } from './distribution.js';
import type {
  CreateAssignmentDto,
  DistributeDto,
  ListAssignmentsQueryDto,
} from './dto/assignment.dto.js';

const assignmentSelect = {
  id: true,
  status: true,
  source: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  customer: {
    select: { id: true, name: true, phone: true, priority: true, status: true },
  },
  staff: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
} satisfies Prisma.AssignmentSelect;

type AssignmentRow = Prisma.AssignmentGetPayload<{
  select: typeof assignmentSelect;
}>;

const ALREADY_ASSIGNED =
  'Customer already has an open assignment — use reassign instead';

/**
 * Manual assignment (design doc section 9): Manager kisi ko bhi; Team Leader sirf apni team ko.
 * Assistant "Start Calling" pe pehle apni ASSIGNED queue se customer leta hai.
 */
@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(
    query: ListAssignmentsQueryDto,
    actor: AuthUser,
  ): Promise<Paginated<AssignmentRow>> {
    const statuses: AssignmentStatus[] =
      query.status === 'open'
        ? ['ASSIGNED', 'IN_PROGRESS']
        : [query.status as AssignmentStatus];
    const scope = await this.staffScope(actor);
    const where: Prisma.AssignmentWhereInput = {
      status: { in: statuses },
      staffId: scope
        ? {
            in: query.staffId
              ? scope.filter((id) => id === query.staffId)
              : scope,
          }
        : query.staffId,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where,
        select: assignmentSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.assignment.count({ where }),
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

  /** Assign dropdown ke liye: kisko de sakte ho (Manager → sab active ASSISTANT/TL; TL → apni team) */
  async assignableStaff(actor: AuthUser) {
    const scope = await this.staffScope(actor);
    return this.prisma.staff.findMany({
      where: {
        isActive: true,
        role: { in: ['ASSISTANT', 'TEAM_LEADER'] },
        id: scope ? { in: scope } : undefined,
      },
      select: {
        id: true,
        name: true,
        role: true,
        availability: true,
        team: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateAssignmentDto, actor: AuthUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Customer status is ${customer.status} — cannot assign`,
      );
    }
    await this.assertAssignableStaff(dto.staffId, actor);
    if (dto.campaignId) {
      const member = await this.prisma.campaignCustomer.findUnique({
        where: {
          campaignId_customerId: {
            campaignId: dto.campaignId,
            customerId: customer.id,
          },
        },
        include: { campaign: { select: { status: true } } },
      });
      if (!member)
        throw new BadRequestException('Customer is not in this campaign');
      if (member.campaign.status === 'COMPLETED')
        throw new BadRequestException('Campaign is completed');
    }

    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const assignment = await tx.assignment.create({
            data: {
              status: 'ASSIGNED',
              source: 'MANUAL',
              customerId: customer.id,
              staffId: dto.staffId,
              campaignId: dto.campaignId,
              createdById: actor.id,
              openCustomerId: customer.id, // unique → already open ho to P2002 → 409
            },
            select: assignmentSelect,
          });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.ASSIGNMENT_CREATED,
              entityType: 'assignment',
              entityId: assignment.id,
              metadata: {
                customerId: customer.id,
                staffId: dto.staffId,
                source: 'MANUAL',
              },
            },
            tx,
          );
          await this.notifyNew(tx, dto.staffId, customer.name, actor);
          return assignment;
        }),
      ALREADY_ASSIGNED,
    );
  }

  /** Purana open assignment CANCELLED + naya ASSIGNED (naye staff ko) — ek transaction me */
  async reassign(id: string, staffId: string, actor: AuthUser) {
    const old = await this.findOpen(id, actor);
    if (old.staffId === staffId)
      throw new BadRequestException('Already assigned to this staff');
    await this.assertAssignableStaff(staffId, actor);

    return this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id);
      // Follow-up call beech me reassign hua → follow-up naye staff ka, PENDING (track hota rahe)
      await this.releaseFollowUp(tx, old.customerId, staffId);
      await tx.assignment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          openCustomerId: null,
          inProgressStaffId: null,
        },
      });
      const created = await tx.assignment.create({
        data: {
          status: 'ASSIGNED',
          source: 'MANUAL',
          customerId: old.customerId,
          staffId,
          campaignId: old.campaignId, // campaign saath chale
          createdById: actor.id,
          openCustomerId: old.customerId,
        },
        select: assignmentSelect,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.ASSIGNMENT_REASSIGNED,
          entityType: 'assignment',
          entityId: created.id,
          changes: { staffId: { from: old.staffId, to: staffId } },
          metadata: {
            customerId: old.customerId,
            previousAssignmentId: id,
            wasInProgress: old.status === 'IN_PROGRESS',
          },
        },
        tx,
      );
      await this.notifyNew(tx, staffId, created.customer.name, actor);
      return created;
    });
  }

  /** Customer ko wapas pool me chhodo (koi bhi assistant "Start Calling" se le sakta hai) */
  async cancel(id: string, actor: AuthUser) {
    const old = await this.findOpen(id, actor);
    return this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id);
      await this.releaseFollowUp(tx, old.customerId);
      const cancelled = await tx.assignment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          openCustomerId: null,
          inProgressStaffId: null,
        },
        select: assignmentSelect,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.ASSIGNMENT_CANCELLED,
          entityType: 'assignment',
          entityId: id,
          metadata: {
            customerId: old.customerId,
            staffId: old.staffId,
            wasInProgress: old.status === 'IN_PROGRESS',
          },
        },
        tx,
      );
      return cancelled;
    });
  }

  /**
   * BULK DISTRIBUTE (design doc section 9: round-robin / load-based) — ADR 0015.
   *  1) Eligible customers: ACTIVE, kisi ke paas open nahi, open follow-up nahi (+ filters);
   *     campaign diya → us campaign ke abhi tak na call hue; nahi diya → kisi chalu campaign me nahi
   *     (warna campaign ki member restriction bypass) aur default sirf fresh (kabhi call nahi hue)
   *  2) Har staff ka abhi ka open load → planDistribution() (pure, unit-tested)
   *  3) Ek transaction: rows FOR UPDATE SKIP LOCKED (isi pal koi "Start Calling" se le raha ho to wo row skip)
   *     → createManyAndReturn(skipDuplicates) — unique openCustomerId DB-level guarantee
   *  4) Ek audit entry + har assistant ko EK notification ("N customers assigned to you")
   * dryRun → wahi plan, bina save (preview: kisko kitne).
   */
  async distribute(dto: DistributeDto, actor: AuthUser) {
    for (const id of dto.staffIds) await this.assertAssignableStaff(id, actor);
    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: dto.campaignId },
        select: { status: true },
      });
      if (!campaign) throw new NotFoundException('Campaign not found');
      if (campaign.status === 'COMPLETED')
        throw new BadRequestException('Campaign is completed');
    }
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: dto.staffIds } },
      select: { id: true, name: true },
    });
    const names = new Map(staff.map((s) => [s.id, s.name]));

    const run = async (tx: Prisma.TransactionClient) => {
      const customers = await tx.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM customers c
        ${dto.campaignId ? Prisma.sql`JOIN campaign_customers cc ON cc.customer_id = c.id AND cc.campaign_id = ${dto.campaignId}::uuid` : Prisma.empty}
        WHERE c.status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.open_customer_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM follow_ups f WHERE f.open_customer_id = c.id)
          ${
            dto.campaignId
              ? Prisma.sql`AND cc.call_count = 0`
              : Prisma.sql`AND NOT EXISTS (
                  SELECT 1 FROM campaign_customers cc2 JOIN campaigns k ON k.id = cc2.campaign_id
                  WHERE cc2.customer_id = c.id AND k.status <> 'COMPLETED')
                ${dto.onlyFresh ? Prisma.sql`AND c.last_called_at IS NULL` : Prisma.empty}`
          }
          ${dto.categoryId ? Prisma.sql`AND c.category_id = ${dto.categoryId}::uuid` : Prisma.empty}
          ${dto.priority ? Prisma.sql`AND c.priority = ${dto.priority}::priority` : Prisma.empty}
          ${dto.tagId ? Prisma.sql`AND EXISTS (SELECT 1 FROM customer_tags t WHERE t.customer_id = c.id AND t.tag_id = ${dto.tagId}::uuid)` : Prisma.empty}
        ORDER BY c.priority DESC, c.created_at ASC
        LIMIT ${dto.limit}
        ${dto.dryRun ? Prisma.empty : Prisma.sql`FOR UPDATE OF c SKIP LOCKED`}`;

      const loads = await tx.assignment.groupBy({
        by: ['staffId'],
        where: {
          staffId: { in: dto.staffIds },
          status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        },
        _count: { _all: true },
      });
      const loadOf = new Map(loads.map((l) => [l.staffId, l._count._all]));
      const plan = planDistribution(
        customers.map((c) => c.id),
        dto.staffIds.map((id) => ({ id, load: loadOf.get(id) ?? 0 })),
        dto.strategy,
        dto.perStaffLimit,
      );

      let assigned = plan;
      if (!dto.dryRun && plan.length) {
        const created = await tx.assignment.createManyAndReturn({
          data: plan.map((p) => ({
            status: 'ASSIGNED' as const,
            source: 'DISTRIBUTED' as const,
            customerId: p.customerId,
            staffId: p.staffId,
            campaignId: dto.campaignId ?? null,
            createdById: actor.id,
            openCustomerId: p.customerId, // unique → race me bhi duplicate nahi
          })),
          skipDuplicates: true,
          select: { customerId: true, staffId: true },
        });
        assigned = created;
      }

      const perStaff = dto.staffIds.map((id) => ({
        staffId: id,
        name: names.get(id) ?? '',
        currentLoad: loadOf.get(id) ?? 0,
        newCount: assigned.filter((p) => p.staffId === id).length,
      }));
      const summary = {
        strategy: dto.strategy,
        dryRun: dto.dryRun,
        eligible: customers.length,
        assigned: assigned.length,
        perStaff,
      };
      if (dto.dryRun || !assigned.length) return summary;

      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.ASSIGNMENT_DISTRIBUTED,
          entityType: 'assignment',
          metadata: {
            strategy: dto.strategy,
            assigned: assigned.length,
            perStaff: Object.fromEntries(
              perStaff.map((p) => [p.name, p.newCount]),
            ),
            filter: {
              campaignId: dto.campaignId ?? null,
              categoryId: dto.categoryId ?? null,
              tagId: dto.tagId ?? null,
              priority: dto.priority ?? null,
              onlyFresh: dto.campaignId ? null : dto.onlyFresh,
              limit: dto.limit,
              perStaffLimit: dto.perStaffLimit ?? null,
            },
          },
        },
        tx,
      );
      await this.notifications.notify(
        perStaff
          .filter((p) => p.newCount)
          .map((p) => ({
            recipientId: p.staffId,
            type: 'ASSIGNMENT_NEW' as const,
            title: `${p.newCount} customer${p.newCount > 1 ? 's' : ''} assigned to you by ${actor.name}`,
            body: 'They come first when you press Start Calling.',
            link: '/calling',
            data: { count: p.newCount, by: actor.id },
          })),
        tx,
      );
      return summary;
    };

    return dto.dryRun
      ? run(this.prisma as unknown as Prisma.TransactionClient)
      : this.prisma.$transaction(run, { timeout: 30_000 });
  }

  // ---------------- helpers ----------------

  /** Assistant ko "naya customer mila" (design doc section 18: "New assignment") */
  private notifyNew(
    tx: Prisma.TransactionClient,
    staffId: string,
    customerName: string,
    actor: AuthUser,
  ) {
    if (staffId === actor.id) return Promise.resolve(); // TL ne khud ko diya
    return this.notifications.notify(
      [
        {
          recipientId: staffId,
          type: 'ASSIGNMENT_NEW',
          title: `New customer assigned: ${customerName} (by ${actor.name})`,
          body: 'Comes first when you press Start Calling.',
          link: '/calling',
        },
      ],
      tx,
    );
  }

  private staffScope(actor: AuthUser) {
    return staffScope(this.prisma, actor);
  }

  private async assertAssignableStaff(staffId: string, actor: AuthUser) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (
      !staff ||
      !staff.isActive ||
      !['ASSISTANT', 'TEAM_LEADER'].includes(staff.role)
    ) {
      throw new BadRequestException(
        'staffId must be an active ASSISTANT or TEAM_LEADER',
      );
    }
    const scope = await this.staffScope(actor);
    if (scope && !scope.includes(staffId)) {
      throw new ForbiddenException(
        'You can only assign to members of your team',
      );
    }
  }

  private async findOpen(id: string, actor: AuthUser) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (
      assignment.status !== 'ASSIGNED' &&
      assignment.status !== 'IN_PROGRESS'
    ) {
      throw new ConflictException(`Assignment is already ${assignment.status}`);
    }
    const scope = await this.staffScope(actor);
    if (scope && !scope.includes(assignment.staffId)) {
      throw new ForbiddenException('This assignment is not in your team');
    }
    return assignment;
  }

  /** Customer ka IN_PROGRESS follow-up (agar hai) wapas PENDING; newOwnerId diya to owner bhi badlo */
  private async releaseFollowUp(
    tx: Prisma.TransactionClient,
    customerId: string,
    newOwnerId?: string,
  ) {
    await tx.followUp.updateMany({
      where: { openCustomerId: customerId },
      data: {
        status: 'PENDING',
        ...(newOwnerId ? { ownerId: newOwnerId } : {}),
      },
    });
  }

  /** Row lock — assistant isi waqt "Save & Next" kar raha ho to dono ek saath na chalein */
  private async lockOpen(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM assignments
      WHERE id = ${id}::uuid AND status IN ('ASSIGNED', 'IN_PROGRESS')
      FOR UPDATE`;
    if (!rows.length)
      throw new ConflictException('Assignment was just completed or changed');
  }
}
