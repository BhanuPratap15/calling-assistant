import { randomInt, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { CallingWatchdogService } from '../src/calling/calling-watchdog.service.js';
import type { StaffRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Phase 10 (ADR 0015): Save & Stop, Stop calling (release), watchdog, bulk distribute,
 * new-assignment / campaign-exhausted notifications, week / month report presets.
 *
 * Isolation: har customer ek ACTIVE campaign me hai jiske member SIRF is test ke assistants hain
 * (priority 100) → "Start Calling" deterministic, doosre tests / dev data pe asar nahi.
 */
describe('Calling workflow — Phase 10 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let watchdog: CallingWatchdogService;
  const suffix = randomUUID().slice(0, 8);
  const block = String(randomInt(1000, 9999));
  const email = (n: string) => `e2e-wf-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const customerIds: string[] = [];
  const campaignIds: string[] = [];
  let outcomes: Record<string, string>;
  let actions: Record<string, string>;
  let originalWorkflow: unknown;
  const MIN = 60_000;

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const notes = (who: string, type: string) =>
    prisma.notification.findMany({
      where: { recipientId: ids[who], type: type as never },
      orderBy: { createdAt: 'asc' },
    });
  let phoneSeq = 0;
  const makeCustomers = async (n: number, label: string) => {
    const created = [];
    for (let i = 0; i < n; i++) {
      const c = await prisma.customer.create({
        data: {
          name: `WF ${label} ${i} ${suffix}`,
          phone: `+9193${block}${String(phoneSeq++).padStart(4, '0')}`,
        },
      });
      customerIds.push(c.id);
      created.push(c);
    }
    return created;
  };
  /** ACTIVE campaign, members = given staff, customers = given ids */
  const makeCampaign = async (
    label: string,
    members: string[],
    customers: string[],
    status: 'ACTIVE' | 'DRAFT' = 'ACTIVE',
  ) => {
    const k = await prisma.campaign.create({
      data: {
        name: `WF ${label} ${suffix}`,
        status,
        priority: 100,
        createdById: ids.mgr,
        staff: { create: members.map((staffId) => ({ staffId })) },
        customers: { create: customers.map((customerId) => ({ customerId })) },
      },
    });
    campaignIds.push(k.id);
    return k.id;
  };
  const start = (who: string) =>
    http().post('/api/calling/next').set(as(who)).expect(200);
  const noAnswer = { outcomeId: '', nextActionId: '' };

  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    watchdog = app.get(CallingWatchdogService);
    originalWorkflow = (
      await prisma.systemSetting.findUnique({
        where: { key: 'calling.workflow' },
      })
    )?.value;

    const passwordHash = await hashPassword(password);
    const people: [string, StaffRole][] = [
      ['mgr', 'MANAGER'],
      ['tl', 'TEAM_LEADER'],
      ['amit', 'ASSISTANT'],
      ['ravi', 'ASSISTANT'],
      ['neha', 'ASSISTANT'],
      ['other', 'ASSISTANT'], // doosri team (TL scope test)
    ];
    for (const [name, role] of people) {
      ids[name] = (
        await prisma.staff.create({
          data: { name: `WF ${name}`, email: email(name), role, passwordHash },
        })
      ).id;
    }
    ids.team = (
      await prisma.team.create({
        data: { name: `E2E WF ${suffix}`, leaderId: ids.tl },
      })
    ).id;
    await prisma.staff.updateMany({
      where: { id: { in: [ids.amit, ids.ravi, ids.neha, ids.tl] } },
      data: { teamId: ids.team },
    });
    for (const who of Object.keys(ids).filter((k) => k !== 'team')) {
      tokens[who] = (
        await http()
          .post('/api/auth/login')
          .send({ email: email(who), password })
      ).body.accessToken;
    }
    const config = (await http().get('/api/call-config').set(as('amit'))).body;
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
    if (originalWorkflow)
      await prisma.systemSetting.update({
        where: { key: 'calling.workflow' },
        data: { value: originalWorkflow as object },
      });
    else
      await prisma.systemSetting.deleteMany({
        where: { key: 'calling.workflow' },
      });
    const staffIds = ['mgr', 'tl', 'amit', 'ravi', 'neha', 'other'].map(
      (k) => ids[k],
    );
    await prisma.callSession.deleteMany({
      where: { staffId: { in: staffIds } },
    });
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
    await prisma.call.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: staffIds } },
          { action: 'assignment.released', actorId: null },
        ],
      },
    });
    await prisma.staff.updateMany({
      where: { id: { in: staffIds } },
      data: { teamId: null },
    });
    await prisma.team.delete({ where: { id: ids.team } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  // ---------------- 10.1 Save & Stop / Stop calling ----------------

  it('Save & Stop saves the call, opens NO next customer and puts the assistant on BREAK', async () => {
    const cs = await makeCustomers(2, 'stop');
    await makeCampaign(
      'stop',
      [ids.amit],
      cs.map((c) => c.id),
    );
    const first = (await start('amit')).body.current;
    expect(first.customer.name).toContain(`WF stop`);

    const res = await http()
      .post('/api/calling/complete')
      .set(as('amit'))
      .send({ ...noAnswer, stop: true })
      .expect(200);
    expect(res.body.call.customerId).toBe(first.customer.id);
    expect(res.body.current).toBeNull();
    const me = await http().get('/api/auth/me').set(as('amit')).expect(200);
    expect(me.body.availability).toBe('BREAK');
    expect(
      (await http().get('/api/calling/current').set(as('amit'))).body.current,
    ).toBeNull();
  });

  it('Stop calling releases an untouched AUTO customer back to the queue (audited, BREAK)', async () => {
    const cur = (await start('amit')).body.current; // 2nd "stop" customer
    expect(cur.source).toBe('AUTO');
    const res = await http()
      .post('/api/calling/release')
      .set(as('amit'))
      .send({ note: 'shift over' })
      .expect(200);
    expect(res.body).toEqual({ released: true, result: 'released' });

    const a = await prisma.assignment.findUniqueOrThrow({
      where: { id: cur.id },
    });
    expect(a).toMatchObject({
      status: 'CANCELLED',
      releaseReason: 'stopped_by_assistant',
      openCustomerId: null,
    });
    expect(await prisma.call.count({ where: { assignmentId: cur.id } })).toBe(
      0,
    );
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'assignment.released', entityId: cur.id },
    });
    expect(audit.metadata).toMatchObject({
      reason: 'stopped_by_assistant',
      note: 'shift over',
    });
    // Wapas queue me: agli baar (koi aur nahi le gaya) wahi customer — skip karke bacha nahi ja sakta
    const again = (await start('amit')).body.current;
    expect(again.customer.id).toBe(cur.customer.id);
  });

  it('Stop calling is refused once the customer was dialled (form must be saved)', async () => {
    await http().post('/api/calling/dial').set(as('amit')).send({}).expect(200);
    const res = await http()
      .post('/api/calling/release')
      .set(as('amit'))
      .send({})
      .expect(409);
    expect(res.body.message).toMatch(/already dialled/);
    await http()
      .post('/api/calling/complete')
      .set(as('amit'))
      .send({ ...noAnswer, stop: true })
      .expect(200);
    await http().post('/api/calling/release').set(as('amit')).expect(409); // ab current hi nahi
  });

  it('a manager-assigned customer stays in the same assistant queue after Stop', async () => {
    const [c] = await makeCustomers(1, 'manual');
    const created = await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: c.id, staffId: ids.ravi })
      .expect(201);
    // 10.4: assistant ko "New customer assigned" notification
    const n = await notes('ravi', 'ASSIGNMENT_NEW');
    expect(n).toHaveLength(1);
    expect(n[0].title).toContain(c.name);

    expect((await start('ravi')).body.current.customer.id).toBe(c.id);
    await http()
      .post('/api/calling/release')
      .set(as('ravi'))
      .expect(200)
      .expect(({ body }) => expect(body.result).toBe('requeued'));
    const a = await prisma.assignment.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(a).toMatchObject({
      status: 'ASSIGNED',
      staffId: ids.ravi,
      openCustomerId: c.id,
      inProgressStaffId: null,
    });
    expect((await start('ravi')).body.current.customer.id).toBe(c.id);
    await http()
      .post('/api/calling/complete')
      .set(as('ravi'))
      .send({ ...noAnswer, stop: true })
      .expect(200);
  });

  it('a due follow-up goes back to PENDING (same owner) when released', async () => {
    const [c] = await makeCustomers(1, 'fu');
    const call = await prisma.call.create({
      data: {
        customerId: c.id,
        staffId: ids.neha,
        outcomeId: outcomes.CONNECTED,
        nextActionId: actions.FOLLOW_UP,
      },
    });
    const fu = await prisma.followUp.create({
      data: {
        customerId: c.id,
        ownerId: ids.neha,
        originalOwnerId: ids.neha,
        sourceCallId: call.id,
        dueAt: new Date(Date.now() - MIN),
        openCustomerId: c.id,
      },
    });
    const cur = (await start('neha')).body.current;
    expect(cur.source).toBe('FOLLOW_UP');
    await http().post('/api/calling/release').set(as('neha')).expect(200);
    expect(
      await prisma.followUp.findUniqueOrThrow({ where: { id: fu.id } }),
    ).toMatchObject({ status: 'PENDING', ownerId: ids.neha });
    // agli baar phir wahi follow-up sabse pehle
    expect((await start('neha')).body.current.followUp.id).toBe(fu.id);
    await http().post('/api/calling/release').set(as('neha')).expect(200);
    await prisma.followUp.update({
      where: { id: fu.id },
      data: { status: 'CANCELLED', openCustomerId: null },
    });
  });

  // ---------------- 10.2 Watchdog ----------------

  it('watchdog: form-incomplete reminder once; auto-release only when the assistant is away', async () => {
    await http()
      .put('/api/call-config/calling-workflow')
      .set(as('mgr'))
      .send({ incompleteFormMinutes: 15, autoReleaseMinutes: 30 })
      .expect(200);
    expect(
      (await http().get('/api/call-config').set(as('amit'))).body
        .callingWorkflow,
    ).toEqual({ incompleteFormMinutes: 15, autoReleaseMinutes: 30 });
    await http()
      .put('/api/call-config/calling-workflow')
      .set(as('amit'))
      .send({ incompleteFormMinutes: 15, autoReleaseMinutes: 30 })
      .expect(403);

    const cs = await makeCustomers(2, 'wd');
    await makeCampaign(
      'wd',
      [ids.amit, ids.ravi],
      cs.map((c) => c.id),
    );
    const amitCur = (await start('amit')).body.current;
    const raviCur = (await start('ravi')).body.current;
    const now = Date.now();

    // +10 min: kuch nahi
    let r = await watchdog.tick(new Date(now + 10 * MIN));
    expect(
      await prisma.assignment.count({
        where: {
          id: { in: [amitCur.id, raviCur.id] },
          staleNotifiedAt: { not: null },
        },
      }),
    ).toBe(0);

    // +16 min: dono ko EK reminder
    await watchdog.tick(new Date(now + 16 * MIN));
    await watchdog.tick(new Date(now + 17 * MIN));
    expect(await notes('amit', 'FORM_INCOMPLETE')).toHaveLength(1);
    expect(await notes('ravi', 'FORM_INCOMPLETE')).toHaveLength(1);

    // +31 min: Amit online (heartbeat abhi), Ravi BREAK pe; Ravi pe live call → bhi nahi chhedna
    const later = new Date(now + 31 * MIN);
    await prisma.staff.update({
      where: { id: ids.amit },
      data: { availability: 'ON_CALL', lastSeenAt: later },
    });
    await prisma.staff.update({
      where: { id: ids.ravi },
      data: { availability: 'BREAK' },
    });
    const live = await prisma.callSession.create({
      data: {
        provider: 'mock',
        customerId: raviCur.customer.id,
        staffId: ids.ravi,
        assignmentId: raviCur.id,
        toNumber: raviCur.customer.phone,
        status: 'ANSWERED',
      },
    });
    r = await watchdog.tick(later);
    expect(
      await prisma.assignment.findUniqueOrThrow({ where: { id: raviCur.id } }),
    ).toMatchObject({ status: 'IN_PROGRESS' }); // live call
    expect(
      await prisma.assignment.findUniqueOrThrow({ where: { id: amitCur.id } }),
    ).toMatchObject({ status: 'IN_PROGRESS' }); // present

    // call khatam → ab release; Ravi + TL ko notification, audit actor = system
    await prisma.callSession.update({
      where: { id: live.id },
      data: { status: 'COMPLETED', durationSec: 40 },
    });
    r = await watchdog.tick(later);
    expect(r.autoReleased).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.assignment.findUniqueOrThrow({ where: { id: raviCur.id } }),
    ).toMatchObject({ status: 'CANCELLED', releaseReason: 'assistant_away' });
    expect(await notes('ravi', 'ASSIGNMENT_AUTO_RELEASED')).toHaveLength(1);
    const tlNote = await notes('tl', 'ASSIGNMENT_AUTO_RELEASED');
    expect(tlNote).toHaveLength(1);
    expect(tlNote[0].title).toMatch(/WF ravi was away.*dialled 1x/);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'assignment.released', entityId: raviCur.id },
    });
    expect(audit.actorId).toBeNull();

    // autoReleaseMinutes = 0 → band
    await http()
      .put('/api/call-config/calling-workflow')
      .set(as('mgr'))
      .send({ incompleteFormMinutes: 15, autoReleaseMinutes: 0 })
      .expect(200);
    await prisma.staff.update({
      where: { id: ids.amit },
      data: { availability: 'OFFLINE' },
    });
    r = await watchdog.tick(new Date(now + 120 * MIN));
    expect(
      await prisma.assignment.findUniqueOrThrow({ where: { id: amitCur.id } }),
    ).toMatchObject({ status: 'IN_PROGRESS' });
    await http()
      .post('/api/calling/complete')
      .set(as('amit'))
      .send({ ...noAnswer, stop: true })
      .expect(200);
  });

  // ---------------- 10.3 Distribute ----------------

  it('distribute ROUND_ROBIN dry run previews without saving; LOAD_BASED evens out the load', async () => {
    const cs = await makeCustomers(10, 'dist');
    const k = await makeCampaign(
      'dist',
      [ids.neha],
      cs.map((c) => c.id),
      'DRAFT',
    );
    const base = {
      staffIds: [ids.amit, ids.ravi, ids.neha],
      campaignId: k,
      limit: 100,
    };
    const preview = await http()
      .post('/api/assignments/distribute')
      .set(as('mgr'))
      .send({ ...base, strategy: 'ROUND_ROBIN', dryRun: true })
      .expect(200);
    expect(preview.body).toMatchObject({
      dryRun: true,
      eligible: 10,
      assigned: 10,
    });
    expect(
      preview.body.perStaff.map((p: { newCount: number }) => p.newCount),
    ).toEqual([4, 3, 3]);
    expect(await prisma.assignment.count({ where: { campaignId: k } })).toBe(0);

    // Amit pe pehle se 3 open → load-based me use kam milne chahiye
    for (const c of cs.slice(0, 3))
      await http()
        .post('/api/assignments')
        .set(as('mgr'))
        .send({ customerId: c.id, staffId: ids.amit, campaignId: k })
        .expect(201);
    const before = (await notes('ravi', 'ASSIGNMENT_NEW')).length;
    const res = await http()
      .post('/api/assignments/distribute')
      .set(as('mgr'))
      .send({ ...base, strategy: 'LOAD_BASED' })
      .expect(200);
    expect(res.body).toMatchObject({ eligible: 7, assigned: 7 });
    const per = Object.fromEntries(
      res.body.perStaff.map((p: { name: string; newCount: number }) => [
        p.name,
        p.newCount,
      ]),
    );
    expect(per).toEqual({ 'WF amit': 1, 'WF ravi': 3, 'WF neha': 3 });
    const rows = await prisma.assignment.findMany({
      where: { campaignId: k, source: 'DISTRIBUTED' },
    });
    expect(rows).toHaveLength(7);
    expect(rows.every((a) => a.status === 'ASSIGNED')).toBe(true);
    // har assistant ko EK notification (7 nahi)
    const raviNew = await notes('ravi', 'ASSIGNMENT_NEW');
    expect(raviNew.length - before).toBe(1);
    expect(raviNew.at(-1)!.title).toMatch(/^3 customers assigned to you/);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'assignment.distributed', actorId: ids.mgr },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.metadata).toMatchObject({
      strategy: 'LOAD_BASED',
      assigned: 7,
    });

    // dobara: koi eligible nahi (sab kisi ke paas)
    const again = await http()
      .post('/api/assignments/distribute')
      .set(as('mgr'))
      .send({ ...base, strategy: 'LOAD_BASED' })
      .expect(200);
    expect(again.body).toMatchObject({ eligible: 0, assigned: 0 });

    // Distributed customer calling me campaign ke saath aata hai
    const cur = (await start('ravi')).body.current;
    expect(cur.source).toBe('DISTRIBUTED');
    expect(cur.campaign.id).toBe(k);
    await http()
      .post('/api/calling/complete')
      .set(as('ravi'))
      .send({ ...noAnswer, stop: true })
      .expect(200);
  });

  it('distribute: TL only within own team; validation', async () => {
    const k = await makeCampaign('dist2', [], [], 'DRAFT');
    await http()
      .post('/api/assignments/distribute')
      .set(as('tl'))
      .send({
        staffIds: [ids.amit, ids.other],
        strategy: 'ROUND_ROBIN',
        limit: 5,
        campaignId: k,
      })
      .expect(403);
    await http()
      .post('/api/assignments/distribute')
      .set(as('tl'))
      .send({
        staffIds: [ids.amit],
        strategy: 'ROUND_ROBIN',
        limit: 5,
        campaignId: k,
      })
      .expect(200);
    await http()
      .post('/api/assignments/distribute')
      .set(as('mgr'))
      .send({ staffIds: [], strategy: 'RANDOM', limit: 0 })
      .expect(400);
    await http()
      .post('/api/assignments/distribute')
      .set(as('amit'))
      .send({ staffIds: [ids.amit], strategy: 'ROUND_ROBIN', limit: 5 })
      .expect(403);
  });

  // ---------------- 10.4 Campaign exhausted ----------------

  it('campaign exhausted: creator + managers alerted once; adding customers re-arms it', async () => {
    const cs = await makeCustomers(2, 'exh');
    // 'other' ki koi ASSIGNED queue nahi → Start Calling seedha campaign se
    const k = await makeCampaign('exh', [ids.other], [cs[0].id]);
    const cur = (await start('other')).body.current;
    expect(cur.customer.id).toBe(cs[0].id);
    await http()
      .post('/api/calling/complete')
      .set(as('other'))
      .send({ ...noAnswer, stop: true })
      .expect(200);
    const alerts = (await notes('mgr', 'CAMPAIGN_EXHAUSTED')).filter(
      (n) => (n.data as { campaignId: string }).campaignId === k,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].link).toBe(`/campaigns/${k}`);

    // Dobara check → koi naya alert nahi
    const calling = app.get(
      (await import('../src/calling/calling.service.js')).CallingService,
    );
    expect(await calling.notifyIfCampaignExhausted(k)).toBe(false);

    // Naya customer add → marker reset → khatam hone pe phir alert
    await http()
      .post(`/api/campaigns/${k}/customers`)
      .set(as('mgr'))
      .send({ customerIds: [cs[1].id] })
      .expect((r) => expect([200, 201]).toContain(r.status));
    expect(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: k } }))
        .exhaustedNotifiedAt,
    ).toBeNull();
    expect((await start('other')).body.current.customer.id).toBe(cs[1].id);
    await http()
      .post('/api/calling/complete')
      .set(as('other'))
      .send({ ...noAnswer, stop: true })
      .expect(200);
    expect(
      (await notes('mgr', 'CAMPAIGN_EXHAUSTED')).filter(
        (n) => (n.data as { campaignId: string }).campaignId === k,
      ),
    ).toHaveLength(2);
  });

  // ---------------- 10.5 Report presets ----------------

  it('reports accept "week" and "month" presets', async () => {
    for (const range of ['week', 'month']) {
      const res = await http()
        .get('/api/reports/summary')
        .query({ range })
        .set(as('mgr'))
        .expect(200);
      expect(res.body.range.preset).toBe(range);
      expect(res.body.daily.length).toBeGreaterThanOrEqual(1);
      expect(res.body.daily.length).toBeLessThanOrEqual(31);
    }
  });
});
