import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACTIVE_STATUSES, applyEvent } from './telephony-rules.js';
import {
  TELEPHONY_PROVIDER,
  type NormalizedCallEvent,
  type TelephonyProvider,
  type WebhookRequest,
} from './telephony.types.js';

export const sessionSelect = {
  id: true,
  provider: true,
  status: true,
  toNumber: true,
  answeredAt: true,
  endedAt: true,
  durationSec: true,
  recordingUrl: true,
  failReason: true,
  createdAt: true,
} satisfies Prisma.CallSessionSelect;

export interface WebhookResult {
  received: number;
  applied: number; // status / duration / recording badla
  stale: number; // purana ya out-of-order event — save hua, kuch badla nahi
  duplicates: number;
  unknown: number;
}

/**
 * CRM ↔ calling provider (design doc 17). Provider kaun hai, ye service ko pata nahi —
 * sirf TelephonyProvider interface (TELEPHONY_PROVIDER token, module me env se choose hota hai).
 */
@Injectable()
export class TelephonyService implements OnModuleDestroy {
  private readonly logger = new Logger(TelephonyService.name);
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(TELEPHONY_PROVIDER) private readonly provider: TelephonyProvider,
  ) {}

  info() {
    return { provider: this.provider.name, mode: this.provider.mode };
  }

  /**
   * "📞 Call" — sirf apne CURRENT customer ko (assignment engine ka rule yahan bhi).
   * number: 'primary' (default) ya 'alternate'.
   */
  async dial(actor: AuthUser, number: 'primary' | 'alternate' = 'primary') {
    const assignment = await this.prisma.assignment.findUnique({
      where: { inProgressStaffId: actor.id },
      select: {
        id: true,
        customer: { select: { id: true, phone: true, alternatePhone: true } },
      },
    });
    if (!assignment)
      throw new BadRequestException(
        'Start Calling first — you have no current customer',
      );
    const to =
      number === 'alternate'
        ? assignment.customer.alternatePhone
        : assignment.customer.phone;
    if (!to) throw new BadRequestException('Customer has no alternate phone');

    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id: actor.id },
      select: { id: true, name: true, phone: true },
    });

    // Ek waqt ek hi live call (double click / do tabs se do calls nahi)
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM assignments WHERE id = ${assignment.id}::uuid FOR UPDATE`;
      const live = await tx.callSession.findFirst({
        where: { assignmentId: assignment.id, status: { in: ACTIVE_STATUSES } },
        select: { id: true },
      });
      if (live)
        throw new ConflictException(
          'A call is already in progress for this customer',
        );
      const created = await tx.callSession.create({
        data: {
          provider: this.provider.name,
          customerId: assignment.customer.id,
          staffId: actor.id,
          assignmentId: assignment.id,
          toNumber: to,
          status: this.provider.initialStatus,
        },
        select: { id: true },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CALL_DIALED,
          entityType: 'call',
          entityId: created.id,
          metadata: {
            customerId: assignment.customer.id,
            provider: this.provider.name,
            number,
          },
        },
        tx,
      );
      return created;
    });

    // Provider ko network call transaction ke BAHAR (slow API pe DB lock na rahe)
    let result;
    try {
      result = await this.provider.startCall({
        sessionId: session.id,
        to,
        agent: staff,
      });
    } catch (error) {
      const reason = (error as Error).message.slice(0, 200);
      await this.prisma.callSession.update({
        where: { id: session.id },
        data: { status: 'FAILED', endedAt: new Date(), failReason: reason },
      });
      this.logger.error(
        `startCall failed (${this.provider.name})`,
        error as Error,
      );
      throw new BadGatewayException(`Calling provider error: ${reason}`);
    }

    const saved = await this.prisma.callSession.update({
      where: { id: session.id },
      data: { providerCallId: result.providerCallId },
      select: sessionSelect,
    });
    if (result.providerCallId) this.maybeAutoplay(result.providerCallId, to);
    return { session: saved, dialUrl: result.dialUrl ?? null };
  }

  /** Current customer ke dial attempts (calling screen har 2s poll karti hai jab call live ho) */
  async currentSessions(staffId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { inProgressStaffId: staffId },
      select: { id: true },
    });
    if (!assignment) return [];
    return this.prisma.callSession.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: sessionSelect,
    });
  }

  /** Save & Next ke transaction me: is assignment ke attempts → CRM call se link */
  async linkToCall(
    tx: Prisma.TransactionClient,
    assignmentId: string,
    callId: string,
  ) {
    await tx.callSession.updateMany({
      where: { assignmentId, callId: null },
      data: { callId },
    });
  }

  // ---------------- webhooks ----------------

  async handleWebhook(
    providerName: string,
    req: WebhookRequest,
  ): Promise<WebhookResult> {
    if (providerName !== this.provider.name || this.provider.mode !== 'api') {
      throw new BadRequestException(`Provider "${providerName}" is not active`);
    }
    const events = this.provider.parseWebhook(req); // galat signature → 401 yahin
    return this.applyEvents(events);
  }

  /** Har event alag transaction: session row lock → duplicate check → status machine */
  async applyEvents(events: NormalizedCallEvent[]): Promise<WebhookResult> {
    const result: WebhookResult = {
      received: events.length,
      applied: 0,
      stale: 0,
      duplicates: 0,
      unknown: 0,
    };
    for (const event of events) {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const [session] = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM call_sessions
          WHERE provider = ${this.provider.name} AND provider_call_id = ${event.providerCallId}
          FOR UPDATE`;
        if (!session) return 'unknown' as const;

        if (event.eventId) {
          const seen = await tx.callEvent.findUnique({
            where: {
              provider_eventId: {
                provider: this.provider.name,
                eventId: event.eventId,
              },
            },
            select: { id: true },
          });
          if (seen) return 'duplicate' as const;
        }
        const state = await tx.callSession.findUniqueOrThrow({
          where: { id: session.id },
          select: {
            status: true,
            answeredAt: true,
            endedAt: true,
            durationSec: true,
            recordingUrl: true,
          },
        });
        const patch = applyEvent(state, event);
        if (patch)
          await tx.callSession.update({
            where: { id: session.id },
            data: patch,
          });
        await tx.callEvent.create({
          data: {
            sessionId: session.id,
            provider: this.provider.name,
            eventId: event.eventId,
            type: event.type,
            payload: event.payload as Prisma.InputJsonValue,
            applied: patch !== null,
            occurredAt: event.occurredAt,
          },
        });
        return patch ? ('applied' as const) : ('stale' as const);
      });
      if (outcome === 'applied') result.applied++;
      else if (outcome === 'stale') result.stale++;
      else if (outcome === 'duplicate') result.duplicates++;
      else {
        result.unknown++;
        this.logger.warn(
          `Webhook for unknown call ${event.providerCallId} ignored`,
        );
      }
    }
    return result;
  }

  // ---------------- mock autoplay (sirf dev / demo) ----------------

  /**
   * Mock provider + TELEPHONY_MOCK_AUTOPLAY=true → asli provider jaise events khud chalao.
   * Number ka last digit: 0 → no answer, 9 → busy, baaki → baat hui (~6 sec) + recording.
   */
  private maybeAutoplay(providerCallId: string, to: string) {
    if (
      this.provider.name !== 'mock' ||
      this.config.get('TELEPHONY_MOCK_AUTOPLAY') !== 'true'
    )
      return;
    const last = to.slice(-1);
    const plan: [
      number,
      NormalizedCallEvent['type'],
      Partial<NormalizedCallEvent>?,
    ][] =
      last === '0'
        ? [
            [1000, 'ringing'],
            [5000, 'no_answer', { reason: 'Rang out (mock)' }],
          ]
        : last === '9'
          ? [[1500, 'busy', { reason: 'Line busy (mock)' }]]
          : [
              [1000, 'ringing'],
              [3000, 'answered'],
              [9000, 'completed'],
              [
                10000,
                'recording',
                {
                  recordingUrl: `https://recordings.mock.invalid/${providerCallId}.mp3`,
                },
              ],
            ];
    for (const [delay, type, extra] of plan) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void this.applyEvents([
          {
            providerCallId,
            type,
            occurredAt: new Date(),
            eventId: `${providerCallId}-${type}`,
            payload: { mock: true, type },
            ...extra,
          },
        ]).catch((e: Error) => this.logger.error('mock event failed', e));
      }, delay);
      this.timers.add(timer);
    }
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
  }
}
