import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Phase 9.1 — security hardening (ADR 0014):
 * security headers, token revoke (logout / reset / deactivate), forced password change,
 * login brute-force lock, global rate limit.
 */
describe('Security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-sec-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const ids: Record<string, string> = {};
  const http = (a = app) => request(a.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (who: string, pass = password) =>
    http()
      .post('/api/auth/login')
      .send({ email: email(who), password: pass });
  const token = async (who: string, pass = password) =>
    (await login(who, pass).expect(200)).body.accessToken as string;

  async function createApp(env: Record<string, string> = {}) {
    const saved = Object.fromEntries(
      Object.keys(env).map((k) => [k, process.env[k]]),
    );
    Object.assign(process.env, env);
    const a = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    configureApp(a);
    await a.init();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return a;
  }

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);
    for (const [n, role] of [
      ['mgr', 'MANAGER'],
      ['a1', 'ASSISTANT'],
      ['a2', 'ASSISTANT'],
      ['brute', 'ASSISTANT'],
    ] as const) {
      ids[n] = (
        await prisma.staff.create({
          data: { name: `Sec ${n}`, email: email(n), role, passwordHash },
        })
      ).id;
    }
  });

  afterAll(async () => {
    const staffIds = Object.values(ids);
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorId: { in: staffIds } }, { entityId: { in: staffIds } }],
      },
    });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  it('security headers on every response; no X-Powered-By', async () => {
    const res = await http().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('logout revokes the token (a copied / stolen token stops working)', async () => {
    const t = await token('a1');
    const copy = t;
    await http().get('/api/auth/me').set(auth(t)).expect(200);
    await http().post('/api/auth/logout').set(auth(t)).expect(204);
    const res = await http().get('/api/auth/me').set(auth(copy)).expect(401);
    expect(res.body.message).toBe('Session expired — please log in again');
    const fresh = await token('a1'); // naya login theek
    await http().get('/api/auth/me').set(auth(fresh)).expect(200);
  });

  it('manager password reset: old sessions die + must change password before anything else', async () => {
    const before = await token('a2');
    const mgr = await token('mgr');
    await http()
      .post(`/api/staff/${ids.a2}/reset-password`)
      .set(auth(mgr))
      .send({ newPassword: 'Temp@12345' })
      .expect(204);
    await http().get('/api/auth/me').set(auth(before)).expect(401);

    const t = await token('a2', 'Temp@12345');
    expect((await login('a2', 'Temp@12345')).body.user.mustChangePassword).toBe(
      true,
    );
    await http().get('/api/calling/current').set(auth(t)).expect(403);
    const changed = await http()
      .post('/api/auth/change-password')
      .set(auth(t))
      .send({ currentPassword: 'Temp@12345', newPassword: 'Mine@54321' })
      .expect(200);
    await http()
      .get('/api/calling/current')
      .set(auth(changed.body.accessToken))
      .expect(200);
  });

  it('deactivate → reactivate does not bring old tokens back', async () => {
    const old = await token('a1');
    const mgr = await token('mgr');
    await http()
      .patch(`/api/staff/${ids.a1}`)
      .set(auth(mgr))
      .send({ isActive: false })
      .expect(200);
    await http().get('/api/auth/me').set(auth(old)).expect(401);
    await http()
      .patch(`/api/staff/${ids.a1}`)
      .set(auth(mgr))
      .send({ isActive: true })
      .expect(200);
    await http().get('/api/auth/me').set(auth(old)).expect(401);
  });

  it('brute force: 5 wrong passwords lock that email for this IP — even the right password gets 429', async () => {
    for (let i = 0; i < 5; i++) await login('brute', `wrong-${i}`).expect(401);
    const locked = await login('brute').expect(429);
    expect(locked.body.message).toMatch(
      /Too many failed login attempts\. Try again in \d+ minute/,
    );
    // X-Forwarded-For se IP badalne ki koshish — TRUST_PROXY nahi hai to header ignore hota hai
    await http()
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.9')
      .send({ email: email('brute'), password })
      .expect(429);
    // Doosra account is IP se abhi bhi login kar sakta hai
    await login('mgr').expect(200);
  });

  it('global rate limit per IP → 429 after the limit (RATE_LIMIT_PER_MIN)', async () => {
    const small = await createApp({ RATE_LIMIT_PER_MIN: '5' });
    try {
      for (let i = 0; i < 5; i++)
        await http(small).get('/api/health').expect(200);
      const res = await http(small).get('/api/health').expect(429);
      expect(res.headers['retry-after']).toBeDefined();
    } finally {
      await small.close();
    }
  });
});
