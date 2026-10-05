import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { verifyWebhookSignature } from '../telephony-rules.js';
import {
  CALL_EVENT_TYPES,
  type CallEventType,
  type NormalizedCallEvent,
  type WebhookRequest,
} from '../telephony.types.js';

/**
 * CRM ka apna "generic" webhook format (mock provider + koi bhi provider jo custom webhook bhej sake):
 *   Headers: X-CRM-Timestamp: <unix sec>, X-CRM-Signature: sha256=<hmac>
 *   Body:    { "events": [ { eventId, callId, type, occurredAt, durationSec?, recordingUrl?, reason? } ] }
 *            (ya seedha ek event object)
 */
export function parseSignedJson(
  req: WebhookRequest,
  secret: string | undefined,
): NormalizedCallEvent[] {
  if (!secret)
    throw new UnauthorizedException('Webhook secret is not configured');
  const header = (name: string) => {
    const v = req.headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const check = verifyWebhookSignature({
    secret,
    timestamp: header('x-crm-timestamp'),
    signature: header('x-crm-signature'),
    rawBody: req.rawBody,
    nowSec: Math.floor(Date.now() / 1000),
  });
  if (check !== 'ok')
    throw new UnauthorizedException(`Webhook signature ${check}`);

  const body = req.body as { events?: unknown } | null;
  const list = Array.isArray(body?.events) ? body.events : [body];
  if (!list.length || list.length > 100)
    throw new BadRequestException('1–100 events expected');
  return list.map((raw, i) => toEvent(raw, i));
}

function toEvent(raw: unknown, index: number): NormalizedCallEvent {
  const e = (raw ?? {}) as Record<string, unknown>;
  const bad = (msg: string) =>
    new BadRequestException(`events[${index}]: ${msg}`);
  if (typeof e.callId !== 'string' || !e.callId)
    throw bad('callId is required');
  if (!CALL_EVENT_TYPES.includes(e.type as CallEventType))
    throw bad(`type must be one of ${CALL_EVENT_TYPES.join(', ')}`);
  const occurredAt = e.occurredAt ? new Date(String(e.occurredAt)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw bad('occurredAt is not a date');
  if (
    e.durationSec !== undefined &&
    !(Number.isInteger(e.durationSec) && (e.durationSec as number) >= 0)
  )
    throw bad('durationSec must be a non-negative integer');
  return {
    providerCallId: e.callId,
    eventId:
      typeof e.eventId === 'string' && e.eventId
        ? e.eventId.slice(0, 200)
        : undefined,
    type: e.type as CallEventType,
    occurredAt,
    durationSec: e.durationSec as number | undefined,
    recordingUrl:
      typeof e.recordingUrl === 'string' ? e.recordingUrl : undefined,
    reason: typeof e.reason === 'string' ? e.reason : undefined,
    payload: e,
  };
}
