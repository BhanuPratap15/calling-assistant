import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Staff & Teams management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const email = (name: string) => `e2e-st-${name}-${suffix}@test.local`;
  const teamName = (name: string) => `E2E ${name} ${suffix}`;
  const password = 'Password@123';
  let superToken: string;
  let managerToken: string;
  let managerId: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (mail: string, pass = password) =>
    (await http().post('/api/auth/login').send({ email: mail, password: pass }))
      .body.accessToken as string;

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
        {
          name: 'Super',
          email: email('super'),
          role: 'SUPER_ADMIN',
          passwordHash,
        },
        { name: 'Manager', email: email('mgr'), role: 'MANAGER', passwordHash },
      ],
    });
    managerId = (
      await prisma.staff.findUniqueOrThrow({ where: { email: email('mgr') } })
    ).id;
    superToken = await login(email('super'));
    managerToken = await login(email('mgr'));
  });

  afterAll(async () => {
    const where = { email: { endsWith: `${suffix}@test.local` } };
    await prisma.staff.updateMany({ where, data: { teamId: null } });
    await prisma.team.deleteMany({ where: { name: { endsWith: suffix } } });
    await prisma.staff.deleteMany({ where });
    await app.close();
  });

  let leaderId: string;
  let assistantId: string;
  let teamId: string;

  it('MANAGER creates a TEAM_LEADER and an ASSISTANT', async () => {
    const leader = await http()
      .post('/api/staff')
      .set(auth(managerToken))
      .send({
        name: 'Leader',
        email: email('lead'),
        password,
        role: 'TEAM_LEADER',
      })
      .expect(201);
    expect(leader.body).not.toHaveProperty('passwordHash');
    leaderId = leader.body.id;

    const asst = await http()
      .post('/api/staff')
      .set(auth(managerToken))
      .send({ name: 'Amit', email: email('amit'), password, role: 'ASSISTANT' })
      .expect(201);
    assistantId = asst.body.id;
  });

  it('MANAGER cannot create a MANAGER or SUPER_ADMIN (403)', async () => {
    for (const role of ['MANAGER', 'SUPER_ADMIN']) {
      await http()
        .post('/api/staff')
        .set(auth(managerToken))
        .send({ name: 'X', email: email(`x-${role}`), password, role })
        .expect(403);
    }
  });

  it('SUPER_ADMIN can create a MANAGER', async () => {
    await http()
      .post('/api/staff')
      .set(auth(superToken))
      .send({ name: 'Mgr2', email: email('mgr2'), password, role: 'MANAGER' })
      .expect(201);
  });

  it('rejects duplicate email (409) and weak password (400)', async () => {
    await http()
      .post('/api/staff')
      .set(auth(managerToken))
      .send({ name: 'Dup', email: email('amit'), password, role: 'ASSISTANT' })
      .expect(409);
    await http()
      .post('/api/staff')
      .set(auth(managerToken))
      .send({
        name: 'Weak',
        email: email('weak'),
        password: 'abc',
        role: 'ASSISTANT',
      })
      .expect(400);
  });

  it('creates a team; leader must be a TEAM_LEADER', async () => {
    await http()
      .post('/api/teams')
      .set(auth(managerToken))
      .send({ name: teamName('Bad'), leaderId: assistantId })
      .expect(400);

    const res = await http()
      .post('/api/teams')
      .set(auth(managerToken))
      .send({ name: teamName('Alpha'), leaderId })
      .expect(201);
    expect(res.body.leader.id).toBe(leaderId);
    teamId = res.body.id;

    await http()
      .post('/api/teams')
      .set(auth(managerToken))
      .send({ name: teamName('Alpha') })
      .expect(409);
  });

  it('adds the assistant to the team via PATCH /staff/:id', async () => {
    const res = await http()
      .patch(`/api/staff/${assistantId}`)
      .set(auth(managerToken))
      .send({ teamId })
      .expect(200);
    expect(res.body.team).toEqual({ id: teamId, name: teamName('Alpha') });

    const team = await http()
      .get(`/api/teams/${teamId}`)
      .set(auth(managerToken))
      .expect(200);
    expect(team.body._count.members).toBe(1);
    expect(team.body.members[0].id).toBe(assistantId);
  });

  it('staff created by a manager must change the password first (then old token is dead)', async () => {
    const firstToken = await login(email('lead'));
    const blocked = await http()
      .get('/api/teams')
      .set(auth(firstToken))
      .expect(403);
    expect(blocked.body.message).toBe('Password change required');
    const me = await http()
      .get('/api/auth/me')
      .set(auth(firstToken))
      .expect(200);
    expect(me.body.mustChangePassword).toBe(true);
    // naya password purane jaisa nahi ho sakta
    await http()
      .post('/api/auth/change-password')
      .set(auth(firstToken))
      .send({ currentPassword: password, newPassword: password })
      .expect(400);
    const changed = await http()
      .post('/api/auth/change-password')
      .set(auth(firstToken))
      .send({ currentPassword: password, newPassword: 'Leader@456' })
      .expect(200);
    expect(changed.body.accessToken).toEqual(expect.any(String));
    await http().get('/api/auth/me').set(auth(firstToken)).expect(401); // purana token bekaar
    const me2 = await http()
      .get('/api/auth/me')
      .set(auth(changed.body.accessToken))
      .expect(200);
    expect(me2.body.mustChangePassword).toBe(false);
  });

  it('TEAM_LEADER sees only own teams; ASSISTANT cannot see teams', async () => {
    const leaderToken = await login(email('lead'), 'Leader@456');
    const list = await http()
      .get('/api/teams')
      .set(auth(leaderToken))
      .expect(200);
    expect(list.body.map((t: { id: string }) => t.id)).toEqual([teamId]);
    await http().get(`/api/teams/${teamId}`).set(auth(leaderToken)).expect(200);

    const asstToken = await login(email('amit'));
    await http().get('/api/teams').set(auth(asstToken)).expect(403);
  });

  it('filters staff list by role and team', async () => {
    const res = await http()
      .get('/api/staff')
      .query({ role: 'ASSISTANT', teamId })
      .set(auth(managerToken))
      .expect(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([assistantId]);
  });

  it('reset password by manager → old fails, new works', async () => {
    await http()
      .post(`/api/staff/${assistantId}/reset-password`)
      .set(auth(managerToken))
      .send({ newPassword: 'NewPass@456' })
      .expect(204);
    expect(await login(email('amit'))).toBeUndefined();
    expect(await login(email('amit'), 'NewPass@456')).toEqual(
      expect.any(String),
    );
  });

  it('staff changes own password (needs correct current password)', async () => {
    const token = await login(email('lead'), 'Leader@456');
    const otherDevice = await login(email('lead'), 'Leader@456');
    await http()
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'wrong', newPassword: 'Leader@789' })
      .expect(401);
    await http()
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'Leader@456', newPassword: 'Leader@789' })
      .expect(200);
    // Doosre device ka session bhi khatam
    await http().get('/api/teams').set(auth(otherDevice)).expect(401);
    expect(await login(email('lead'), 'Leader@789')).toEqual(
      expect.any(String),
    );
  });

  it('nobody can lock themselves out (own role / active status)', async () => {
    await http()
      .patch(`/api/staff/${managerId}`)
      .set(auth(superToken))
      .send({ name: 'Renamed by super' })
      .expect(200);
    await http()
      .patch(`/api/staff/${managerId}`)
      .set(auth(managerToken))
      .send({ isActive: false })
      .expect(403); // manager MANAGER role ko manage nahi kar sakta (khud bhi)

    // SUPER_ADMIN sabko manage kar sakta hai, par khud ko deactivate nahi (lockout)
    const superId = (
      await prisma.staff.findUniqueOrThrow({ where: { email: email('super') } })
    ).id;
    await http()
      .patch(`/api/staff/${superId}`)
      .set(auth(superToken))
      .send({ isActive: false })
      .expect(400);
  });

  it('demoting a TEAM_LEADER removes them as leader of their teams', async () => {
    await http()
      .patch(`/api/staff/${leaderId}`)
      .set(auth(managerToken))
      .send({ role: 'ASSISTANT' })
      .expect(200);
    const team = await http()
      .get(`/api/teams/${teamId}`)
      .set(auth(managerToken))
      .expect(200);
    expect(team.body.leader).toBeNull();
  });

  it('deactivated assistant cannot log in', async () => {
    await http()
      .patch(`/api/staff/${assistantId}`)
      .set(auth(managerToken))
      .send({ isActive: false })
      .expect(200);
    expect(await login(email('amit'), 'NewPass@456')).toBeUndefined();
  });
});
