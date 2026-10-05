import type { CallSessionStatus } from '../generated/prisma/enums.js';

/**
 * Provider-independent telephony contract (design doc 17: "naya provider = CRM rewrite nahi").
 * Naya provider (telecalling.ai) = ek nayi class jo ye interface implement kare + registry me naam.
 */

/** Provider ka event, CRM ki bhasha me (har provider apna format isme badalta hai) */
export type CallEventType =
  | 'ringing'
  | 'answered'
  | 'completed'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'canceled'
  | 'recording'; // recording baad me ready hui (status nahi badalta)

export const CALL_EVENT_TYPES: CallEventType[] = [
  'ringing',
  'answered',
  'completed',
  'no_answer',
  'busy',
  'failed',
  'canceled',
  'recording',
];

export interface NormalizedCallEvent {
  providerCallId: string;
  eventId?: string; // duplicate (provider retry) pakadne ke liye
  type: CallEventType;
  occurredAt: Date;
  durationSec?: number;
  recordingUrl?: string;
  reason?: string;
  payload: Record<string, unknown>; // original (debug)
}

export interface StartCallInput {
  sessionId: string; // CRM ki ID (provider ko "reference" ke roop me bhej sakte hain)
  to: string; // E.164
  agent: { id: string; name: string; phone: string | null };
}

export interface StartCallResult {
  providerCallId?: string; // API provider: unki call ID
  dialUrl?: string; // manual: browser / phone app ko kya kholna hai (tel:...)
}

export interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer; // signature raw bytes pe check hoti hai (parsed JSON pe nahi)
  body: unknown;
}

export interface TelephonyProvider {
  readonly name: string;
  /** manual = CRM sirf number deta hai; api = provider call lagata hai + webhooks bhejta hai */
  readonly mode: 'manual' | 'api';
  /** Pehla status jab session banta hai */
  readonly initialStatus: CallSessionStatus;
  startCall(input: StartCallInput): Promise<StartCallResult>;
  /** Signature verify + body → events. Galat signature → UnauthorizedException */
  parseWebhook(req: WebhookRequest): NormalizedCallEvent[];
}

export const TELEPHONY_PROVIDER = Symbol('TELEPHONY_PROVIDER');
