import { randomInt, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Phase 9.5 load test me mila bug: bahut assistants EK SAATH queue ka pehla customer maangein to
 * kuch ko (customers hote hue bhi) "koi customer nahi" mil jaata tha (retry jaldi khatam).
 * Ye test 12 assistants × 5 rounds bina ruke chalata hai: har baar customer milna chahiye, duplicate kabhi nahi.
 */
describe('Assignment engine under contention (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const block = String(randomInt(1000, 9999));
  const N = 12;
  const ROUNDS = 5;
  const staffIds: string[] = [];
  const customerIds: string[] = [];
  const tokens: string[] = [];
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword('Password@123');
    for (let i = 0; i < N; i++) {
      const s = await prisma.staff.create({
        data: {
          name: `Rush ${i}`,
          email: `e2e-rush-${i}-${suffix}@test.local`,
          role: 'ASSISTANT',
          passwordHash,
        },
      });
      staffIds.push(s.id);
      tokens.push(
        (
          await http()
            .post('/api/auth/login')
            .send({ email: s.email, password: 'Password@123' })
        ).body.accessToken,
      );
    }
    // Har assistant ROUNDS+1 customers lega — pool kabhi khatam na ho (URGENT → sabse pehle yahi)
    const { count } = await prisma.customer.createMany({
      data: Array.from({ length: N * (ROUNDS + 2) }, (_, i) => ({
        name: `Rush Cust ${i} ${suffix}`,
        phone: `+9192${block}${String(i).padStart(4, '0')}`,
        priority: 'URGENT' as const,
      })),
    });
    expect(count).toBe(N * (ROUNDS + 2));
    customerIds.push(
      ...(
        await prisma.customer.findMany({
          where: { name: { endsWith: suffix } },
          select: { id: true },
        })
      ).map((c) => c.id),
    );
  });

  afterAll(async () => {
    await prisma.assignment.deleteMany({
      where: { staffId: { in: staffIds } },
    });
    await prisma.call.deleteMany({ where: { staffId: { in: staffIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: staffIds } } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  it(`${N} assistants × ${ROUNDS} rounds at the same time: everyone always gets a customer, no duplicates`, async () => {
    const cfg = (
      await http()
        .get('/api/call-config')
        .set({ Authorization: `Bearer ${tokens[0]}` })
    ).body;
    const outcome = cfg.outcomes.find(
      (o: { isConnected: boolean }) => !o.isConnected,
    ).id;
    const action = cfg.nextActions.find(
      (a: { requiresFollowUp: boolean }) => !a.requiresFollowUp,
    ).id;
    const empty: string[] = [];
    const seen = new Map<string, number>();

    await Promise.all(
      tokens.map(async (t, i) => {
        const auth = { Authorization: `Bearer ${t}` };
        let cur = (await http().post('/api/calling/next').set(auth).expect(200))
          .body.current;
        for (let r = 0; r < ROUNDS; r++) {
          if (!cur) {
            empty.push(`assistant ${i} round ${r}`);
            return;
          }
          seen.set(cur.customer.id, (seen.get(cur.customer.id) ?? 0) + 1);
          cur = (
            await http()
              .post('/api/calling/complete')
              .set(auth)
              .send({ outcomeId: outcome, nextActionId: action })
              .expect(200)
          ).body.current;
        }
      }),
    );

    expect(empty).toEqual([]); // pehle: kuch assistants ko "koi customer nahi" milta tha
    expect([...seen.values()].every((n) => n === 1)).toBe(true); // ek customer ek hi baar
    expect(seen.size).toBe(N * ROUNDS);
  }, 60_000);
});
