import { UnauthorizedException } from '@nestjs/common';
import { ManualProvider } from './providers/manual.provider.js';
import { parseSignedJson } from './providers/signed-json.js';
import {
  applyEvent,
  isTerminal,
  safeRecordingUrl,
  signWebhook,
  verifyWebhookSignature,
  type SessionState,
} from './telephony-rules.js';

const t = (sec: number) => new Date(Date.UTC(2026, 9, 5, 10, 0, sec));
const fresh: SessionState = {
  status: 'INITIATED',
  answeredAt: null,
  endedAt: null,
  durationSec: null,
  recordingUrl: null,
};

describe('applyEvent (status machine)', () => {
  it('moves forward: ringing → answered → completed (duration from timestamps)', () => {
    const ringing = {
      ...fresh,
      ...applyEvent(fresh, { type: 'ringing', occurredAt: t(1) }),
    };
    expect(ringing.status).toBe('RINGING');
    const answered = {
      ...ringing,
      ...applyEvent(ringing, { type: 'answered', occurredAt: t(5) }),
    };
    expect(answered).toMatchObject({ status: 'ANSWERED', answeredAt: t(5) });
    const done = applyEvent(answered, { type: 'completed', occurredAt: t(50) });
    expect(done).toEqual({
      status: 'COMPLETED',
      endedAt: t(50),
      durationSec: 45,
    });
  });

  it('uses provider duration when given; no answer → 0 sec + reason', () => {
    expect(
      applyEvent(fresh, {
        type: 'completed',
        occurredAt: t(9),
        durationSec: 7,
      }),
    ).toEqual({
      status: 'COMPLETED',
      endedAt: t(9),
      durationSec: 7,
    });
    expect(
      applyEvent(fresh, {
        type: 'no_answer',
        occurredAt: t(30),
        reason: 'Rang 30s',
      }),
    ).toEqual({
      status: 'NO_ANSWER',
      endedAt: t(30),
      durationSec: 0,
      failReason: 'Rang 30s',
    });
  });

  it('never goes backwards; terminal is final (out-of-order webhooks)', () => {
    const done: SessionState = {
      ...fresh,
      status: 'COMPLETED',
      durationSec: 10,
      endedAt: t(20),
    };
    expect(applyEvent(done, { type: 'ringing', occurredAt: t(2) })).toBeNull();
    expect(applyEvent(done, { type: 'failed', occurredAt: t(30) })).toBeNull();
    const answered: SessionState = { ...fresh, status: 'ANSWERED' };
    expect(
      applyEvent(answered, { type: 'ringing', occurredAt: t(3) }),
    ).toBeNull();
    expect(isTerminal('NO_ANSWER')).toBe(true);
    expect(isTerminal('RINGING')).toBe(false);
  });

  it('recording can arrive after the call ended; only https links are kept', () => {
    const done: SessionState = {
      ...fresh,
      status: 'COMPLETED',
      durationSec: 10,
    };
    expect(
      applyEvent(done, {
        type: 'recording',
        occurredAt: t(60),
        recordingUrl: 'https://rec.example/1.mp3',
      }),
    ).toEqual({ recordingUrl: 'https://rec.example/1.mp3' });
    expect(
      applyEvent(done, {
        type: 'recording',
        occurredAt: t(60),
        recordingUrl: 'javascript:alert(1)',
      }),
    ).toBeNull();
    expect(safeRecordingUrl('http://rec.example/1.mp3')).toBeUndefined();
    expect(safeRecordingUrl('not a url')).toBeUndefined();
  });
});

describe('webhook signature', () => {
  const secret = 'test-secret';
  const body = Buffer.from('{"callId":"x","type":"ringing"}');
  const now = 1_790_000_000;

  it('accepts a correct signature (with or without sha256= prefix)', () => {
    const sig = signWebhook(secret, now, body);
    for (const signature of [sig, `sha256=${sig}`]) {
      expect(
        verifyWebhookSignature({
          secret,
          timestamp: String(now),
          signature,
          rawBody: body,
          nowSec: now + 10,
        }),
      ).toBe('ok');
    }
  });

  it('rejects missing, tampered, wrong secret and replayed (old) requests', () => {
    const sig = signWebhook(secret, now, body);
    const base = {
      secret,
      timestamp: String(now),
      signature: sig,
      rawBody: body,
      nowSec: now,
    };
    expect(verifyWebhookSignature({ ...base, signature: undefined })).toBe(
      'missing',
    );
    expect(
      verifyWebhookSignature({
        ...base,
        rawBody: Buffer.from('{"callId":"y"}'),
      }),
    ).toBe('invalid');
    expect(verifyWebhookSignature({ ...base, secret: 'other' })).toBe(
      'invalid',
    );
    expect(verifyWebhookSignature({ ...base, signature: 'zz' })).toBe(
      'invalid',
    );
    expect(verifyWebhookSignature({ ...base, nowSec: now + 301 })).toBe(
      'expired',
    );
  });
});

describe('providers', () => {
  it('manual: tel: link, no webhooks', async () => {
    const p = new ManualProvider();
    expect(
      await p.startCall({
        sessionId: 's',
        to: '+919876543210',
        agent: { id: 'a', name: 'A', phone: null },
      }),
    ).toEqual({ dialUrl: 'tel:+919876543210' });
    expect(() => p.parseWebhook()).toThrow();
  });

  it('signed JSON parser validates signature and event shape', () => {
    const now = Math.floor(Date.now() / 1000);
    const make = (body: object, secret = 's3') => {
      const raw = Buffer.from(JSON.stringify(body));
      return {
        headers: {
          'x-crm-timestamp': String(now),
          'x-crm-signature': signWebhook(secret, now, raw),
        },
        rawBody: raw,
        body,
      };
    };
    const events = parseSignedJson(
      make({
        events: [
          { eventId: 'e1', callId: 'c1', type: 'completed', durationSec: 12 },
        ],
      }),
      's3',
    );
    expect(events[0]).toMatchObject({
      providerCallId: 'c1',
      eventId: 'e1',
      type: 'completed',
      durationSec: 12,
    });
    expect(() =>
      parseSignedJson(make({ callId: 'c1', type: 'ringing' }, 'wrong'), 's3'),
    ).toThrow(UnauthorizedException);
    expect(() =>
      parseSignedJson(make({ callId: 'c1', type: 'ringing' }), undefined),
    ).toThrow('not configured');
    expect(() =>
      parseSignedJson(make({ callId: 'c1', type: 'exploded' }), 's3'),
    ).toThrow('type must be');
    expect(() => parseSignedJson(make({ type: 'ringing' }), 's3')).toThrow(
      'callId is required',
    );
    expect(() =>
      parseSignedJson(
        make({ callId: 'c', type: 'completed', durationSec: -1 }),
        's3',
      ),
    ).toThrow('durationSec');
  });
});
