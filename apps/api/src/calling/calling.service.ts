import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CallConfigService } from '../call-config/call-config.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { customerProfileInclude } from '../customers/customer-profile.js';
import { FollowUpsService } from '../follow-ups/follow-ups.service.js';
import { normalizePhone } from '../common/phone.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CallDirection } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACTIVE_STATUSES } from '../telephony/telephony-rules.js';
import { TelephonyService } from '../telephony/telephony.service.js';
import { validateCustomFields } from '../campaigns/campaign-rules.js';
import { validateCallForm } from './call-form-validation.js';
import type {
  CallFormDto,
  CompleteCallDto,
  LogInboundCallDto,
} from './dto/complete-call.dto.js';
import { releaseAssignment, type ReleasableAssignment } from './release.js';

/** "Exit" (Stop calling) dial / number copy ke BAAD bhi — assistants ko nahi (unhe form bharna hai) */
const CAN_EXIT_AFTER_DIAL: AuthUser['role'][] = ['TEAM_LEADER', 'SUPER_ADMIN'];

const clean = (value?: string) => (value?.trim() ? value.trim() : null);

/**
 * Assistant ka calling workflow (design doc section 5 + 9):
 *   next()     → "Start Calling": ek customer do (pehle se current hai to wahi)
 *   current()  → abhi kaunsa customer khula hai (profile ke saath)
 *   complete() → "Save & Next": validate → call save → assignment complete → agla customer
 *                ("Save & Stop": stop=true → agla customer NAHI, assistant BREAK pe)
 *   release()  → "Stop calling": bina call ke current chhodo (sirf jab dial nahi kiya) — ADR 0015
 *   findInbound() / logInbound() → customer ne khud call kiya (callback): number se dhundo → form save
 */
/** Ek saath kai assistants → unique-constraint takraav pe itni baar dobara (ADR 0014) */
const MAX_PICK_ATTEMPTS = 10;

