import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Call config (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const codeSuffix = suffix.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const email = (n: string) => `e2e-cc-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  let managerToken: string;
  let assistantToken: string;
  let originalRequired: unknown;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    await prisma.staff.createMany({
      data: [
        { name: 'Mgr', email: email('mgr'), role: 'MANAGER', passwordHash },
        { name: 'Asst', email: email('asst'), role: 'ASSISTANT', passwordHash },
      ],
    });
    const login = async (e: string) =>
      (await http().post('/api/auth/login').send({ email: e, password })).body
        .accessToken;
    managerToken = await login(email('mgr'));
    assistantToken = await login(email('asst'));
    originalRequired = (
      await prisma.systemSetting.findUnique({
        where: { key: 'call_form.required_fields' },
      })
    )?.value;
  });

  afterAll(async () => {
    // Shared settings wapas waise hi (doosre tests / dev data pe asar na ho)
    if (originalRequired) {
      await prisma.systemSetting.update({
        where: { key: 'call_form.required_fields' },
        data: { value: originalRequired as object },
      });
    }
    await prisma.callOutcome.deleteMany({
      where: { code: { endsWith: codeSuffix } },
    });
    await prisma.nextAction.deleteMany({
      where: { code: { endsWith: codeSuffix } },
    });
    const ids = (
      await prisma.staff.findMany({
        where: { email: { endsWith: `${suffix}@test.local` } },
        select: { id: true },
      })
    ).map((s) => s.id);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.staff.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('any logged-in staff gets the default call form config (from migration)', async () => {
    const res = await http()
      .get('/api/call-config')
      .set(auth(assistantToken))
      .expect(200);
    const codes = res.body.outcomes.map((o: { code: string }) => o.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'CONNECTED',
        'NO_ANSWER',
        'BUSY',
        'WRONG_NUMBER',
      ]),
    );
    const followUp = res.body.nextActions.find(
      (a: { code: string }) => a.code === 'FOLLOW_UP',
    );
    expect(followUp.requiresFollowUp).toBe(true);
    expect(Object.keys(res.body.requiredFields).sort()).toEqual([
      'interestRating',
      'notes',
      'userResponse',
    ]);
  });

  it('ASSISTANT cannot change config (403)', async () => {
    await http()
      .get('/api/call-config/admin')
      .set(auth(assistantToken))
      .expect(403);
    await http()
      .post('/api/call-config/outcomes')
      .set(auth(assistantToken))
      .send({ code: `X_${codeSuffix}`, label: 'X' })
      .expect(403);
  });

  it('MANAGER adds an outcome; duplicate code → 409; bad code → 400', async () => {
    const code = `CALLBACK_${codeSuffix}`;
    const res = await http()
      .post('/api/call-config/outcomes')
      .set(auth(managerToken))
      .send({
        code,
        label: 'Callback Requested',
        isConnected: true,
        sortOrder: 25,
      })
      .expect(201);
    expect(res.body).toMatchObject({ code, isConnected: true, isActive: true });

    await http()
      .post('/api/call-config/outcomes')
      .set(auth(managerToken))
      .send({ code, label: 'Dup' })
      .expect(409);
    await http()
      .post('/api/call-config/outcomes')
      .set(auth(managerToken))
      .send({ code: 'bad code', label: 'Bad' })
      .expect(400);
  });

  it('deactivated outcome disappears from the form but stays in admin list', async () => {
    const outcome = await prisma.callOutcome.findUniqueOrThrow({
      where: { code: `CALLBACK_${codeSuffix}` },
    });
    await http()
      .patch(`/api/call-config/outcomes/${outcome.id}`)
      .set(auth(managerToken))
      .send({ isActive: false, label: 'Callback (old)' })
      .expect(200);

    const form = await http()
      .get('/api/call-config')
      .set(auth(assistantToken))
      .expect(200);
    expect(form.body.outcomes.map((o: { id: string }) => o.id)).not.toContain(
      outcome.id,
    );

    const admin = await http()
      .get('/api/call-config/admin')
      .set(auth(managerToken))
      .expect(200);
    expect(admin.body.outcomes.map((o: { id: string }) => o.id)).toContain(
      outcome.id,
    );

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'call_outcome.updated', entityId: outcome.id },
    });
    expect(log.changes).toEqual({
      label: { from: 'Callback Requested', to: 'Callback (old)' },
      isActive: { from: true, to: false },
    });
  });

  it('MANAGER adds a next action that requires a follow-up', async () => {
    const res = await http()
      .post('/api/call-config/next-actions')
      .set(auth(managerToken))
      .send({
        code: `VIP_CALL_${codeSuffix}`,
        label: 'VIP Call',
        requiresFollowUp: true,
      })
      .expect(201);
    expect(res.body.requiresFollowUp).toBe(true);
  });

  it('MANAGER updates required fields; invalid rule → 400', async () => {
    const body = {
      userResponse: 'optional',
      notes: 'always',
      interestRating: 'connected',
    };
    await http()
      .put('/api/call-config/required-fields')
      .set(auth(managerToken))
      .send(body)
      .expect(200);
    const res = await http()
      .get('/api/call-config')
      .set(auth(assistantToken))
      .expect(200);
    expect(res.body.requiredFields).toEqual(body);

    await http()
      .put('/api/call-config/required-fields')
      .set(auth(managerToken))
      .send({ ...body, notes: 'sometimes' })
      .expect(400);
  });
});
