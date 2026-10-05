import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Audit log (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const email = (name: string) => `e2e-audit-${name}-${suffix}@test.local`;
  const password = 'Password@123';
  const phone = `+97150${String(Date.now()).slice(-7)}`;
  let managerId: string;
  let managerToken: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const logsFor = (query: Record<string, string>) =>
    http()
      .get('/api/audit-logs')
      .query(query)
      .set(auth(managerToken))
      .expect(200);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const manager = await prisma.staff.create({
      data: {
        name: 'Audit Mgr',
        email: email('mgr'),
        role: 'MANAGER',
        passwordHash: await hashPassword(password),
      },
    });
    managerId = manager.id;
    managerToken = (
      await http()
        .post('/api/auth/login')
        .send({ email: email('mgr'), password })
    ).body.accessToken;
  });

  afterAll(async () => {
    const staffIds = (
      await prisma.staff.findMany({
        where: { email: { endsWith: `${suffix}@test.local` } },
        select: { id: true },
      })
    ).map((s) => s.id);
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: staffIds } },
          { entityId: { in: staffIds } },
          {
            metadata: {
              path: ['email'],
              string_ends_with: `${suffix}@test.local`,
            },
          },
        ],
      },
    });
    await prisma.customer.deleteMany({ where: { phone } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  it('records successful login', async () => {
    const res = await logsFor({ action: 'auth.login', actorId: managerId });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].actor).toMatchObject({
      id: managerId,
      name: 'Audit Mgr',
    });
  });

  it('records failed login without an actor (and never the password)', async () => {
    await http()
      .post('/api/auth/login')
      .send({ email: email('mgr'), password: 'wrong-pass-1' })
      .expect(401);
    const res = await logsFor({
      action: 'auth.login_failed',
      entityId: managerId,
    });
    const entry = res.body.data[0];
    expect(entry.actor).toBeNull();
    expect(entry.metadata).toEqual({
      email: email('mgr'),
      reason: 'wrong_password',
      ip: expect.any(String), // kis IP se try hua (brute-force jaanch)
    });
    expect(JSON.stringify(entry)).not.toContain('wrong-pass-1');
  });

  it('records staff create + update with only the changed fields', async () => {
    const created = await http()
      .post('/api/staff')
      .set(auth(managerToken))
      .send({ name: 'Amit', email: email('amit'), password, role: 'ASSISTANT' })
      .expect(201);
    const staffId = created.body.id;

    await http()
      .patch(`/api/staff/${staffId}`)
      .set(auth(managerToken))
      .send({ name: 'Amit Kumar', phone: undefined })
      .expect(200);

    const res = await logsFor({ entityType: 'staff', entityId: staffId });
    const actions = res.body.data.map((e: { action: string }) => e.action);
    expect(actions).toEqual(['staff.updated', 'staff.created']); // newest first
    expect(res.body.data[0].changes).toEqual({
      name: { from: 'Amit', to: 'Amit Kumar' },
    });
  });

  it('does not write an update entry when nothing changed', async () => {
    const staff = await prisma.staff.findUniqueOrThrow({
      where: { email: email('amit') },
    });
    await http()
      .patch(`/api/staff/${staff.id}`)
      .set(auth(managerToken))
      .send({ name: 'Amit Kumar' }) // same value
      .expect(200);
    const res = await logsFor({ action: 'staff.updated', entityId: staff.id });
    expect(res.body.meta.total).toBe(1);
  });

  it('records password reset without any password value', async () => {
    const staff = await prisma.staff.findUniqueOrThrow({
      where: { email: email('amit') },
    });
    await http()
      .post(`/api/staff/${staff.id}/reset-password`)
      .set(auth(managerToken))
      .send({ newPassword: 'Secret@999' })
      .expect(204);
    const res = await logsFor({
      action: 'staff.password_reset',
      entityId: staff.id,
    });
    expect(res.body.data[0].changes).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('Secret@999');
  });

  it('records customer status change (from → to)', async () => {
    const created = await http()
      .post('/api/customers')
      .set(auth(managerToken))
      .send({ name: 'Rahul', phone })
      .expect(201);
    await http()
      .patch(`/api/customers/${created.body.id}`)
      .set(auth(managerToken))
      .send({ status: 'DO_NOT_CALL' })
      .expect(200);

    const res = await logsFor({
      entityType: 'customer',
      entityId: created.body.id,
    });
    expect(res.body.data[0]).toMatchObject({
      action: 'customer.updated',
      changes: { status: { from: 'ACTIVE', to: 'DO_NOT_CALL' } },
    });
  });

  it('only MANAGER / SUPER_ADMIN can read audit logs; no write API exists', async () => {
    const asstToken = (
      await http()
        .post('/api/auth/login')
        .send({ email: email('amit'), password: 'Secret@999' })
    ).body.accessToken;
    await http().get('/api/audit-logs').set(auth(asstToken)).expect(403);
    await http()
      .post('/api/audit-logs')
      .set(auth(managerToken))
      .send({})
      .expect(404);
  });

  it('validates filters (bad action → 400)', async () => {
    await http()
      .get('/api/audit-logs')
      .query({ action: 'hack.everything' })
      .set(auth(managerToken))
      .expect(400);
  });
});
