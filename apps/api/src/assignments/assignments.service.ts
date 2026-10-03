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
import type { AssignmentStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateAssignmentDto,
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

    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const assignment = await tx.assignment.create({
            data: {
              status: 'ASSIGNED',
              source: 'MANUAL',
              customerId: customer.id,
              staffId: dto.staffId,
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
      return created;
    });
  }

  /** Customer ko wapas pool me chhodo (koi bhi assistant "Start Calling" se le sakta hai) */
  async cancel(id: string, actor: AuthUser) {
    const old = await this.findOpen(id, actor);
    return this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id);
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

  // ---------------- helpers ----------------

  /** Team Leader → sirf apni teams ke members ke IDs; Manager/Super Admin → null (sab) */
  private async staffScope(actor: AuthUser): Promise<string[] | null> {
    if (actor.role !== 'TEAM_LEADER') return null;
    const members = await this.prisma.staff.findMany({
      where: { team: { leaderId: actor.id } },
      select: { id: true },
    });
    return [actor.id, ...members.map((m) => m.id)];
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
