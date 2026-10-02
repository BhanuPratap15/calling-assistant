import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// REAL database pe poora login + role flow test. Test apna data khud banata aur saaf karta hai.
describe('Auth & RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = Date.now();
  const manager = {
    email: `e2e-manager-${suffix}@test.local`,
    password: 'Manager@123',
  };
  const assistant = {
    email: `e2e-assistant-${suffix}@test.local`,
    password: 'Assistant@123',
  };

  const login = (email: string, password: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.staff.createMany({
      data: [
        {
          name: 'E2E Manager',
          email: manager.email,
          role: 'MANAGER',
          passwordHash: await hashPassword(manager.password),
        },
        {
          name: 'E2E Assistant',
          email: assistant.email,
          role: 'ASSISTANT',
          passwordHash: await hashPassword(assistant.password),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.staff.deleteMany({
      where: { email: { endsWith: `${suffix}@test.local` } },
    });
    await app.close();
  });

  it('logs in with valid credentials and returns a token', async () => {
    const res = await login(manager.email, manager.password).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: manager.email,
      role: 'MANAGER',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password with 401', async () => {
    await login(manager.email, 'wrong-password').expect(401);
  });

  it('rejects an invalid body with 400 (validation)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('GET /api/auth/me requires a token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('GET /api/auth/me returns the logged-in staff', async () => {
    const { body } = await login(assistant.email, assistant.password);
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    expect(res.body).toMatchObject({
      email: assistant.email,
      role: 'ASSISTANT',
    });
  });

  it('GET /api/staff: MANAGER allowed (200), ASSISTANT forbidden (403)', async () => {
    const mgr = await login(manager.email, manager.password);
    const res = await request(app.getHttpServer())
      .get('/api/staff')
      .set('Authorization', `Bearer ${mgr.body.accessToken}`)
      .expect(200);
    expect(res.body[0]).not.toHaveProperty('passwordHash');

    const asst = await login(assistant.email, assistant.password);
    await request(app.getHttpServer())
      .get('/api/staff')
      .set('Authorization', `Bearer ${asst.body.accessToken}`)
      .expect(403);
  });

  it('blocks a deactivated staff even with a previously valid token', async () => {
    const { body } = await login(assistant.email, assistant.password);
    await prisma.staff.update({
      where: { email: assistant.email },
      data: { isActive: false },
    });
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(401);
  });
});
