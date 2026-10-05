import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CallSessionStatus } from '../generated/prisma/enums.js';
import type { CallEventType } from './telephony.types.js';

/**
 * Telephony rules — PURE functions (unit tests: telephony-rules.spec.ts)
 */

// ---------- Status machine ----------
// Webhooks out-of-order / duplicate aa sakte hain → status sirf "aage" badhta hai, terminal kabhi nahi badalta.
const RANK: Record<CallSessionStatus, number> = {
  DIALED: 0,
  INITIATED: 0,
  RINGING: 1,
  ANSWERED: 2,
  COMPLETED: 3,
  NO_ANSWER: 3,
  BUSY: 3,
  FAILED: 3,
  CANCELED: 3,
};

const STATUS_FOR: Record<
  Exclude<CallEventType, 'recording'>,
  CallSessionStatus
> = {
  ringing: 'RINGING',
  answered: 'ANSWERED',
  completed: 'COMPLETED',
  no_answer: 'NO_ANSWER',
  busy: 'BUSY',
  failed: 'FAILED',
  canceled: 'CANCELED',
};

export const ACTIVE_STATUSES: CallSessionStatus[] = [
  'INITIATED',
  'RINGING',
  'ANSWERED',
];

export function isTerminal(status: CallSessionStatus): boolean {
  return RANK[status] === 3;
}

export interface SessionState {
  status: CallSessionStatus;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSec: number | null;
  recordingUrl: string | null;
}

export interface EventInput {
  type: CallEventType;
  occurredAt: Date;
  durationSec?: number;
  recordingUrl?: string;
  reason?: string;
}

/**
 * Event ko session pe lagao. `null` = kuch nahi badla (purana / out-of-order event).
 * Recording + duration terminal ke baad bhi aa sakte hain (providers aksar alag event me bhejte hain).
 */
export function applyEvent(
  state: SessionState,
  event: EventInput,
): (Partial<SessionState> & { failReason?: string }) | null {
  const patch: Partial<SessionState> & { failReason?: string } = {};
  const recording = safeRecordingUrl(event.recordingUrl);
  if (recording && recording !== state.recordingUrl)
    patch.recordingUrl = recording;
  if (
    event.durationSec !== undefined &&
    Number.isInteger(event.durationSec) &&
    event.durationSec >= 0 &&
    state.durationSec === null
  ) {
    patch.durationSec = event.durationSec;
  }

  if (event.type !== 'recording') {
    const next = STATUS_FOR[event.type];
    if (RANK[next] > RANK[state.status]) {
      patch.status = next;
      if (next === 'ANSWERED') patch.answeredAt = event.occurredAt;
      if (RANK[next] === 3) {
        patch.endedAt = event.occurredAt;
        if (next !== 'COMPLETED' && event.reason)
          patch.failReason = event.reason.slice(0, 200);
        // Duration nahi bheji to answered → ended se nikaal lo
        if (patch.durationSec === undefined && state.durationSec === null) {
          const answered = patch.answeredAt ?? state.answeredAt;
          patch.durationSec =
            next === 'COMPLETED' && answered
              ? Math.max(
                  0,
                  Math.round(
                    (event.occurredAt.getTime() - answered.getTime()) / 1000,
                  ),
                )
              : 0;
        }
      }
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/** Sirf https recording link (javascript: / http: wale UI me link nahi banenge — XSS / mixed content) */
export function safeRecordingUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && url.length <= 2000
      ? u.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

// ---------- Webhook signature (HMAC-SHA256) ----------
// signature = hex( HMAC_SHA256(secret, "<timestamp>.<raw body>") )
// timestamp bhi sign hota hai → purana request dobara bhejna (replay) 5 min baad kaam nahi karega.
export const MAX_WEBHOOK_AGE_SEC = 300;

export function signWebhook(
  secret: string,
  timestamp: number,
  rawBody: Buffer | string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
}

export function verifyWebhookSignature(args: {
  secret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: Buffer;
  nowSec: number;
}): 'ok' | 'missing' | 'expired' | 'invalid' {
  const { secret, timestamp, signature, rawBody, nowSec } = args;
  if (!timestamp || !signature) return 'missing';
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSec - ts) > MAX_WEBHOOK_AGE_SEC)
    return 'expired';
  const expected = Buffer.from(signWebhook(secret, ts, rawBody), 'hex');
  const given = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  // timingSafeEqual: compare me lagne wala time se secret guess na ho sake
  return given.length === expected.length && timingSafeEqual(given, expected)
    ? 'ok'
    : 'invalid';
}