@Injectable()
export class CallingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly callConfig: CallConfigService,
    private readonly followUps: FollowUpsService,
    private readonly categories: CategoriesService,
    private readonly telephony: TelephonyService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Assistant ka current (IN_PROGRESS) customer — profile ke saath. Nahi hai to null. */
  async current(staffId: string) {
    return this.prisma.assignment.findUnique({
      where: { inProgressStaffId: staffId },
      select: {
        id: true,
        source: true,
        startedAt: true,
        // Campaign: naam + script + custom fields (call form me dikhte hain)
        campaign: {
          select: {
            id: true,
            name: true,
            script: true,
            fields: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
              select: {
                id: true,
                key: true,
                label: true,
                type: true,
                options: true,
                required: true,
              },
            },
          },
        },
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
   * ASSIGNMENT ENGINE (pull) — "Start Calling".
   * Order (ADR 0007 + 0010):
   *   1) already current → wahi
   *   2) MERE due follow-ups (sabse purana pehle)
   *   3) manager / TL ki queue (ASSIGNED)
   *   4) CAMPAIGN queue: active campaigns jinme main member hoon (ya jinke koi member nahi),
   *      campaign priority → customer priority → jo pehle add hua
   *   5) general pool: fresh customers jo kisi chalu campaign me nahi hain
   * Duplicate se bachav:
   *   - SELECT ... FOR UPDATE SKIP LOCKED → ek saath maangne walon ko alag rows
   *   - unique columns (openCustomerId / inProgressStaffId) → DB khud duplicate reject karta hai
   */
  async next(actor: AuthUser) {
    const existing = await this.current(actor.id);
    if (existing) return this.withPresence(actor.id, existing);

    // Race: kai assistants EK SAATH queue ka pehla customer maangein. SKIP LOCKED zyaadatar alag rows
    // deta hai, par jis pal doosre ki transaction commit ho rahi ho, purana snapshot wahi customer dikha
    // sakta hai → unique constraint (P2002) duplicate rokta hai (data hamesha safe).
    // Har P2002 = kisi aur ko customer mil gaya → naya snapshot use chhod deta hai → dobara try.
    // Load test (Phase 9.5): 3 tries kam the — 12 log ek saath pe kuch ko galti se "koi customer nahi".
    for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
      try {
        await this.prisma.$transaction((tx) => this.pickNext(tx, actor));
        break;
      } catch (error) {
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )) {
          throw error;
        }
        if (await this.current(actor.id)) break; // double click: doosri request ne bana diya
        // Thoda random ruk ke (sab ek hi pal me dobara na takrayein)
        await new Promise((r) =>
          setTimeout(r, 5 + Math.random() * 20 * (attempt + 1)),
        );
      }
    }
    return this.withPresence(actor.id, await this.current(actor.id));
  }

  private async pickNext(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
  ): Promise<void> {
    const now = new Date();

    // 2) Due follow-ups (design doc 8.1). Campaign = jis call me promise hua uska campaign.
    const [due] = await tx.$queryRaw<
      { id: string; customer_id: string; campaign_id: string | null }[]
    >`
      SELECT f.id, f.customer_id, sc.campaign_id FROM follow_ups f
      JOIN calls sc ON sc.id = f.source_call_id
      WHERE f.owner_id = ${actor.id}::uuid AND f.status = 'PENDING' AND f.due_at <= ${now}
        AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.open_customer_id = f.customer_id)
      ORDER BY f.due_at ASC
      LIMIT 1
      FOR UPDATE OF f SKIP LOCKED`;
    if (due) {
      await tx.followUp.update({
        where: { id: due.id },
        data: { status: 'IN_PROGRESS' },
      });
      await this.startAssignment(tx, actor, {
        customerId: due.customer_id,
        source: 'FOLLOW_UP',
        followUpId: due.id,
        campaignId: due.campaign_id,
      });
      return;
    }

    // 3) Manager / TL ne jo customers is staff ko diye hain (priority pehle)
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
          startedAt: now,
        },
      });
      return;
    }

    // 4) Campaign queue (design doc section 11). Eligible campaign:
    //    ACTIVE + date window ke andar + (main member / meri team member / koi member nahi)
    //    Customer: is campaign me abhi call nahi hua, ACTIVE, kisi ke paas open nahi, open follow-up nahi
    const me = await tx.staff.findUniqueOrThrow({
      where: { id: actor.id },
      select: { teamId: true },
    });
    const [fromCampaign] = await tx.$queryRaw<
      { campaign_id: string; customer_id: string }[]
    >`
      SELECT cc.campaign_id, cc.customer_id
      FROM campaign_customers cc
      JOIN campaigns k ON k.id = cc.campaign_id
      JOIN customers c ON c.id = cc.customer_id
      WHERE k.status = 'ACTIVE'
        AND (k.starts_at IS NULL OR k.starts_at <= ${now})
        AND (k.ends_at IS NULL OR k.ends_at > ${now})
        AND cc.call_count = 0
        AND c.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.open_customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM follow_ups f WHERE f.open_customer_id = c.id)
        AND (
          (NOT EXISTS (SELECT 1 FROM campaign_staff s WHERE s.campaign_id = k.id)
            AND NOT EXISTS (SELECT 1 FROM campaign_teams t WHERE t.campaign_id = k.id))
          OR EXISTS (SELECT 1 FROM campaign_staff s
                     WHERE s.campaign_id = k.id AND s.staff_id = ${actor.id}::uuid)
          OR EXISTS (SELECT 1 FROM campaign_teams t
                     WHERE t.campaign_id = k.id AND t.team_id = ${me.teamId}::uuid)
        )
      ORDER BY k.priority DESC, c.priority DESC, cc.added_at ASC
      LIMIT 1
      FOR UPDATE OF cc SKIP LOCKED`;
    if (fromCampaign) {
      await this.startAssignment(tx, actor, {
        customerId: fromCampaign.customer_id,
        source: 'AUTO',
        campaignId: fromCampaign.campaign_id,
      });
      return;
    }

    // 5) General pool: ACTIVE, kabhi call nahi hua, kisi ke paas nahi, aur kisi chalu
    //    (non-completed) campaign me nahi — warna campaign ki member restriction bypass ho jaati.
    //    priority DESC = URGENT > HIGH > NORMAL > LOW (enum order), phir purane pehle.
    const [customer] = await tx.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM customers c
      WHERE c.status = 'ACTIVE'
        AND c.last_called_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.open_customer_id = c.id)
        AND NOT EXISTS (
          SELECT 1 FROM campaign_customers cc JOIN campaigns k ON k.id = cc.campaign_id
          WHERE cc.customer_id = c.id AND k.status <> 'COMPLETED'
        )
      ORDER BY c.priority DESC, c.created_at ASC
      LIMIT 1
      FOR UPDATE OF c SKIP LOCKED`;
    if (customer) {
      await this.startAssignment(tx, actor, {
        customerId: customer.id,
        source: 'AUTO',
      });
    }
  }

  /** IN_PROGRESS assignment banao + audit (engine ke saare raaste yahi use karte hain) */
  private async startAssignment(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    args: {
      customerId: string;
      source: 'AUTO' | 'FOLLOW_UP';
      campaignId?: string | null;
      followUpId?: string;
    },
  ) {
    const assignment = await tx.assignment.create({
      data: {
        status: 'IN_PROGRESS',
        source: args.source,
        customerId: args.customerId,
        staffId: actor.id,
        campaignId: args.campaignId ?? null,
        followUpId: args.followUpId,
        openCustomerId: args.customerId,
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
          customerId: args.customerId,
          staffId: actor.id,
          source: args.source,
          campaignId: args.campaignId ?? null,
          followUpId: args.followUpId ?? null,
        },
      },
      tx,
    );
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
        { id: string; customer_id: string; campaign_id: string | null }[]
      >`
        SELECT id, customer_id, campaign_id FROM assignments
        WHERE in_progress_staff_id = ${actor.id}::uuid
        FOR UPDATE`;
      if (!assignment) {
        throw new ConflictException(
          'You have no current customer (it may have been reassigned by a manager)',
        );
      }

      const created = await this.saveCall(
        tx,
        actor,
        {
          customerId: assignment.customer_id,
          assignmentId: assignment.id,
          campaignId: assignment.campaign_id,
          direction: 'OUTBOUND',
        },
        dto,
        rules,
      );
      // Is customer pe kiye dial attempts (provider ki duration / recording) → is call se link
      await this.telephony.linkToCall(tx, assignment.id, created.id);
      await tx.assignment.update({
        where: { id: assignment.id },
        data: {
          status: 'COMPLETED',
          completedAt: created.createdAt,
          openCustomerId: null, // unique "lock" chhodo
          inProgressStaffId: null,
        },
      });
      return created;
    });

    // Call save ho chuka (commit). Campaign ka aakhri customer tha? → manager ko alert (fail ho to bhi call safe)
    if (call.campaignId)
      await this.notifyIfCampaignExhausted(call.campaignId).catch(
        () => undefined,
      );
    // "Save & Stop" → agla customer nahi; assistant BREAK pe (escalation / auto-assign se bahar)
    if (dto.stop) {
      await this.setAvailability(actor.id, 'BREAK');
      return { call, next: null };
    }
    // Ab agla customer — ye fail ho to bhi call safe hai.
    return { call, next: await this.next(actor) };
  }

  /**
   * INCOMING CALL (customer ne khud call kiya — callback). Sirf POORE number se match (phone ya alternate):
   * assistant poori customer list browse na kar paaye, par jo customer line pe hai uska profile dekh sake.
   */
  async findInbound(phoneInput: string) {
    const phone = normalizePhone(phoneInput);
    if (!phone) throw new BadRequestException('Enter a valid phone number');
    return this.prisma.customer.findFirst({
      where: { OR: [{ phone }, { alternatePhone: phone }] },
      include: customerProfileInclude,
    });
  }

  /**
   * Incoming call ka form save — assignment ke bina (assistant ka current customer disturb nahi hota).
   * Wahi rules: mandatory fields, rating → category, open follow-up complete, naya follow-up.
   * Campaign se nahi judta (campaign progress sirf humari outbound calls se).
   * Customer abhi kisi ki calling screen pe khula ho → 409 (do log ek saath form na bharein).
   */
  async logInbound(actor: AuthUser, dto: LogInboundCallDto) {
    const rules = await this.callConfig.getRequiredFields();
    return this.prisma.$transaction(async (tx) => {
      // Customer lock: isi pal engine use kisi ko de raha ho to wo ruk ke aage badhe
      const [customer] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM customers WHERE id = ${dto.customerId}::uuid FOR UPDATE`;
      if (!customer) throw new NotFoundException('Customer not found');
      const open = await tx.assignment.findFirst({
        where: { customerId: customer.id, status: 'IN_PROGRESS' },
        select: { staffId: true, staff: { select: { name: true } } },
      });
      if (open?.staffId === actor.id) {
        throw new ConflictException(
          'This is your current customer — save the call form on the Calling screen instead',
        );
      }
      if (open) {
        throw new ConflictException(
          `${open.staff.name} has this customer open on their Calling screen right now — ask them to save the call`,
        );
      }
      return this.saveCall(
        tx,
        actor,
        {
          customerId: customer.id,
          assignmentId: null,
          campaignId: null,
          direction: 'INBOUND',
        },
        dto,
        rules,
      );
    });
  }

  /**
   * Call form save — outbound (Save & Next) aur inbound (callback) dono ka common hissa:
   * validate → call → customer summary → campaign progress → rating/category → follow-ups → audit.
   * Validation fail → BadRequest (transaction rollback, kuch save nahi).
   */
  private async saveCall(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    target: {
      customerId: string;
      assignmentId: string | null;
      campaignId: string | null;
      direction: CallDirection;
    },
    dto: CallFormDto & { customFields?: Record<string, unknown> },
    rules: Awaited<ReturnType<CallConfigService['getRequiredFields']>>,
  ) {
    // Transaction = ek hi DB connection → queries ek ke baad ek (Promise.all pe pg warning, pg@9 me error)
    const outcome = await tx.callOutcome.findFirst({
      where: { id: dto.outcomeId, isActive: true },
    });
    const nextAction = await tx.nextAction.findFirst({
      where: { id: dto.nextActionId, isActive: true },
    });
    if (!outcome)
      throw new BadRequestException('outcomeId is not an active call outcome');
    if (!nextAction)
      throw new BadRequestException(
        'nextActionId is not an active next action',
      );

    const values = {
      userResponse: clean(dto.userResponse),
      notes: clean(dto.notes),
      interestRating: dto.interestRating ?? null,
      // follow-up date sirf tab save karo jab action ko chahiye
      followUpAt: nextAction.requiresFollowUp ? (dto.followUpAt ?? null) : null,
    };
    const errors = validateCallForm(values, outcome, nextAction, rules);

    // Campaign custom fields (design doc section 6 "Custom Fields") — campaign ke active fields se
    const fieldDefs = target.campaignId
      ? await tx.campaignField.findMany({
          where: { campaignId: target.campaignId },
        })
      : [];
    const custom = validateCustomFields(fieldDefs, dto.customFields);
    errors.push(...custom.errors);
    if (errors.length) {
      // Outbound: next customer release NAHI hoga — current hi khula rahega (design doc section 7)
      throw new BadRequestException(errors);
    }

    const now = new Date();
    const created = await tx.call.create({
      data: {
        customerId: target.customerId,
        staffId: actor.id,
        assignmentId: target.assignmentId,
        direction: target.direction,
        outcomeId: outcome.id,
        nextActionId: nextAction.id,
        ...values,
        campaignId: target.campaignId,
        customFields: Object.keys(custom.clean).length
          ? custom.clean
          : undefined,
      },
      include: {
        outcome: { select: { code: true, label: true } },
        nextAction: { select: { code: true, label: true } },
      },
    });
    await tx.customer.update({
      where: { id: target.customerId },
      data: { lastCalledAt: now, callCount: { increment: 1 } },
    });
    // Campaign progress (customer beech me campaign se hata diya gaya ho to kuch nahi)
    if (target.campaignId) {
      await tx.campaignCustomer.updateMany({
        where: {
          campaignId: target.campaignId,
          customerId: target.customerId,
        },
        data: {
          callCount: { increment: 1 },
          lastCalledAt: now,
          lastOutcomeId: outcome.id,
        },
      });
    }
    // Rating di → latest rating + category engine (category badli to history + priority)
    if (values.interestRating !== null) {
      await this.categories.applyRating(tx, {
        customerId: target.customerId,
        rating: values.interestRating,
        callId: created.id,
        actorId: actor.id,
      });
    }
    // Purana open follow-up complete + (zaroorat ho to) naya follow-up — isi transaction me
    await this.followUps.onCallSaved(tx, {
      customerId: target.customerId,
      callId: created.id,
      staffId: actor.id,
      followUpAt: values.followUpAt,
    });
    await this.audit.record(
      {
        actorId: actor.id,
        action: AuditAction.CALL_COMPLETED,
        entityType: 'call',
        entityId: created.id,
        metadata: {
          customerId: target.customerId,
          direction: target.direction,
          outcome: outcome.code,
          nextAction: nextAction.code,
          interestRating: values.interestRating,
          followUpAt: values.followUpAt?.toISOString() ?? null,
        },
      },
      tx,
    );
    return created;
  }

  /**
   * "Stop calling" — current customer bina call record ke chhodo (shift khatam / break / galti se khula).
   * Dial ho chuka ho to NAHI: baat / attempt hui hai to form bharna zaroori ("No Answer" bhi ek outcome hai),
   * warna Excel wali "data miss" problem wapas aa jaati (design doc section 7).
   * Customer kahan jaata hai: release.ts. Assistant BREAK pe.
   */
  async release(actor: AuthUser, note?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<
        {
          id: string;
          source: ReleasableAssignment['source'];
          customer_id: string;
          staff_id: string;
          campaign_id: string | null;
        }[]
      >`
        SELECT id, source::text AS source, customer_id, staff_id, campaign_id FROM assignments
        WHERE in_progress_staff_id = ${actor.id}::uuid
        FOR UPDATE`;
      if (!row) throw new ConflictException('You have no current customer');
      const dials = await tx.callSession.count({
        where: { assignmentId: row.id },
      });
      // Assistant: dial ke baad form zaroori. TL / Super Admin: kabhi bhi exit (sirf live call ke beech nahi)
      if (dials && !CAN_EXIT_AFTER_DIAL.includes(actor.role)) {
        throw new ConflictException(
          'You already dialled this customer — save the call form (e.g. "No Answer") instead of stopping',
        );
      }
      if (dials) {
        const live = await tx.callSession.count({
          where: { assignmentId: row.id, status: { in: ACTIVE_STATUSES } },
        });
        if (live)
          throw new ConflictException(
            'A call is still in progress — end it before you exit',
          );
      }
      return releaseAssignment(
        tx,
        this.audit,
        {
          id: row.id,
          source: row.source,
          customerId: row.customer_id,
          staffId: row.staff_id,
          campaignId: row.campaign_id,
        },
        {
          actorId: actor.id,
          reason: dials ? 'stopped_after_dial' : 'stopped_by_assistant',
          note,
        },
      );
    });
    await this.setAvailability(actor.id, 'BREAK');
    return { released: true, result };
  }

  private async setAvailability(staffId: string, availability: 'BREAK') {
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { availability, lastSeenAt: new Date() },
    });
  }

  /**
   * Design doc section 18 "Campaign alerts": active campaign ke saare customers call ho gaye
   * (pending = 0) → creator + managers ko EK baar alert. Atomic UPDATE ... RETURNING:
   * do assistants ek saath aakhri calls save karein to bhi alert ek hi baar.
   * Naye customers add / import → marker reset (campaigns.service, imports.service).
   */
  async notifyIfCampaignExhausted(campaignId: string) {
    const [campaign] = await this.prisma.$queryRaw<
      { id: string; name: string; created_by_id: string | null }[]
    >`
      UPDATE campaigns k SET exhausted_notified_at = now()
      WHERE k.id = ${campaignId}::uuid AND k.status = 'ACTIVE' AND k.exhausted_notified_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM campaign_customers cc JOIN customers c ON c.id = cc.customer_id
          WHERE cc.campaign_id = k.id AND cc.call_count = 0 AND c.status = 'ACTIVE')
      RETURNING k.id, k.name, k.created_by_id`;
    if (!campaign) return false;
    const managers = await this.prisma.staff.findMany({
      where: { isActive: true, role: { in: ['MANAGER', 'SUPER_ADMIN'] } },
      select: { id: true },
    });
    const recipients = new Set(managers.map((m) => m.id));
    if (campaign.created_by_id) recipients.add(campaign.created_by_id);
    await this.notifications.notify(
      [...recipients].map((recipientId) => ({
        recipientId,
        type: 'CAMPAIGN_EXHAUSTED' as const,
        title: `Campaign "${campaign.name}": all customers called`,
        body: 'Add more customers or mark the campaign Completed.',
        link: `/campaigns/${campaign.id}`,
        data: { campaignId: campaign.id },
      })),
    );
    return true;
  }
}
