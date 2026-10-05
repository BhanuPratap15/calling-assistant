import { randomInt, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import type { StaffRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Phase 8 — dashboard & reports (design doc section 15 + ADR 0013).
 * Har test ke apne staff / calls (known times) → numbers exact check.
 * DB me baaki data ho sakta hai, isliye har query staff / team / campaign filter se scoped hai.
 */
describe('Reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-rep-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const customers: string[] = [];
  const block = String(randomInt(1000, 9999));
  let connected: string,
    notConnected: string,
    followUpAction: string,
    plainAction: string;
  const MIN = 60_000;
  const now = Date.now();
  const istHour = (t: number) =>
    Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(new Date(t)),
    );
  // India ka aaj 00:00 (UTC instant)
  const todayStart = (() => {
    const d = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(new Date(now));
    return new Date(`${d}T00:00:00+05:30`).getTime();
  })();
  const today = Math.max(todayStart + MIN, now - 2 * MIN); // aaj ke andar, past me
  const yesterday = todayStart - 60 * MIN;
  const old = now - 10 * 24 * 60 * MIN;

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (who: string, path: string) =>
    http().get(`/api/reports/${path}`).set(as(who));
  const call = async (
    staff: string,
    at: number,
    data: {
      connected: boolean;
      rating?: number;
      followUp?: boolean;
      campaignId?: string;
    },
  ) => {
    const customerId = customers[customers.length - 1];
    return prisma.call.create({
      data: {
        customerId,
        staffId: ids[staff],
        outcomeId: data.connected ? connected : notConnected,
        nextActionId: data.followUp ? followUpAction : plainAction,
        interestRating: data.rating ?? null,
        campaignId: data.campaignId,
        createdAt: new Date(at),
      },
    });
  };
  const newCustomer = async () => {
    const c = await prisma.customer.create({
      data: {
        name: `Rep Cust ${customers.length} ${suffix}`,
        phone: `+9193${block}${String(customers.length).padStart(4, '0')}`,
      },
    });
    customers.push(c.id);
    return c.id;
  };

  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    for (const [n, role] of [
      ['mgr', 'MANAGER'],
      ['tl', 'TEAM_LEADER'],
      ['a1', 'ASSISTANT'],
      ['a2', 'ASSISTANT'],
      ['a3', 'ASSISTANT'],
    ] as [string, StaffRole][]) {
      ids[n] = (
        await prisma.staff.create({
          data: {
            name: `Rep ${n} ${suffix}`,
            email: email(n),
            role,
            passwordHash,
          },
        })
      ).id;
      tokens[n] = (
        await http()
          .post('/api/auth/login')
          .send({ email: email(n), password })
      ).body.accessToken;
    }
    ids.team = (
      await prisma.team.create({
        data: { name: `Rep Team ${suffix}`, leaderId: ids.tl },
      })
    ).id;
    ids.otherTeam = (
      await prisma.team.create({ data: { name: `Rep Other ${suffix}` } })
    ).id;
    await prisma.staff.updateMany({
      where: { id: { in: [ids.a1, ids.a2] } },
      data: { teamId: ids.team },
    });
    await prisma.staff.update({
      where: { id: ids.a3 },
      data: { teamId: ids.otherTeam },
    });

    const cfg = (await http().get('/api/call-config').set(as('a1'))).body;
    connected = cfg.outcomes.find(
      (o: { isConnected: boolean }) => o.isConnected,
    ).id;
    notConnected = cfg.outcomes.find(
      (o: { isConnected: boolean }) => !o.isConnected,
    ).id;
    followUpAction = cfg.nextActions.find(
      (a: { requiresFollowUp: boolean }) => a.requiresFollowUp,
    ).id;
    plainAction = cfg.nextActions.find(
      (a: { requiresFollowUp: boolean }) => !a.requiresFollowUp,
    ).id;

    // Campaign: 2 customers, 1 called
    ids.campaign = (
      await prisma.campaign.create({
        data: {
          name: `Rep Camp ${suffix}`,
          status: 'ACTIVE',
          createdById: ids.mgr,
        },
      })
    ).id;

    // a1: aaj 3 calls (2 connected, ratings 8 & 6, ek follow-up promise, ek campaign me), kal 1, 10 din pehle 1
    await newCustomer();
    const c1 = await call('a1', today, {
      connected: true,
      rating: 8,
      followUp: true,
    });
    await newCustomer();
    await call('a1', today, {
      connected: true,
      rating: 6,
      campaignId: ids.campaign,
    });
    await call('a1', today, { connected: false });
    await call('a1', yesterday, { connected: false });
    await call('a1', old, { connected: true, rating: 10 });
    await prisma.campaignCustomer.createMany({
      data: [
        { campaignId: ids.campaign, customerId: customers[1], callCount: 1 },
        { campaignId: ids.campaign, customerId: customers[0] },
      ],
    });
    // a2 (same team): aaj 1 connected; a3 (doosri team): aaj 2
    await newCustomer();
    await call('a2', today, { connected: true, rating: 9 });
    await newCustomer();
    await call('a3', today, { connected: true });
    await call('a3', today, { connected: false });

    // Telephony: a1 → 120s + 60s talk, 1 no answer
    for (const [status, sec] of [
      ['COMPLETED', 120],
      ['COMPLETED', 60],
      ['NO_ANSWER', 0],
    ] as const) {
      await prisma.callSession.create({
        data: {
          provider: 'mock',
          customerId: customers[0],
          staffId: ids.a1,
          callId: c1.id,
          toNumber: '+919300000000',
          status,
          durationSec: sec,
          answeredAt: status === 'COMPLETED' ? new Date(today) : null,
          createdAt: new Date(today),
        },
      });
    }
    // Follow-ups (owner a1): ek time pe complete, ek abhi overdue (escalated bhi)
    const due1 = Math.max(todayStart + MIN, now - 60 * MIN);
    await prisma.followUp.create({
      data: {
        customerId: customers[0],
        sourceCallId: c1.id,
        ownerId: ids.a1,
        originalOwnerId: ids.a1,
        dueAt: new Date(due1),
        status: 'COMPLETED',
        completedAt: new Date(due1 + MIN),
      },
    });
    const c2 = await call('a2', yesterday, {
      connected: false,
      followUp: true,
    });
    await prisma.followUp.create({
      data: {
        customerId: customers[2],
        sourceCallId: c2.id,
        ownerId: ids.a1,
        originalOwnerId: ids.a2,
        dueAt: new Date(yesterday + 10 * MIN),
        status: 'PENDING',
        escalationCount: 1,
        openCustomerId: customers[2],
      },
    });
  });

  afterAll(async () => {
    const staffIds = ['mgr', 'tl', 'a1', 'a2', 'a3'].map((k) => ids[k]);
    await prisma.followUp.deleteMany({ where: { ownerId: { in: staffIds } } });
    await prisma.callSession.deleteMany({
      where: { staffId: { in: staffIds } },
    });
    await prisma.call.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.campaign.deleteMany({ where: { id: ids.campaign } });
    await prisma.customer.deleteMany({ where: { id: { in: customers } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: staffIds } } });
    await prisma.staff.updateMany({
      where: { id: { in: staffIds } },
      data: { teamId: null },
    });
    await prisma.team.deleteMany({
      where: { id: { in: [ids.team, ids.otherTeam] } },
    });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  it('assistant sees only own numbers (last 7 days): KPIs, daily, hour-wise, outcomes, talk time, follow-ups', async () => {
    const r = (await get('a1', 'summary').expect(200)).body;
    expect(r.range).toMatchObject({
      preset: '7d',
      days: 7,
      timezone: 'Asia/Kolkata',
    });
    expect(r.kpis).toEqual({
      calls: 4,
      connected: 2,
      connectRate: 50,
      avgRating: 7,
      customers: 2,
      followUpsPromised: 1,
      dials: 3,
      answered: 2,
      talkTimeSec: 180,
    });
    expect(r.daily).toHaveLength(7);
    expect(r.daily.at(-1)).toMatchObject({ calls: 3, connected: 2 });
    expect(r.daily.at(-2)).toMatchObject({ calls: 1, connected: 0 });
    expect(r.byHour).toHaveLength(24);
    expect(r.byHour[istHour(today)].calls).toBe(3);
    expect(
      r.outcomes.reduce((n: number, o: { calls: number }) => n + o.calls, 0),
    ).toBe(4);
    expect(r.followUps).toEqual({
      due: 2,
      completed: 1,
      onTime: 1,
      onTimeRate: 50,
      escalated: 1,
      overdueNow: 1,
    });
  });

  it('presets, custom range, previous period, validation', async () => {
    const t = (await get('a1', 'summary?range=today').expect(200)).body;
    expect(t.kpis.calls).toBe(3);
    expect(t.previous.calls).toBe(1); // kal
    expect(
      (await get('a1', 'summary?range=yesterday').expect(200)).body.kpis.calls,
    ).toBe(1);
    expect(
      (await get('a1', 'summary?range=30d').expect(200)).body.kpis,
    ).toMatchObject({ calls: 5, avgRating: 8 });

    const d = (iso: number) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
        new Date(iso),
      );
    const custom = (
      await get(
        'a1',
        `summary?range=custom&from=${d(old)}&to=${d(old)}`,
      ).expect(200)
    ).body;
    expect(custom.kpis.calls).toBe(1);
    await get('a1', 'summary?range=custom&from=2026-10-05').expect(400);
    await get(
      'a1',
      'summary?range=custom&from=2026-10-05&to=2026-10-01',
    ).expect(400);
    await get(
      'a1',
      'summary?range=custom&from=2020-01-01&to=2026-01-01',
    ).expect(400);
    await get('a1', 'summary?range=year').expect(400);
  });

  it('scope: assistant cannot look at others; TL = own team only; manager = any team', async () => {
    await get('a1', `summary?staffId=${ids.a2}`).expect(403);
    await get('a1', `summary?teamId=${ids.team}`).expect(403);
    await get('a1', 'assistants').expect(403);

    const tl = (await get('tl', 'summary?range=today').expect(200)).body;
    expect(tl.kpis.calls).toBe(4); // a1 3 + a2 1 (a3 doosri team)
    await get('tl', `summary?staffId=${ids.a3}`).expect(403);
    await get('tl', `summary?teamId=${ids.otherTeam}`).expect(403);
    expect(
      (await get('tl', `summary?range=today&staffId=${ids.a2}`).expect(200))
        .body.kpis.calls,
    ).toBe(1);

    const mgr = (
      await get('mgr', `summary?range=today&teamId=${ids.otherTeam}`).expect(
        200,
      )
    ).body;
    expect(mgr.kpis).toMatchObject({ calls: 2, connected: 1, connectRate: 50 });
  });

  it('assistant performance table (TL): team members only, per-person metrics', async () => {
    const r = (await get('tl', 'assistants').expect(200)).body;
    const names = r.assistants.map((a: { name: string }) => a.name);
    expect(names).toEqual(
      expect.arrayContaining([`Rep a1 ${suffix}`, `Rep a2 ${suffix}`]),
    );
    expect(names).not.toContain(`Rep a3 ${suffix}`);
    const a1 = r.assistants.find((a: { id: string }) => a.id === ids.a1);
    expect(a1).toMatchObject({
      team: `Rep Team ${suffix}`,
      calls: 4,
      connected: 2,
      connectRate: 50,
      avgRating: 7,
      dials: 3,
      talkTimeSec: 180,
      avgTalkSec: 90,
      followUpsDue: 2,
      followUpsCompleted: 1,
      overdueNow: 1,
    });
    expect(r.assistants[0].calls).toBeGreaterThanOrEqual(r.assistants[1].calls); // calls ke hisaab se sorted
  });

  it('campaign performance + campaign filter', async () => {
    const r = (
      await get('mgr', `campaigns?campaignId=${ids.campaign}`).expect(200)
    ).body;
    expect(r.campaigns).toEqual([
      expect.objectContaining({
        name: `Rep Camp ${suffix}`,
        customers: 2,
        called: 1,
        progress: 50,
        calls: 1,
        connected: 1,
        connectRate: 100,
        avgRating: 6,
      }),
    ]);
    const s = (
      await get('a1', `summary?campaignId=${ids.campaign}`).expect(200)
    ).body;
    expect(s.kpis.calls).toBe(1);
  });

  it('CSV exports: scoped rows, file name, audit; assistants cannot export', async () => {
    const res = await get('tl', 'export/calls.csv?range=today')
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="calls-today.csv"',
    );
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe(
      'called_at,assistant,team,customer,phone,external_id,outcome,connected,next_action,interest_rating,follow_up_at,campaign,user_response,notes,talk_time_sec,recording_url',
    );
    expect(lines).toHaveLength(1 + 4);
    expect(lines.some((l) => l.includes(`Rep a3 ${suffix}`))).toBe(false);
    expect(
      lines.find((l) => l.includes('Rep a1') && l.includes(',180,')),
    ).toBeDefined(); // talk time

    const a = await get(
      'mgr',
      `export/assistants.csv?teamId=${ids.team}`,
    ).expect(200);
    expect(a.text).toContain(`Rep a1 ${suffix}`);
    await get('mgr', 'export/campaigns.csv').expect(200);
    await get('mgr', 'export/secrets.csv').expect(400);
    await get('a1', 'export/calls.csv').expect(403);

    const audits = await prisma.auditLog.findMany({
      where: { actorId: { in: [ids.tl, ids.mgr] }, action: 'report.exported' },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((x) => (x.metadata as { type: string }).type)).toEqual([
      'calls',
      'assistants',
      'campaigns',
    ]);
    expect((audits[0].metadata as { rows: number }).rows).toBe(4);
  });
});
