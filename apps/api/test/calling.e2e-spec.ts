import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import type { StaffRole } from '../src/generated/prisma/enums.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Calling workflow + assignments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-call-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let outcomes: Record<string, string>; // code → id
  let actions: Record<string, string>;
  const customerIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const next = (who: string) => http().post('/api/calling/next').set(as(who));
  const complete = (who: string, body: object) =>
    http().post('/api/calling/complete').set(as(who)).send(body);

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
      ['tl', 'TEAM_LEADER'],
      ...['a1', 'a2', 'a3', 'a4', 'a5', 'other'].map(
        (n): [string, StaffRole] => [n, 'ASSISTANT'],
      ),
    ];
    for (const [name, role] of people) {
      const s = await prisma.staff.create({
        data: { name: `E2E ${name}`, email: email(name), role, passwordHash },
      });
      ids[name] = s.id;
    }
    // TL ki team: a1 + a2 (other = team se bahar)
    const team = await prisma.team.create({
      data: { name: `E2E Calling ${suffix}`, leaderId: ids.tl },
    });
    ids.team = team.id;
    await prisma.staff.updateMany({
      where: { id: { in: [ids.a1, ids.a2] } },
      data: { teamId: team.id },
    });

    for (const [name] of people) {
      tokens[name] = (
        await http()
          .post('/api/auth/login')
          .send({ email: email(name), password })
      ).body.accessToken;
    }

    // URGENT test customers → engine inhe pehle uthayega
    for (let i = 0; i < 9; i++) {
      const c = await prisma.customer.create({
        data: {
          name: `E2E Cust ${i} ${suffix}`,
          phone: `+97155${String(Date.now()).slice(-6)}${i}`,
          priority: 'URGENT',
        },
      });
      customerIds.push(c.id);
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
  });

  afterAll(async () => {
    const staffIds = Object.entries(ids)
      .filter(([k]) => k !== 'team')
      .map(([, v]) => v);
    // Order zaroori hai (foreign keys): assignments → follow-ups → calls → customers
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
    await prisma.call.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: staffIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.staff.updateMany({
      where: { id: { in: staffIds } },
      data: { teamId: null },
    });
    await prisma.team.delete({ where: { id: ids.team } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  it('no current customer before Start Calling', async () => {
    const res = await http()
      .get('/api/calling/current')
      .set(as('a1'))
      .expect(200);
    expect(res.body.current).toBeNull();
  });

  it('5 assistants press Start Calling AT THE SAME TIME → 5 different customers', async () => {
    const results = await Promise.all(
      ['a1', 'a2', 'a3', 'a4', 'a5'].map((w) => next(w)),
    );
    const got = results.map((r) => {
      expect(r.status).toBe(200);
      return r.body.current.customer.id as string;
    });
    expect(new Set(got).size).toBe(5); // koi duplicate nahi
    results.forEach((r) =>
      expect(r.body.current.customer.priority).toBe('URGENT'),
    );
  });

  it('Start Calling again (even double-click) returns the SAME current customer', async () => {
    const before = (await http().get('/api/calling/current').set(as('a1'))).body
      .current;
    const [r1, r2] = await Promise.all([next('a1'), next('a1')]);
    expect(r1.body.current.id).toBe(before.id);
    expect(r2.body.current.id).toBe(before.id);
  });

  it('Connected call without required fields → 400, customer stays open', async () => {
    const before = (await http().get('/api/calling/current').set(as('a1'))).body
      .current;
    const res = await complete('a1', {
      outcomeId: outcomes.CONNECTED,
      nextActionId: actions.NO_FURTHER_ACTION,
    }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'notes is required',
        'interestRating is required',
      ]),
    );
    const after = (await http().get('/api/calling/current').set(as('a1'))).body
      .current;
    expect(after.id).toBe(before.id);
  });

  it('follow-up action needs a future date/time', async () => {
    const base = {
      outcomeId: outcomes.NO_ANSWER,
      nextActionId: actions.CALL_AGAIN,
    };
    await complete('a1', base).expect(400);
    await complete('a1', {
      ...base,
      followUpAt: new Date(Date.now() - 60_000),
    }).expect(400);
  });

  let firstCallCustomer: string;

  it('Save & Next saves the call and releases the NEXT customer', async () => {
    const current = (await http().get('/api/calling/current').set(as('a1')))
      .body.current;
    firstCallCustomer = current.customer.id;
    const followUpAt = new Date(Date.now() + 6 * 3600_000).toISOString();

    const res = await complete('a1', {
      outcomeId: outcomes.CONNECTED,
      nextActionId: actions.FOLLOW_UP,
      userResponse: 'Call me at 4 PM',
      notes: 'Interested in VIP program',
      interestRating: 9,
      followUpAt,
    }).expect(200);

    expect(res.body.call).toMatchObject({
      interestRating: 9,
      followUpAt,
      outcome: { code: 'CONNECTED' },
      nextAction: { code: 'FOLLOW_UP' },
    });
    expect(res.body.current.customer.id).not.toBe(firstCallCustomer); // agla customer

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: firstCallCustomer },
    });
    expect(customer.callCount).toBe(1);
    expect(customer.lastCalledAt).not.toBeNull();
    const assignment = await prisma.assignment.findUniqueOrThrow({
      where: { id: current.id },
    });
    expect(assignment.status).toBe('COMPLETED');
    expect(assignment.openCustomerId).toBeNull();
  });

  it('called customer is NOT handed out again by the engine', async () => {
    const all = await prisma.assignment.findMany({
      where: { customerId: firstCallCustomer },
    });
    expect(all).toHaveLength(1);
  });

  it('360° profile: manager sees history; assistant only own current customer', async () => {
    const profile = await http()
      .get(`/api/customers/${firstCallCustomer}/profile`)
      .set(as('mgr'))
      .expect(200);
    expect(profile.body.calls[0]).toMatchObject({
      notes: 'Interested in VIP program',
      staff: { id: ids.a1 },
      outcome: { label: 'Connected' },
    });

    const a2Current = (await http().get('/api/calling/current').set(as('a2')))
      .body.current;
    await http()
      .get(`/api/customers/${a2Current.customer.id}/profile`)
      .set(as('a2'))
      .expect(200);
    await http()
      .get(`/api/customers/${a2Current.customer.id}/profile`)
      .set(as('a3'))
      .expect(403);
  });

  it('manual assignment goes to the front of the assistant queue', async () => {
    const fresh = customerIds[8]; // 9th customer — abhi kisi ke paas nahi
    const res = await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: fresh, staffId: ids.a3 })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'ASSIGNED', source: 'MANUAL' });

    // same customer dobara → 409
    await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: fresh, staffId: ids.a4 })
      .expect(409);

    // a3 apna current complete kare → agla = manually assigned customer
    const done = await complete('a3', {
      outcomeId: outcomes.BUSY,
      nextActionId: actions.NO_FURTHER_ACTION,
    }).expect(200);
    expect(done.body.current.customer.id).toBe(fresh);
    expect(done.body.current.source).toBe('MANUAL');
  });

  it('reassign while IN_PROGRESS: old assistant cannot save, new one gets it', async () => {
    const a4Current = (await http().get('/api/calling/current').set(as('a4')))
      .body.current;
    await http()
      .post(`/api/assignments/${a4Current.id}/reassign`)
      .set(as('mgr'))
      .send({ staffId: ids.other })
      .expect(200);

    const res = await complete('a4', {
      outcomeId: outcomes.BUSY,
      nextActionId: actions.NO_FURTHER_ACTION,
    }).expect(409);
    expect(res.body.message).toContain('reassigned');

    const otherNext = await next('other').expect(200);
    expect(otherNext.body.current.customer.id).toBe(a4Current.customer.id);
  });

  it('cancel puts the customer back in the pool', async () => {
    const a5Current = (await http().get('/api/calling/current').set(as('a5')))
      .body.current;
    await http()
      .post(`/api/assignments/${a5Current.id}/cancel`)
      .set(as('mgr'))
      .expect(200);
    await http()
      .post(`/api/assignments/${a5Current.id}/cancel`)
      .set(as('mgr'))
      .expect(409);
    const list = await http()
      .get('/api/assignments')
      .query({ status: 'CANCELLED', staffId: ids.a5 })
      .set(as('mgr'))
      .expect(200);
    expect(list.body.data[0].customer.id).toBe(a5Current.customer.id);
  });

  it('team leader: own team only; assistant: no access to assignments', async () => {
    await http()
      .post('/api/assignments')
      .set(as('tl'))
      .send({ customerId: customerIds[7], staffId: ids.other })
      .expect(403);
    const own = await http().get('/api/assignments').set(as('tl')).expect(200);
    own.body.data.forEach((a: { staff: { id: string } }) =>
      expect([ids.tl, ids.a1, ids.a2]).toContain(a.staff.id),
    );
    await http().get('/api/assignments').set(as('a1')).expect(403);

    const assignable = await http()
      .get('/api/assignments/assignable-staff')
      .set(as('tl'))
      .expect(200);
    expect(assignable.body.map((s: { id: string }) => s.id).sort()).toEqual(
      [ids.tl, ids.a1, ids.a2].sort(),
    );
  });

  it('DO_NOT_CALL customer cannot be assigned', async () => {
    await prisma.customer.update({
      where: { id: customerIds[7] },
      data: { status: 'DO_NOT_CALL' },
    });
    await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: customerIds[7], staffId: ids.a1 })
      .expect(400);
  });
});
