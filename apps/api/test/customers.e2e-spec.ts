import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerToken: string;
  let assistantToken: string;
  // Har test file ka unique suffix — files parallel chalti hain, Date.now() same aa sakta hai
  const suffix = randomUUID().slice(0, 8);
  // Har test run ka unique phone (UAE mobile range) taaki purane data se clash na ho
  const phoneLocal = `50${String(Date.now()).slice(-7)}`;
  const phoneE164 = `+971${phoneLocal}`;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const password = 'Password@123';
    const passwordHash = await hashPassword(password);
    const managerEmail = `e2e-cust-mgr-${suffix}@test.local`;
    const assistantEmail = `e2e-cust-asst-${suffix}@test.local`;
    await prisma.staff.createMany({
      data: [
        { name: 'Mgr', email: managerEmail, role: 'MANAGER', passwordHash },
        {
          name: 'Asst',
          email: assistantEmail,
          role: 'ASSISTANT',
          passwordHash,
        },
      ],
    });
    const login = (email: string) =>
      http().post('/api/auth/login').send({ email, password });
    managerToken = (await login(managerEmail)).body.accessToken;
    assistantToken = (await login(assistantEmail)).body.accessToken;
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { phone: phoneE164 } });
    await prisma.staff.deleteMany({
      where: { email: { endsWith: `${suffix}@test.local` } },
    });
    await app.close();
  });

  let customerId: string;

  it('MANAGER creates a customer; phone is normalized to E.164', async () => {
    const res = await http()
      .post('/api/customers')
      .set(auth(managerToken))
      .send({
        name: 'Rahul Sharma',
        phone: `+971 ${phoneLocal}`,
        priority: 'HIGH',
      })
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Rahul Sharma',
      phone: phoneE164,
      priority: 'HIGH',
      status: 'ACTIVE',
    });
    customerId = res.body.id;
  });

  it('rejects a duplicate phone (written differently) with 409', async () => {
    await http()
      .post('/api/customers')
      .set(auth(managerToken))
      .send({ name: 'Duplicate', phone: `00971${phoneLocal}` })
      .expect(409);
  });

  it('rejects an invalid phone with 400', async () => {
    await http()
      .post('/api/customers')
      .set(auth(managerToken))
      .send({ name: 'Bad', phone: '12345' })
      .expect(400);
  });

  it('rejects unknown fields with 400 (whitelist)', async () => {
    await http()
      .post('/api/customers')
      .set(auth(managerToken))
      .send({ name: 'X', phone: '9876543210', hacker: true })
      .expect(400);
  });

  it('ASSISTANT cannot list or create customers (403)', async () => {
    await http().get('/api/customers').set(auth(assistantToken)).expect(403);
    await http()
      .post('/api/customers')
      .set(auth(assistantToken))
      .send({ name: 'X', phone: '9876543210' })
      .expect(403);
  });

  it('lists customers with search + pagination meta', async () => {
    const res = await http()
      .get('/api/customers')
      .query({ search: phoneLocal.slice(-6), pageSize: 5 })
      .set(auth(managerToken))
      .expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5 });
    expect(res.body.data.map((c: { id: string }) => c.id)).toContain(
      customerId,
    );
  });

  it('gets one customer; bad UUID → 400, unknown → 404', async () => {
    await http()
      .get(`/api/customers/${customerId}`)
      .set(auth(managerToken))
      .expect(200);
    await http().get('/api/customers/abc').set(auth(managerToken)).expect(400);
    await http()
      .get('/api/customers/00000000-0000-4000-8000-000000000000')
      .set(auth(managerToken))
      .expect(404);
  });

  it('MANAGER updates status to DO_NOT_CALL (PATCH)', async () => {
    const res = await http()
      .patch(`/api/customers/${customerId}`)
      .set(auth(managerToken))
      .send({ status: 'DO_NOT_CALL' })
      .expect(200);
    expect(res.body.status).toBe('DO_NOT_CALL');
    expect(res.body.phone).toBe(phoneE164); // baaki fields same
  });
});
