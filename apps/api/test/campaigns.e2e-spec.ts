import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import type { StaffRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Phase 5 — Campaigns. Har functionality alag `it` me (design doc section 11 + ADR 0010).
 */
describe('Campaigns (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-camp-${n}-${suffix}@test.local`;
  const name = (n: string) => `E2E ${n} ${suffix}`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const cust: Record<string, string> = {};
  const camp: Record<string, string> = {};
  let outcomes: Record<string, string>;
  let actions: Record<string, string>;
  const DAY = 24 * 3600_000;

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const createCampaign = async (key: string, body: object = {}) => {
    const res = await http()
      .post('/api/campaigns')
      .set(as('mgr'))
      .send({ name: name(key), ...body })
      .expect(201);
    camp[key] = res.body.id;
    return res.body;
  };
  const patch = (key: string, body: object) =>
    http().patch(`/api/campaigns/${camp[key]}`).set(as('mgr')).send(body);
  const addIds = (key: string, customerIds: string[]) =>
    http()
      .post(`/api/campaigns/${camp[key]}/customers`)
      .set(as('mgr'))
      .send({ customerIds });
  const members = (key: string, staffIds: string[], teamIds: string[] = []) =>
    http()
      .put(`/api/campaigns/${camp[key]}/members`)
      .set(as('mgr'))
      .send({ staffIds, teamIds })
      .expect(200);
  const next = async (who: string) =>
    (await http().post('/api/calling/next').set(as(who)).expect(200)).body
      .current;
  /** Assistant ka current (jo bhi ho) manager se cancel → saaf slate */
  const release = async (who: string) => {
    const cur = (await http().get('/api/calling/current').set(as(who))).body
      .current;
    if (cur)
      await http()
        .post(`/api/assignments/${cur.id}/cancel`)
        .set(as('mgr'))
        .expect(200);
  };
  const noAnswer = { outcomeId: '', nextActionId: '' };

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
      ['a1', 'ASSISTANT'],
      ['a2', 'ASSISTANT'],
      ['a3', 'ASSISTANT'],
    ];
    for (const [n, role] of people) {
      ids[n] = (
        await prisma.staff.create({
          data: { name: `Camp ${n}`, email: email(n), role, passwordHash },
        })
      ).id;
    }
    ids.team = (
      await prisma.team.create({
        data: { name: name('Team'), leaderId: ids.tl },
      })
    ).id;
    await prisma.staff.update({
      where: { id: ids.a2 },
      data: { teamId: ids.team },
    });
    for (const [n] of people) {
      tokens[n] = (
        await http()
          .post('/api/auth/login')
          .send({ email: email(n), password })
      ).body.accessToken;
    }

    // Customers: URGENT → general pool me bhi sabse pehle (agar campaign rules galat hon to test pakad le)
    const mk = async (key: string, data: object = {}) => {
      cust[key] = (
        await prisma.customer.create({
          data: {
            name: name(`Cust ${key}`),
            phone: `+97152${String(Date.now()).slice(-6)}${Object.keys(cust).length}`,
            priority: 'URGENT',
            ...data,
          },
        })
      ).id;
    };
    for (const k of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) await mk(k);
    await mk('dnc', { status: 'DO_NOT_CALL' });

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
    noAnswer.outcomeId = outcomes.NO_ANSWER;
    noAnswer.nextActionId = actions.NO_FURTHER_ACTION;
  });

  afterAll(async () => {
    const customerIds = Object.values(cust);
    const staffIds = ['mgr', 'tl', 'a1', 'a2', 'a3'].map((k) => ids[k]);
    await prisma.assignment.deleteMany({
      where: {
        OR: [
          { customerId: { in: customerIds } },
          { staffId: { in: staffIds } },
        ],
      },
    });
    await prisma.followUp.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customerCategoryChange.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.call.deleteMany({
      where: {
        OR: [
          { customerId: { in: customerIds } },
          { staffId: { in: staffIds } },
        ],
      },
    });
    await prisma.campaign.deleteMany({
      where: { id: { in: Object.values(camp) } },
    });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: staffIds } } });
    await prisma.staff.updateMany({
      where: { id: { in: staffIds } },
      data: { teamId: null },
    });
    await prisma.team.delete({ where: { id: ids.team } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  // ---------------- 5.1 CRUD + status ----------------

  it('create: manager 201 (DRAFT), duplicate name 409, assistant 403, bad dates 400', async () => {
    const c = await createCampaign('A', {
      priority: 10,
      script: 'Namaste! Welcome bonus offer...',
    });
    expect(c).toMatchObject({ status: 'DRAFT', priority: 10 });
    await http()
      .post('/api/campaigns')
      .set(as('mgr'))
      .send({ name: name('A') })
      .expect(409);
    await http()
      .post('/api/campaigns')
      .set(as('a1'))
      .send({ name: name('X') })
      .expect(403);
    await http()
      .post('/api/campaigns')
      .set(as('mgr'))
      .send({
        name: name('Bad'),
        startsAt: new Date(Date.now() + DAY),
        endsAt: new Date(),
      })
      .expect(400);
  });

  it('team leader can read campaigns; assistant cannot', async () => {
    await http().get('/api/campaigns').set(as('tl')).expect(200);
    await http().get(`/api/campaigns/${camp.A}`).set(as('tl')).expect(200);
    await http().get('/api/campaigns').set(as('a1')).expect(403);
    await http()
      .patch(`/api/campaigns/${camp.A}`)
      .set(as('tl'))
      .send({ priority: 1 })
      .expect(403);
  });

  it('status machine: DRAFT→ACTIVE ok, ACTIVE→DRAFT 400, COMPLETED is final', async () => {
    await createCampaign('S');
    await patch('S', { status: 'ACTIVE' }).expect(200);
    await patch('S', { status: 'DRAFT' }).expect(400);
    await patch('S', { status: 'COMPLETED' }).expect(200);
    await patch('S', { status: 'ACTIVE' }).expect(400);
    await addIds('S', [cust.c6]).expect(400); // completed campaign me add nahi
  });

  // ---------------- 5.1 customers + members ----------------

  it('add by ids: duplicates skipped, DO_NOT_CALL never added', async () => {
    const r1 = await addIds('A', [cust.c1, cust.c2, cust.dnc]).expect(201);
    expect(r1.body).toEqual({ matched: 2, added: 2, skipped: 0 });
    const r2 = await addIds('A', [cust.c1]).expect(201);
    expect(r2.body).toEqual({ matched: 1, added: 0, skipped: 1 });
  });

  it('add by filter (tag) + list pending/called + remove', async () => {
    const tag = await prisma.tag.create({ data: { name: name('Tag') } });
    await prisma.customerTag.create({
      data: { customerId: cust.c3, tagId: tag.id },
    });
    await createCampaign('F');
    const res = await http()
      .post(`/api/campaigns/${camp.F}/customers`)
      .set(as('mgr'))
      .send({ filter: { tagId: tag.id, neverCalled: true } })
      .expect(201);
    expect(res.body.added).toBe(1);

    const list = await http()
      .get(`/api/campaigns/${camp.F}/customers`)
      .query({ state: 'pending' })
      .set(as('mgr'))
      .expect(200);
    expect(
      list.body.data.map((r: { customer: { id: string } }) => r.customer.id),
    ).toEqual([cust.c3]);

    await http()
      .post(`/api/campaigns/${camp.F}/customers/remove`)
      .set(as('mgr'))
      .send({ customerIds: [cust.c3] })
      .expect(201);
    const after = await http()
      .get(`/api/campaigns/${camp.F}/customers`)
      .set(as('mgr'))
      .expect(200);
    expect(after.body.meta.total).toBe(0);
    await prisma.tag.delete({ where: { id: tag.id } });
  });

  it('members: only active ASSISTANT / TEAM_LEADER and active teams', async () => {
    await http()
      .put(`/api/campaigns/${camp.A}/members`)
      .set(as('mgr'))
      .send({ staffIds: [ids.mgr], teamIds: [] })
      .expect(400);
    const res = await members('A', [ids.a1]);
    expect(
      res.body.staff.map((s: { staff: { id: string } }) => s.staff.id),
    ).toEqual([ids.a1]);
  });

  // ---------------- 5.2 engine ----------------

  it('DRAFT campaign customers are reserved: not served by campaign queue NOR general pool', async () => {
    const cur = await next('a1');
    expect([cust.c1, cust.c2]).not.toContain(cur?.customer.id);
    await release('a1');
  });

  it('ACTIVE campaign: member gets its customer with campaign script; non-member does not', async () => {
    await patch('A', { status: 'ACTIVE' }).expect(200);
    const other = await next('a3'); // member nahi
    expect([cust.c1, cust.c2]).not.toContain(other?.customer.id);
    await release('a3');

    const cur = await next('a1');
    expect([cust.c1, cust.c2]).toContain(cur.customer.id);
    expect(cur.campaign).toMatchObject({
      id: camp.A,
      script: 'Namaste! Welcome bonus offer...',
    });
    await release('a1');
  });

  it('team membership: team members get the campaign', async () => {
    await members('A', [], [ids.team]); // ab sirf team (a2)
    const cur = await next('a2');
    expect(cur.campaign?.id).toBe(camp.A);
    await release('a2');
    const a1 = await next('a1'); // a1 ab member nahi
    expect(a1?.campaign?.id).not.toBe(camp.A);
    await release('a1');
    await members('A', [ids.a1]);
  });

  it('higher priority campaign is served first; PAUSED / out-of-window campaigns are skipped', async () => {
    await createCampaign('Hi', { priority: 50 });
    await addIds('Hi', [cust.c4]).expect(201);
    await members('Hi', [ids.a1]);
    await patch('Hi', { status: 'ACTIVE' }).expect(200);
    expect((await next('a1')).customer.id).toBe(cust.c4);
    await release('a1');

    await patch('Hi', { status: 'PAUSED' }).expect(200);
    expect((await next('a1')).campaign?.id).toBe(camp.A); // paused skip → A
    await release('a1');
  });

  it('date window: ended or not-yet-started campaigns are skipped', async () => {
    await patch('Hi', { endsAt: new Date(Date.now() - 60_000) }).expect(200);
    await patch('Hi', { status: 'ACTIVE' }).expect(200);
    expect((await next('a1')).campaign?.id).toBe(camp.A);
    await release('a1');
    await patch('Hi', {
      endsAt: null,
      startsAt: new Date(Date.now() + DAY),
    }).expect(200);
    expect((await next('a1')).campaign?.id).toBe(camp.A);
    await release('a1');
    await patch('Hi', { startsAt: null }).expect(200);
  });

  // ---------------- 5.3 custom fields ----------------

  it('custom fields: invalid definitions → 400; valid saved; key/type cannot change', async () => {
    await http()
      .put(`/api/campaigns/${camp.A}/fields`)
      .set(as('mgr'))
      .send({
        fields: [
          {
            key: 'Bad Key',
            label: 'x',
            type: 'TEXT',
            options: [],
            required: false,
            isActive: true,
            sortOrder: 0,
          },
        ],
      })
      .expect(400);
    const res = await http()
      .put(`/api/campaigns/${camp.A}/fields`)
      .set(as('mgr'))
      .send({
        fields: [
          {
            key: 'game',
            label: 'Favourite game',
            type: 'SELECT',
            options: ['Slots', 'Poker'],
            required: true,
            isActive: true,
            sortOrder: 10,
          },
          {
            key: 'deposit',
            label: 'Deposit (₹)',
            type: 'NUMBER',
            options: [],
            required: false,
            isActive: true,
            sortOrder: 20,
          },
        ],
      })
      .expect(200);
    expect(res.body.map((f: { key: string }) => f.key)).toEqual([
      'game',
      'deposit',
    ]);
    const game = res.body[0];
    await http()
      .put(`/api/campaigns/${camp.A}/fields`)
      .set(as('mgr'))
      .send({
        fields: [{ ...game, key: 'game2', id: game.id, options: game.options }],
      })
      .expect(400);
  });

  it('Save & Next validates custom fields; valid values stored; campaign progress updated', async () => {
    await patch('Hi', { status: 'PAUSED' }).expect(200);
    const cur = await next('a1');
    expect(cur.campaign.id).toBe(camp.A);
    expect(cur.campaign.fields.map((f: { key: string }) => f.key)).toEqual([
      'game',
      'deposit',
    ]);

    const missing = await http()
      .post('/api/calling/complete')
      .set(as('a1'))
      .send(noAnswer)
      .expect(400);
    expect(missing.body.message).toContain('Favourite game is required');
    await http()
      .post('/api/calling/complete')
      .set(as('a1'))
      .send({ ...noAnswer, customFields: { game: 'Bingo', deposit: '500' } })
      .expect(400);
    await http()
      .post('/api/calling/complete')
      .set(as('a1'))
      .send({ ...noAnswer, customFields: { game: 'Poker', hack: 1 } })
      .expect(400);

    const done = await http()
      .post('/api/calling/complete')
      .set(as('a1'))
      .send({ ...noAnswer, customFields: { game: 'Poker', deposit: 5000 } })
      .expect(200);
    const call = await prisma.call.findUniqueOrThrow({
      where: { id: done.body.call.id },
    });
    expect(call).toMatchObject({
      campaignId: camp.A,
      customFields: { game: 'Poker', deposit: 5000 },
    });
    const cc = await prisma.campaignCustomer.findUniqueOrThrow({
      where: {
        campaignId_customerId: {
          campaignId: camp.A,
          customerId: cur.customer.id,
        },
      },
    });
    expect(cc).toMatchObject({
      callCount: 1,
      lastOutcomeId: outcomes.NO_ANSWER,
    });
    await release('a1');
  });

  it('called campaign customer is not served again in the same campaign', async () => {
    const calledId = (
      await prisma.campaignCustomer.findFirstOrThrow({
        where: { campaignId: camp.A, callCount: 1 },
      })
    ).customerId;
    const cur = await next('a1');
    expect(cur?.customer.id).not.toBe(calledId);
    await release('a1');
  });

  it('a customer called elsewhere CAN be served by another campaign (re-engagement)', async () => {
    const calledId = (
      await prisma.campaignCustomer.findFirstOrThrow({
        where: { campaignId: camp.A, callCount: 1 },
      })
    ).customerId;
    await createCampaign('Re', { priority: 90 });
    await addIds('Re', [calledId]).expect(201);
    await patch('Re', { status: 'ACTIVE' }).expect(200);
    const cur = await next('a3'); // koi member nahi → sab
    expect(cur).toMatchObject({
      customer: { id: calledId },
      campaign: { id: camp.Re },
    });
    await release('a3');
    await patch('Re', { status: 'COMPLETED' }).expect(200);
  });

  it('stats: total / called / pending / by outcome', async () => {
    const res = await http()
      .get(`/api/campaigns/${camp.A}`)
      .set(as('mgr'))
      .expect(200);
    expect(res.body.stats).toMatchObject({ total: 2, called: 1, pending: 1 });
    expect(res.body.stats.byOutcome).toEqual([
      { label: 'No Answer', isConnected: false, count: 1 },
    ]);
    const list = await http().get('/api/campaigns').set(as('mgr')).expect(200);
    const a = list.body.find((c: { id: string }) => c.id === camp.A);
    expect(a.progress).toEqual({ total: 2, called: 1 });
  });

  // ---------------- manual assignment + follow-up inherit ----------------

  it('manual assignment with campaignId: must be in campaign; call counts in campaign', async () => {
    await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: cust.c5, staffId: ids.a1, campaignId: camp.A })
      .expect(400); // c5 campaign me nahi
    await addIds('A', [cust.c5]).expect(201);
    const assigned = await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: cust.c5, staffId: ids.a1, campaignId: camp.A })
      .expect(201);
    expect(assigned.body.campaign).toMatchObject({ id: camp.A });
    const cur = await next('a1');
    expect(cur).toMatchObject({
      source: 'MANUAL',
      customer: { id: cust.c5 },
      campaign: { id: camp.A },
    });
  });

  it('follow-up created in a campaign call is served later in the same campaign', async () => {
    await http()
      .post('/api/calling/complete')
      .set(as('a1'))
      .send({
        outcomeId: outcomes.BUSY,
        nextActionId: actions.CALL_AGAIN,
        followUpAt: new Date(Date.now() + 3600_000).toISOString(),
        customFields: { game: 'Slots' },
      })
      .expect(200);
    await release('a1');
    const fu = await prisma.followUp.findFirstOrThrow({
      where: { customerId: cust.c5, status: 'PENDING' },
    });
    await prisma.followUp.update({
      where: { id: fu.id },
      data: { dueAt: new Date(Date.now() - 1000) },
    });
    const cur = await next('a1');
    expect(cur).toMatchObject({
      source: 'FOLLOW_UP',
      customer: { id: cust.c5 },
      campaign: { id: camp.A },
    });
    await release('a1');
  });

  it('customer with an open follow-up is not served by the campaign queue', async () => {
    // c5 ka follow-up ab PENDING (release ne wapas PENDING kiya), due — a2 ko campaign se nahi milna chahiye
    await members('A', [], []); // A ab sabke liye
    const cur = await next('a2');
    expect(cur?.customer.id).not.toBe(cust.c5);
    await release('a2');
  });

  it('360° profile lists the customer campaigns and campaign on calls', async () => {
    const res = await http()
      .get(`/api/customers/${cust.c5}/profile`)
      .set(as('mgr'))
      .expect(200);
    expect(
      res.body.campaigns.map(
        (c: { campaign: { id: string } }) => c.campaign.id,
      ),
    ).toContain(camp.A);
    expect(res.body.calls[0]).toMatchObject({
      campaign: { id: camp.A },
      customFields: { game: 'Slots' },
    });
  });

  it('audit trail for campaign changes', async () => {
    const actions = (
      await prisma.auditLog.findMany({
        where: { entityType: 'campaign', entityId: camp.A },
        select: { action: true },
      })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'campaign.created',
        'campaign.updated',
        'campaign.members_updated',
        'campaign.customers_added',
        'campaign.fields_updated',
      ]),
    );
  });
});
