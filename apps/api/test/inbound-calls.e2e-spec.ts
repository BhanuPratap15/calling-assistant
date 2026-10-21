import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import type { StaffRole } from '../src/generated/prisma/enums.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Customer ne khud call kiya (callback): humne call kiya → No Answer → follow-up bana →
 * customer ne baad me call back kiya → koi bhi assistant number se dhoondh ke form save kare.
 */
describe('Inbound calls / callbacks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-inbound-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let outcomes: Record<string, string>; // code → id
  let actions: Record<string, string>;
  // 10-digit Indian mobile, test run ke hisaab se unique
  const base = `9${String(Date.now()).slice(-8)}`;
  const local = (i: number) => `${base}${i}`;
  const customers: { id: string; local: string }[] = [];

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const lookup = (who: string, phone: string) =>
    http().get('/api/calling/inbound').query({ phone }).set(as(who));
  const logInbound = (who: string, body: object) =>
    http().post('/api/calling/inbound').set(as(who)).send(body);
  const connectedForm = {
    userResponse: 'Called back, wants the offer',
    notes: 'Customer called us back after the missed call',
    interestRating: 8,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    const people: [string, StaffRole][] = [
      ['mgr', 'MANAGER'],
      ['a1', 'ASSISTANT'],
      ['a2', 'ASSISTANT'],
    ];
    for (const [name, role] of people) {
      const s = await prisma.staff.create({
        data: { name: `E2E ${name}`, email: email(name), role, passwordHash },
      });
      ids[name] = s.id;
      tokens[name] = (
        await http()
          .post('/api/auth/login')
          .send({ email: email(name), password })
      ).body.accessToken;
    }

    for (let i = 0; i < 2; i++) {
      const c = await prisma.customer.create({
        data: { name: `E2E Inbound ${i} ${suffix}`, phone: `+91${local(i)}` },
      });
      customers.push({ id: c.id, local: local(i) });
    }

    const config = (await http().get('/api/call-config').set(as('a1'))).body;
    outcomes = Object.fromEntries(
      config.outcomes.map((o: { code: string; id: string }) => [o.code, o.id]),
    );
    actions = Object.fromEntries(
      config.nextActions.map((a: { code: string; id: string }) => [
        a.code,
        a.id,
      ]),
    );

    // a1: customer 0 ko call kiya, uthaya nahi → "Call Again" follow-up
    // a2: customer 1 abhi calling screen pe khula hai
    for (const [who, customerId] of [
      ['a1', customers[0].id],
      ['a2', customers[1].id],
    ]) {
      await http()
        .post('/api/assignments')
        .set(as('mgr'))
        .send({ customerId, staffId: ids[who] })
        .expect(201);
      const got = await http().post('/api/calling/next').set(as(who));
      expect(got.body.current.customer.id).toBe(customerId);
    }
    await http()
      .post('/api/calling/complete')
      .set(as('a1'))
      .send({
        outcomeId: outcomes.NO_ANSWER,
        nextActionId: actions.CALL_AGAIN,
        followUpAt: new Date(Date.now() + 3 * 3600_000),
        stop: true,
      })
      .expect(200);
  });

  afterAll(async () => {
    const staffIds = Object.values(ids);
    const customerIds = customers.map((c) => c.id);
    await prisma.assignment.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.followUp.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customerCategoryChange.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.call.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: staffIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  it('finds the customer by the full number in any format (no assignment needed)', async () => {
    const c = customers[0];
    for (const phone of [
      c.local,
      `0${c.local}`,
      `+91 ${c.local.slice(0, 5)} ${c.local.slice(5)}`,
    ]) {
      const res = await lookup('a2', phone).expect(200);
      expect(res.body.customer.id).toBe(c.id);
      expect(res.body.customer.calls).toHaveLength(1); // pichli No Answer call dikhti hai
    }
  });

  it('unknown number → null; invalid number → 400; manager → 403', async () => {
    expect((await lookup('a1', local(9)).expect(200)).body.customer).toBe(null);
    await lookup('a1', '12').expect(400);
    await lookup('mgr', customers[0].local).expect(403);
  });

  it('connected callback still needs the mandatory fields', async () => {
    const res = await logInbound('a2', {
      customerId: customers[0].id,
      outcomeId: outcomes.CONNECTED,
      nextActionId: actions.NO_FURTHER_ACTION,
    }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining(['notes is required']),
    );
  });

  it('another assistant logs the callback: INBOUND call, follow-up closed, own current untouched', async () => {
    const res = await logInbound('a2', {
      customerId: customers[0].id,
      outcomeId: outcomes.INTERESTED,
      nextActionId: actions.NO_FURTHER_ACTION,
      ...connectedForm,
    }).expect(201);
    expect(res.body.call).toMatchObject({
      direction: 'INBOUND',
      assignmentId: null,
      campaignId: null,
      staffId: ids.a2,
      interestRating: 8,
    });

    // a1 ka "Call Again" follow-up isi call se complete — a1 ko dobara call nahi karna
    const followUp = await prisma.followUp.findFirstOrThrow({
      where: { customerId: customers[0].id },
    });
    expect(followUp.status).toBe('COMPLETED');
    expect(followUp.completedByCallId).toBe(res.body.call.id);

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: customers[0].id },
    });
    expect(customer.callCount).toBe(2);
    expect(customer.interestRating).toBe(8);

    // a2 ka apna current customer wahi ka wahi
    const current = (await http().get('/api/calling/current').set(as('a2')))
      .body.current;
    expect(current.customer.id).toBe(customers[1].id);

    const profile = (await lookup('a1', customers[0].local)).body.customer;
    expect(
      profile.calls.map((c: { direction: string }) => c.direction),
    ).toEqual(['INBOUND', 'OUTBOUND']);
  });

  it('a callback can promise a new follow-up', async () => {
    const followUpAt = new Date(Date.now() + 24 * 3600_000).toISOString();
    const res = await logInbound('a1', {
      customerId: customers[0].id,
      outcomeId: outcomes.CONNECTED,
      nextActionId: actions.FOLLOW_UP,
      followUpAt,
      ...connectedForm,
    }).expect(201);
    const followUp = await prisma.followUp.findUniqueOrThrow({
      where: { sourceCallId: res.body.call.id },
    });
    expect(followUp).toMatchObject({ status: 'PENDING', ownerId: ids.a1 });
  });

  it('customer open on a Calling screen → 409 (own: use the call form; other: who has it)', async () => {
    const body = {
      customerId: customers[1].id,
      outcomeId: outcomes.CONNECTED,
      nextActionId: actions.NO_FURTHER_ACTION,
      ...connectedForm,
    };
    const own = await logInbound('a2', body).expect(409);
    expect(own.body.message).toMatch(/your current customer/);
    const other = await logInbound('a1', body).expect(409);
    expect(other.body.message).toMatch(/E2E a2/);
  });

  it('unknown customer → 404', async () => {
    await logInbound('a1', {
      customerId: randomUUID(),
      outcomeId: outcomes.NO_ANSWER,
      nextActionId: actions.NO_FURTHER_ACTION,
    }).expect(404);
  });
});
