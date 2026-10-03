import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CallConfigService } from '../call-config/call-config.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { customerProfileInclude } from '../customers/customer-profile.js';
import { FollowUpsService } from '../follow-ups/follow-ups.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validateCallForm } from './call-form-validation.js';
import type { CompleteCallDto } from './dto/complete-call.dto.js';

const clean = (value?: string) => (value?.trim() ? value.trim() : null);

/**
 * Assistant ka calling workflow (design doc section 5 + 9):
 *   next()     → "Start Calling": ek customer do (pehle se current hai to wahi)
 *   current()  → abhi kaunsa customer khula hai (profile ke saath)
 *   complete() → "Save & Next": validate → call save → assignment complete → agla customer
 */
@Injectable()
export class CallingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly callConfig: CallConfigService,
    private readonly followUps: FollowUpsService,
    private readonly categories: CategoriesService,
  ) {}

  /** Assistant ka current (IN_PROGRESS) customer — profile ke saath. Nahi hai to null. */
  async current(staffId: string) {
    return this.prisma.assignment.findUnique({
      where: { inProgressStaffId: staffId },
      select: {
        id: true,
        source: true,
        startedAt: true,
        // Follow-up call ho to: kab ka promise tha, kisne kiya, customer ne kya kaha tha
        followUp: {
          select: {
            id: true,
            dueAt: true,
            escalationCount: true,
            originalOwner: { select: { id: true, name: true } },
            sourceCall: { select: { userResponse: true, notes: true } },
          },
        },
        customer: { include: customerProfileInclude },
      },
    });
  }

  /**
   * ASSIGNMENT ENGINE (pull).
   * Order: 1) already current → wahi  2) MERE due follow-ups (sabse purana pehle)
   *        3) manager ki queue (ASSIGNED)  4) naya eligible customer
   * Duplicate se bachav:
   *   - SELECT ... FOR UPDATE SKIP LOCKED → do assistants ek saath maangein to alag rows milti hain
   *   - unique columns (openCustomerId / inProgressStaffId) → DB khud duplicate reject karta hai
   */
  async next(actor: AuthUser) {
    const existing = await this.current(actor.id);
    if (existing) return this.withPresence(actor.id, existing);

    try {
      await this.prisma.$transaction(async (tx) => {
        // 2) Due follow-ups (design doc 8.1: "4:00 PM follow-up becomes due → Amit receives it")
        //    Customer kisi aur ke paas khula ho to skip.
        const [due] = await tx.$queryRaw<{ id: string; customer_id: string }[]>`
          SELECT f.id, f.customer_id FROM follow_ups f
          WHERE f.owner_id = ${actor.id}::uuid AND f.status = 'PENDING' AND f.due_at <= ${new Date()}
            AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.open_customer_id = f.customer_id)
          ORDER BY f.due_at ASC
          LIMIT 1
          FOR UPDATE OF f SKIP LOCKED`;
        if (due) {
          await tx.followUp.update({
            where: { id: due.id },
            data: { status: 'IN_PROGRESS' },
          });
          const assignment = await tx.assignment.create({
            data: {
              status: 'IN_PROGRESS',
              source: 'FOLLOW_UP',
              customerId: due.customer_id,
              staffId: actor.id,
              followUpId: due.id,
              openCustomerId: due.customer_id,
              inProgressStaffId: actor.id,
              startedAt: new Date(),
            },
          });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.ASSIGNMENT_CREATED,
              entityType: 'assignment',
              entityId: assignment.id,
              metadata: {
                customerId: due.customer_id,
                staffId: actor.id,
                source: 'FOLLOW_UP',
                followUpId: due.id,
              },
            },
            tx,
          );
          return;
        }

        // 3) Manager/TL ne jo customers is staff ko diye hain (priority pehle)
        const [queued] = await tx.$queryRaw<{ id: string }[]>`
          SELECT a.id FROM assignments a
          JOIN customers c ON c.id = a.customer_id
          WHERE a.staff_id = ${actor.id}::uuid AND a.status = 'ASSIGNED'
          ORDER BY c.priority DESC, a.created_at ASC
          LIMIT 1
          FOR UPDATE OF a SKIP LOCKED`;
        if (queued) {
          await tx.assignment.update({
            where: { id: queued.id },
            data: {
              status: 'IN_PROGRESS',
              inProgressStaffId: actor.id,
              startedAt: new Date(),
            },
          });
          return;
        }

        // 3) Fresh customer: ACTIVE, kabhi call nahi hua, kisi ke paas assigned nahi.
        //    priority DESC = URGENT > HIGH > NORMAL > LOW (enum order), phir purane pehle.
        //    (Dobara call karna = follow-up, Phase 3)
        const [customer] = await tx.$queryRaw<{ id: string }[]>`
          SELECT c.id FROM customers c
          WHERE c.status = 'ACTIVE'
            AND c.last_called_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM assignments a WHERE a.open_customer_id = c.id
            )
          ORDER BY c.priority DESC, c.created_at ASC
          LIMIT 1
          FOR UPDATE OF c SKIP LOCKED`;
        if (!customer) return; // koi customer bacha hi nahi

        const assignment = await tx.assignment.create({
          data: {
            status: 'IN_PROGRESS',
            source: 'AUTO',
            customerId: customer.id,
            staffId: actor.id,
            openCustomerId: customer.id,
            inProgressStaffId: actor.id,
            startedAt: new Date(),
          },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.ASSIGNMENT_CREATED,
            entityType: 'assignment',
            entityId: assignment.id,
            metadata: {
              customerId: customer.id,
              staffId: actor.id,
              source: 'AUTO',
            },
          },
          tx,
        );
      });
    } catch (error) {
      // Race: isi staff ki doosri request (double click) ne pehle current bana diya → wahi lo
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )) {
        throw error;
      }
    }
    return this.withPresence(actor.id, await this.current(actor.id));
  }

  /**
   * Availability auto: customer khula → ON_CALL; kuch nahi mila → AVAILABLE.
   * (BREAK/OFFLINE wala "Start Calling" dabaye to wo kaam pe aa gaya.) Audit nahi — bahut noisy.
   */
  private async withPresence<T>(
    staffId: string,
    current: T | null,
  ): Promise<T | null> {
    const target = current ? 'ON_CALL' : 'AVAILABLE';
    await this.prisma.staff.updateMany({
      where: { id: staffId, availability: { not: target } },
      data: { availability: target, lastSeenAt: new Date() },
    });
    return current;
  }

  /** SAVE & NEXT — sab ek transaction me; fail hua to kuch bhi save nahi */
  async complete(actor: AuthUser, dto: CompleteCallDto) {
    const rules = await this.callConfig.getRequiredFields();

    const call = await this.prisma.$transaction(async (tx) => {
      // Current assignment ko lock karo (manager isi waqt reassign na kar de)
      const [assignment] = await tx.$queryRaw<
        { id: string; customer_id: string }[]
      >`
        SELECT id, customer_id FROM assignments
        WHERE in_progress_staff_id = ${actor.id}::uuid
        FOR UPDATE`;
      if (!assignment) {
        throw new ConflictException(
          'You have no current customer (it may have been reassigned by a manager)',
        );
      }

      const [outcome, nextAction] = await Promise.all([
        tx.callOutcome.findFirst({
          where: { id: dto.outcomeId, isActive: true },
        }),
        tx.nextAction.findFirst({
          where: { id: dto.nextActionId, isActive: true },
        }),
      ]);
      if (!outcome)
        throw new BadRequestException(
          'outcomeId is not an active call outcome',
        );
      if (!nextAction)
        throw new BadRequestException(
          'nextActionId is not an active next action',
        );

      const values = {
        userResponse: clean(dto.userResponse),
        notes: clean(dto.notes),
        interestRating: dto.interestRating ?? null,
        // follow-up date sirf tab save karo jab action ko chahiye
        followUpAt: nextAction.requiresFollowUp
          ? (dto.followUpAt ?? null)
          : null,
      };
      const errors = validateCallForm(values, outcome, nextAction, rules);
      if (errors.length) {
        // Next customer release NAHI hoga — current hi khula rahega (design doc section 7)
        throw new BadRequestException(errors);
      }

      const now = new Date();
      const created = await tx.call.create({
        data: {
          customerId: assignment.customer_id,
          staffId: actor.id,
          assignmentId: assignment.id,
          outcomeId: outcome.id,
          nextActionId: nextAction.id,
          ...values,
        },
        include: {
          outcome: { select: { code: true, label: true } },
          nextAction: { select: { code: true, label: true } },
        },
      });
      await tx.customer.update({
        where: { id: assignment.customer_id },
        data: { lastCalledAt: now, callCount: { increment: 1 } },
      });
      // Rating di → latest rating + category engine (category badli to history + priority)
      if (values.interestRating !== null) {
        await this.categories.applyRating(tx, {
          customerId: assignment.customer_id,
          rating: values.interestRating,
          callId: created.id,
          actorId: actor.id,
        });
      }
      // Purana open follow-up complete + (zaroorat ho to) naya follow-up — isi transaction me
      await this.followUps.onCallSaved(tx, {
        customerId: assignment.customer_id,
        callId: created.id,
        staffId: actor.id,
        followUpAt: values.followUpAt,
      });
      await tx.assignment.update({
        where: { id: assignment.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          openCustomerId: null, // unique "lock" chhodo
          inProgressStaffId: null,
        },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CALL_COMPLETED,
          entityType: 'call',
          entityId: created.id,
          metadata: {
            customerId: assignment.customer_id,
            outcome: outcome.code,
            nextAction: nextAction.code,
            interestRating: values.interestRating,
            followUpAt: values.followUpAt?.toISOString() ?? null,
          },
        },
        tx,
      );
      return created;
    });

    // Call save ho chuka (commit). Ab agla customer — ye fail ho to bhi call safe hai.
    return { call, next: await this.next(actor) };
  }
}
