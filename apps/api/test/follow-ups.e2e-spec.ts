import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { FollowUpSchedulerService } from '../src/follow-ups/follow-up-scheduler.service.js';
import type { StaffRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Design doc section 8.1 — "4 PM example" end-to-end.
 * Scheduler ka tick(now) seedha call karte hain aur `now` aage badha ke "time travel" karte hain.
 */
describe('Follow-ups, availability, escalation, notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scheduler: FollowUpSchedulerService;
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-fu-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let outcomes: Record<string, string>;
  let actions: Record<string, string>;
  let customerId: string;
  let originalTiming: unknown;
  const MIN = 60_000;
  const T = new Date(Date.now() + 2 * 3600_000); // "4 PM" = abhi se 2 ghante baad

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const login = async (who: string) => {
    const res = await http()
      .post('/api/auth/login')
      .send({ email: email(who), password });
    tokens[who] = res.body.accessToken;
  };
  const notificationsOf = (who: string, type: string) =>
    prisma.notification.findMany({
      where: { recipientId: ids[who], type: type as never },
    });
  const followUpOf = () =>
    prisma.followUp.findFirstOrThrow({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  /** Presence simulate: "ye banda `at` time pe online tha" */
  const seenAt = (who: string, at: Date, availability = 'AVAILABLE') =>
    prisma.staff.update({
      where: { id: ids[who] },
      data: { lastSeenAt: at, availability: availability as never },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    scheduler = app.get(FollowUpSchedulerService);

    // Known timing (test ke baad restore)
    originalTiming = (
      await prisma.systemSetting.findUnique({
        where: { key: 'follow_up.timing' },
      })
    )?.value;
    await prisma.systemSetting.update({
      where: { key: 'follow_up.timing' },
      data: {
        value: {
          reminderMinutesBefore: 1,
          gracePeriodMinutes: 10,
          presenceTimeoutMinutes: 5,
        },
      },
    });

    const passwordHash = await hashPassword(password);
    const people: [string, StaffRole][] = [
      ['mgr', 'MANAGER'],
      ['tl', 'TEAM_LEADER'],
      ['amit', 'ASSISTANT'],
      ['ravi', 'ASSISTANT'],
      ['zed', 'ASSISTANT'],
    ];
    for (const [name, role] of people) {
      ids[name] = (
        await prisma.staff.create({
          data: { name: `FU ${name}`, email: email(name), role, passwordHash },
        })
      ).id;
    }
    ids.team = (
      await prisma.team.create({
        data: { name: `E2E FU ${suffix}`, leaderId: ids.tl },
      })
    ).id;
    await prisma.staff.updateMany({
      where: { id: { in: [ids.amit, ids.ravi] } },
      data: { teamId: ids.team },
    });

    customerId = (
      await prisma.customer.create({
        data: {
          name: `FU Rahul ${suffix}`,
          phone: `+97156${String(Date.now()).slice(-7)}`,
          priority: 'URGENT',
        },
      })
    ).id;

    for (const who of ['mgr', 'tl', 'amit', 'ravi', 'zed']) await login(who);
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
  });

  afterAll(async () => {
    if (originalTiming) {
      await prisma.systemSetting.update({
        where: { key: 'follow_up.timing' },
        data: { value: originalTiming as object },
      });
    }
    const staffIds = ['mgr', 'tl', 'amit', 'ravi', 'zed'].map((k) => ids[k]);
    await prisma.assignment.deleteMany({ where: { customerId } });
    await prisma.followUp.deleteMany({ where: { customerId } });
    await prisma.call.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: staffIds } },
          { entityType: 'follow_up', actorId: null },
        ],
      },
    });
    await prisma.staff.updateMany({
      where: { id: { in: staffIds } },
      data: { teamId: null },
    });
    await prisma.team.delete({ where: { id: ids.team } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } }); // notifications cascade
    await app.close();
  });

  it('login makes a calling assistant AVAILABLE; Start Calling makes them ON_CALL', async () => {
    const me = await http().get('/api/auth/me').set(as('amit')).expect(200);
    expect(me.body.availability).toBe('AVAILABLE');

    const res = await http()
      .post('/api/calling/next')
      .set(as('amit'))
      .expect(200);
    expect(res.body.current.customer.id).toBe(customerId);
    const after = await http().get('/api/auth/me').set(as('amit')).expect(200);
    expect(after.body.availability).toBe('ON_CALL');
  });

  it('Save & Next with "Follow-up 4 PM" creates a PENDING follow-up owned by the caller', async () => {
    await http()
      .post('/api/calling/complete')
      .set(as('amit'))
      .send({
        outcomeId: outcomes.CONNECTED,
        nextActionId: actions.FOLLOW_UP,
        userResponse: 'Call me at 4 PM',
        notes: 'Busy right now',
        interestRating: 7,
        followUpAt: T.toISOString(),
      })
      .expect(200);

    const fu = await followUpOf();
    expect(fu).toMatchObject({
      status: 'PENDING',
      ownerId: ids.amit,
      originalOwnerId: ids.amit,
    });
    expect(fu.dueAt.toISOString()).toBe(T.toISOString());

    const list = await http()
      .get('/api/follow-ups')
      .query({ bucket: 'upcoming' })
      .set(as('amit'))
      .expect(200);
    expect(list.body.data.map((f: { id: string }) => f.id)).toContain(fu.id);
    expect(list.body.data[0].sourceCall.userResponse).toBe('Call me at 4 PM');
    const summary = await http()
      .get('/api/follow-ups/summary')
      .set(as('amit'))
      .expect(200);
    expect(summary.body.upcoming).toBeGreaterThanOrEqual(1);
  });

  it('3:59 → reminder to owner (only once, even if tick runs again)', async () => {
    await scheduler.tick(new Date(T.getTime() - 30_000));
    await scheduler.tick(new Date(T.getTime() - 20_000));
    expect(await notificationsOf('amit', 'FOLLOW_UP_REMINDER')).toHaveLength(1);
  });

  it('4:00 → due notification to owner', async () => {
    await scheduler.tick(new Date(T.getTime() + 1000));
    expect(await notificationsOf('amit', 'FOLLOW_UP_DUE')).toHaveLength(1);
  });

  it('owner on BREAK after grace → escalated to available teammate (not other team)', async () => {
    await http()
      .patch('/api/auth/availability')
      .set(as('amit'))
      .send({ availability: 'BREAK' })
      .expect(200);
    const at = new Date(T.getTime() + 11 * MIN);
    await seenAt('ravi', new Date(at.getTime() - MIN)); // ravi online
    await seenAt('zed', new Date(at.getTime() - MIN)); // zed online, par doosri team

    const result = await scheduler.tick(at);
    expect(result.escalated).toBeGreaterThanOrEqual(1);

    const fu = await followUpOf();
    expect(fu).toMatchObject({
      ownerId: ids.ravi,
      originalOwnerId: ids.amit,
      escalationCount: 1,
    });
    expect(
      await notificationsOf('ravi', 'FOLLOW_UP_ESCALATED_TO_YOU'),
    ).toHaveLength(1);
    expect(
      await notificationsOf('amit', 'FOLLOW_UP_ESCALATED_AWAY'),
    ).toHaveLength(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'follow_up.escalated', entityId: fu.id },
    });
    expect(audit.actorId).toBeNull(); // system ne kiya

    // Turant dobara tick → ping-pong nahi (naya grace period escalatedAt se)
    await scheduler.tick(new Date(at.getTime() + 2 * MIN));
    expect((await followUpOf()).escalationCount).toBe(1);
  });

  it('new owner presses Start Calling → due follow-up comes FIRST, with original context', async () => {
    // asli clock pe "due" banane ke liye dueAt peeche karo (time travel ka ulta)
    const fu = await followUpOf();
    await prisma.followUp.update({
      where: { id: fu.id },
      data: { dueAt: new Date(Date.now() - MIN) },
    });

    const res = await http()
      .post('/api/calling/next')
      .set(as('ravi'))
      .expect(200);
    expect(res.body.current).toMatchObject({
      source: 'FOLLOW_UP',
      customer: { id: customerId },
      followUp: {
        originalOwner: { id: ids.amit },
        sourceCall: { userResponse: 'Call me at 4 PM' },
      },
    });
    expect((await followUpOf()).status).toBe('IN_PROGRESS');
  });

  it('calling the customer completes the follow-up; "Call Again" creates the next one', async () => {
    const old = await followUpOf();
    const T2 = new Date(Date.now() + 3 * 3600_000);
    await http()
      .post('/api/calling/complete')
      .set(as('ravi'))
      .send({
        outcomeId: outcomes.CONNECTED,
        nextActionId: actions.CALL_AGAIN,
        userResponse: 'Need one more day',
        notes: 'Will decide tomorrow',
        interestRating: 8,
        followUpAt: T2.toISOString(),
      })
      .expect(200);

    const done = await prisma.followUp.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(done.status).toBe('COMPLETED');
    expect(done.completedByCallId).not.toBeNull();
    const next = await followUpOf();
    expect(next).toMatchObject({ status: 'PENDING', ownerId: ids.ravi });
    expect(next.id).not.toBe(old.id);
  });

  it('owner AVAILABLE but did not call after grace → overdue alert to team leader (once)', async () => {
    const fu = await followUpOf();
    const at = new Date(fu.dueAt.getTime() + 11 * MIN);
    await seenAt('ravi', new Date(at.getTime() - MIN)); // ravi online hai par call nahi kiya
    await scheduler.tick(at);
    await scheduler.tick(new Date(at.getTime() + MIN));
    expect((await followUpOf()).ownerId).toBe(ids.ravi); // escalate nahi hua
    const alerts = await notificationsOf('tl', 'FOLLOW_UP_OVERDUE');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toContain('has not called yet');
  });

  it('reschedule (owner), scope checks, reassign + cancel (TL), assistant cannot cancel', async () => {
    const fu = await followUpOf();
    const newTime = new Date(Date.now() + 5 * 3600_000);
    await http()
      .post(`/api/follow-ups/${fu.id}/reschedule`)
      .set(as('ravi'))
      .send({ dueAt: newTime.toISOString() })
      .expect(200);
    const rescheduled = await followUpOf();
    expect(rescheduled.dueAt.toISOString()).toBe(newTime.toISOString());
    expect(rescheduled.overdueNotifiedAt).toBeNull(); // markers reset

    await http()
      .post(`/api/follow-ups/${fu.id}/reschedule`)
      .set(as('ravi'))
      .send({ dueAt: new Date(Date.now() - MIN).toISOString() })
      .expect(400); // past time
    await http()
      .post(`/api/follow-ups/${fu.id}/reschedule`)
      .set(as('zed'))
      .send({ dueAt: newTime.toISOString() })
      .expect(403); // zed ka nahi

    await http()
      .post(`/api/follow-ups/${fu.id}/reassign`)
      .set(as('tl'))
      .send({ staffId: ids.zed })
      .expect(400); // zed team me nahi
    await http()
      .post(`/api/follow-ups/${fu.id}/reassign`)
      .set(as('tl'))
      .send({ staffId: ids.amit })
      .expect(200);
    expect(await notificationsOf('amit', 'FOLLOW_UP_REASSIGNED')).toHaveLength(
      1,
    );

    await http()
      .post(`/api/follow-ups/${fu.id}/cancel`)
      .set(as('amit'))
      .expect(403);
    await http()
      .post(`/api/follow-ups/${fu.id}/cancel`)
      .set(as('tl'))
      .expect(200);
    const cancelled = await followUpOf();
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.openCustomerId).toBeNull();
  });

  it('notifications API: own list, unread count, mark read, read-all; others → 404', async () => {
    const list = await http()
      .get('/api/notifications')
      .set(as('amit'))
      .expect(200);
    expect(list.body.length).toBeGreaterThanOrEqual(4);
    expect(
      list.body.every(
        (n: { recipientId: string }) => n.recipientId === ids.amit,
      ),
    ).toBe(true);

    const before = (
      await http().get('/api/notifications/unread-count').set(as('amit'))
    ).body.count;
    await http()
      .post(`/api/notifications/${list.body[0].id}/read`)
      .set(as('amit'))
      .expect(204);
    const after = (
      await http().get('/api/notifications/unread-count').set(as('amit'))
    ).body.count;
    expect(after).toBe(before - 1);

    await http()
      .post(`/api/notifications/${list.body[1].id}/read`)
      .set(as('ravi'))
      .expect(404);
    await http()
      .post('/api/notifications/read-all')
      .set(as('amit'))
      .expect(204);
    expect(
      (await http().get('/api/notifications/unread-count').set(as('amit'))).body
        .count,
    ).toBe(0);
  });

  it('availability: ON_CALL cannot be set manually; logout → OFFLINE', async () => {
    await http()
      .patch('/api/auth/availability')
      .set(as('zed'))
      .send({ availability: 'ON_CALL' })
      .expect(400);
    await http().post('/api/auth/logout').set(as('zed')).expect(204);
    const zed = await prisma.staff.findUniqueOrThrow({
      where: { id: ids.zed },
    });
    expect(zed.availability).toBe('OFFLINE');
  });

  it('manager updates follow-up timing; invalid values → 400', async () => {
    await http()
      .put('/api/call-config/follow-up-timing')
      .set(as('mgr'))
      .send({
        reminderMinutesBefore: 5,
        gracePeriodMinutes: 15,
        presenceTimeoutMinutes: 5,
      })
      .expect(200);
    const config = await http()
      .get('/api/call-config')
      .set(as('amit'))
      .expect(200);
    expect(config.body.followUpTiming).toEqual({
      reminderMinutesBefore: 5,
      gracePeriodMinutes: 15,
      presenceTimeoutMinutes: 5,
    });
    await http()
      .put('/api/call-config/follow-up-timing')
      .set(as('mgr'))
      .send({
        reminderMinutesBefore: -1,
        gracePeriodMinutes: 0,
        presenceTimeoutMinutes: 5,
      })
      .expect(400);
    await http()
      .put('/api/call-config/follow-up-timing')
      .set(as('amit'))
      .send({
        reminderMinutesBefore: 1,
        gracePeriodMinutes: 10,
        presenceTimeoutMinutes: 5,
      })
      .expect(403);
  });
});
