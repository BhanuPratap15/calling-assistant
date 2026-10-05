import { randomInt, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import type { StaffRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { signWebhook } from '../src/telephony/telephony-rules.js';

/**
 * Phase 7 — calling provider layer (design doc section 17 + ADR 0012).
 * "mock" provider = asli provider jaisa (call ID + signed webhooks). "manual" = tel: link.
 */
const SECRET = 'e2e-webhook-secret';
const ENV_KEYS = [
  'TELEPHONY_PROVIDER',
  'TELEPHONY_WEBHOOK_SECRET',
  'TELEPHONY_MOCK_AUTOPLAY',
];

async function createApp(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true }); // main.ts jaisa
  configureApp(app);
  await app.init();
  return app;
}

describe('Telephony provider layer (e2e)', () => {
  let app: INestApplication;
  let manualApp: INestApplication;
  let prisma: PrismaService;
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-tel-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const block = String(randomInt(1000, 9999));
  const phone = `+9191${block}0001`;
  const alternate = `+9191${block}0002`;

  const http = (a = app) => request(a.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const dial = (who: string, body: object = {}, a = app) =>
    http(a).post('/api/calling/dial').set(as(who)).send(body);
  const sessions = async (who: string) =>
    (await http().get('/api/calling/sessions').set(as(who)).expect(200)).body
      .sessions;
  /** Provider ki taraf se signed webhook */
  const webhook = (
    body: object,
    opts: { secret?: string; ts?: number; provider?: string } = {},
  ) => {
    const raw = JSON.stringify(body);
    const ts = opts.ts ?? Math.floor(Date.now() / 1000);
    return http()
      .post(`/api/telephony/webhooks/${opts.provider ?? 'mock'}`)
      .set('Content-Type', 'application/json')
      .set('X-CRM-Timestamp', String(ts))
      .set(
        'X-CRM-Signature',
        `sha256=${signWebhook(opts.secret ?? SECRET, ts, raw)}`,
      )
      .send(raw);
  };
  let callId: string; // provider ki call ID (mock-...)
  const event = (type: string, extra: object = {}) => ({
    eventId: `${callId}-${type}-${randomUUID().slice(0, 4)}`,
    callId,
    type,
    occurredAt: new Date().toISOString(),
    ...extra,
  });

  beforeAll(async () => {
    app = await createApp({
      TELEPHONY_PROVIDER: 'mock',
      TELEPHONY_WEBHOOK_SECRET: SECRET,
      TELEPHONY_MOCK_AUTOPLAY: 'false', // tests events khud bhejte hain
    });
    manualApp = await createApp({ TELEPHONY_PROVIDER: 'manual' });
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    for (const [n, role] of [
      ['mgr', 'MANAGER'],
      ['a1', 'ASSISTANT'],
      ['a2', 'ASSISTANT'],
    ] as [string, StaffRole][]) {
      ids[n] = (
        await prisma.staff.create({
          data: { name: `Tel ${n}`, email: email(n), role, passwordHash },
        })
      ).id;
      tokens[n] = (
        await http()
          .post('/api/auth/login')
          .send({ email: email(n), password })
      ).body.accessToken;
    }
    ids.customer = (
      await prisma.customer.create({
        data: {
          name: `Tel Customer ${suffix}`,
          phone,
          alternatePhone: alternate,
        },
      })
    ).id;
  });

  afterAll(async () => {
    const staffIds = [ids.mgr, ids.a1, ids.a2];
    const customerIds = [ids.customer, ids.customer2].filter(Boolean);
    await prisma.callSession.deleteMany({
      where: { staffId: { in: staffIds } },
    }); // events cascade
    await prisma.assignment.deleteMany({
      where: {
        OR: [
          { staffId: { in: staffIds } },
          { customerId: { in: customerIds } },
        ],
      },
    });
    await prisma.followUp.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customerCategoryChange.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.call.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: staffIds } } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await manualApp.close();
    await app.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('config tells the UI which provider is active', async () => {
    const res = await http()
      .get('/api/telephony/config')
      .set(as('a1'))
      .expect(200);
    expect(res.body).toEqual({ provider: 'mock', mode: 'api' });
    await http().get('/api/telephony/config').expect(401);
  });

  it('dial needs a current customer (and the right role)', async () => {
    const r = await dial('a1').expect(400);
    expect(r.body.message).toMatch(/Start Calling first/);
    await dial('mgr').expect(403);
    await dial('a1', { number: 'office' }).expect(400);
  });

  it('dial → session INITIATED with provider call ID; second dial while live → 409', async () => {
    await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: ids.customer, staffId: ids.a1 })
      .expect(201);
    const cur = (
      await http().post('/api/calling/next').set(as('a1')).expect(200)
    ).body.current;
    expect(cur.customer.id).toBe(ids.customer);

    const res = await dial('a1').expect(200);
    expect(res.body.dialUrl).toBeNull(); // api provider khud call lagata hai
    expect(res.body.session).toMatchObject({
      provider: 'mock',
      status: 'INITIATED',
      toNumber: phone,
    });
    const row = await prisma.callSession.findUniqueOrThrow({
      where: { id: res.body.session.id },
    });
    expect(row.providerCallId).toMatch(/^mock-/);
    callId = row.providerCallId!;

    const again = await dial('a1').expect(409);
    expect(again.body.message).toBe(
      'A call is already in progress for this customer',
    );
  });

  it('webhook security: no / wrong / old signature → 401, inactive provider → 400', async () => {
    await http()
      .post('/api/telephony/webhooks/mock')
      .send({ callId, type: 'ringing' })
      .expect(401);
    await webhook({ callId, type: 'ringing' }, { secret: 'wrong' }).expect(401);
    const old = await webhook(
      { callId, type: 'ringing' },
      { ts: Math.floor(Date.now() / 1000) - 600 },
    ).expect(401);
    expect(old.body.message).toBe('Webhook signature expired');
    await webhook(
      { callId, type: 'ringing' },
      { provider: 'telecalling' },
    ).expect(400);
    await webhook({ callId, type: 'exploded' }).expect(400);
    expect((await sessions('a1'))[0].status).toBe('INITIATED'); // kuch nahi badla
  });

  it('events: ringing → answered → completed; duplicates and late events change nothing', async () => {
    const ringing = event('ringing');
    expect((await webhook(ringing).expect(200)).body).toEqual({
      received: 1,
      applied: 1,
      stale: 0,
      duplicates: 0,
      unknown: 0,
    });
    // Provider retry (same eventId) → duplicate
    expect((await webhook(ringing).expect(200)).body.duplicates).toBe(1);

    await webhook({
      events: [event('answered'), event('completed', { durationSec: 42 })],
    }).expect(200);
    let [s] = await sessions('a1');
    expect(s).toMatchObject({
      status: 'COMPLETED',
      durationSec: 42,
      recordingUrl: null,
    });
    expect(s.answeredAt).not.toBeNull();

    // Out-of-order "ringing" after completed → saved, but stale
    expect((await webhook(event('ringing')).expect(200)).body.stale).toBe(1);
    // Recording later; non-https link ignored
    await webhook(
      event('recording', { recordingUrl: 'javascript:alert(1)' }),
    ).expect(200);
    await webhook(
      event('recording', { recordingUrl: 'https://rec.example.com/a1.mp3' }),
    ).expect(200);
    [s] = await sessions('a1');
    expect(s).toMatchObject({
      status: 'COMPLETED',
      recordingUrl: 'https://rec.example.com/a1.mp3',
    });

    // Unknown call ID → 200 (provider retry na kare), ignore
    expect(
      (await webhook({ callId: 'mock-nope', type: 'ringing' }).expect(200)).body
        .unknown,
    ).toBe(1);

    const stored = await prisma.callEvent.count({
      where: { session: { providerCallId: callId } },
    });
    expect(stored).toBe(6); // ringing, answered, completed, late ringing, 2× recording
  });

  it('after the call ended, dialing again (alternate number) is allowed', async () => {
    const res = await dial('a1', { number: 'alternate' }).expect(200);
    expect(res.body.session).toMatchObject({
      toNumber: alternate,
      status: 'INITIATED',
    });
    const row = await prisma.callSession.findUniqueOrThrow({
      where: { id: res.body.session.id },
    });
    callId = row.providerCallId!;
    await webhook(event('no_answer', { reason: 'Rang out' })).expect(200);
    const list = await sessions('a1');
    expect(list.map((x: { status: string }) => x.status)).toEqual([
      'NO_ANSWER',
      'COMPLETED',
    ]);
    expect(list[0]).toMatchObject({ durationSec: 0, failReason: 'Rang out' });
    expect(await sessions('a2')).toEqual([]); // doosre assistant ko nahi dikhta
  });

  it('Save & Next links both attempts to the CRM call; profile shows duration + recording', async () => {
    const config = (await http().get('/api/call-config').set(as('a1'))).body;
    const outcome = config.outcomes.find(
      (o: { isConnected: boolean }) => !o.isConnected,
    );
    const action = config.nextActions.find(
      (a: { requiresFollowUp: boolean }) => !a.requiresFollowUp,
    );
    const done = await http()
      .post('/api/calling/complete')
      .set(as('a1'))
      .send({ outcomeId: outcome.id, nextActionId: action.id })
      .expect(200);
    const crmCallId = done.body.call.id;
    expect(
      await prisma.callSession.count({
        where: { callId: crmCallId, customerId: ids.customer },
      }),
    ).toBe(2);

    const profile = (
      await http()
        .get(`/api/customers/${ids.customer}/profile`)
        .set(as('mgr'))
        .expect(200)
    ).body;
    expect(profile.calls[0].telephony).toEqual([
      expect.objectContaining({
        status: 'COMPLETED',
        durationSec: 42,
        recordingUrl: 'https://rec.example.com/a1.mp3',
      }),
      expect.objectContaining({ status: 'NO_ANSWER', toNumber: alternate }),
    ]);
    expect(await sessions('a1')).toEqual(expect.any(Array));

    const audits = await prisma.auditLog.count({
      where: { actorId: ids.a1, action: 'call.dialed' },
    });
    expect(audits).toBe(2);
  });

  it('manual provider: tel: link, DIALED attempts never block, no webhooks', async () => {
    expect(
      (
        await http(manualApp)
          .get('/api/telephony/config')
          .set(as('a2'))
          .expect(200)
      ).body,
    ).toEqual({ provider: 'manual', mode: 'manual' });
    // Yahin banao (beforeAll me nahi): khaali DB me Save & Next ke baad engine
    // ise a1 ko de deta (general pool ka akela fresh customer)
    ids.customer2 = (
      await prisma.customer.create({
        data: { name: `Tel Manual ${suffix}`, phone: `+9191${block}0003` },
      })
    ).id;
    await http(manualApp)
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: ids.customer2, staffId: ids.a2 })
      .expect(201);
    await http(manualApp).post('/api/calling/next').set(as('a2')).expect(200);

    const first = await dial('a2', {}, manualApp).expect(200);
    expect(first.body).toMatchObject({
      dialUrl: `tel:+9191${block}0003`,
      session: { provider: 'manual', status: 'DIALED' },
    });
    await dial('a2', {}, manualApp).expect(200); // redial theek hai
    await request(manualApp.getHttpServer())
      .post('/api/telephony/webhooks/manual')
      .send({})
      .expect(400);
  });
});
