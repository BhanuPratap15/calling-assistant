import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DEFAULT_ORG_ID, runUnscoped } from '../src/tenancy/tenant-context.js';

/**
 * White-label platform + multi-tenant isolation:
 *  - platform admin client banata hai (subdomain + custom domain + pehla admin + default settings)
 *  - ek client ka data / token / calling queue doosre client tak KABHI nahi pahunchta
 *  - suspend, domains, staff limit, domain-sync script API
 */
const BASE = 'crm-e2e.test';
const SYNC_TOKEN = 'e2e-sync-token-0123456789abcdef';
process.env.PLATFORM_BASE_DOMAIN = BASE;
process.env.PLATFORM_SYNC_TOKEN = SYNC_TOKEN;

describe('Platform + tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const slug = `acme-${suffix}`;
  const acmeHost = `${slug}.${BASE}`;
  const customDomain = `crm.${slug}.example.com`;
  const platformEmail = `e2e-platform-${suffix}@test.local`;
  const password = 'Password@123';
  let platformToken: string;
  let orgId: string;
  let acmeAdminToken: string;
  let defaultMgrToken: string;
  const phoneA = `+9715${String(Date.now()).slice(-8)}`;
  const phoneDefault = `+9714${String(Date.now()).slice(-8)}`;

  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const onAcme = (t?: string) => ({
    'X-Forwarded-Host': acmeHost,
    ...(t ? bearer(t) : {}),
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    await prisma.platformAdmin.create({
      data: { name: 'Platform', email: platformEmail, passwordHash },
    });
    // Default (purane) client ka manager + ek customer
    await prisma.staff.create({
      data: {
        name: 'Default Mgr',
        email: `e2e-def-mgr-${suffix}@test.local`,
        role: 'MANAGER',
        passwordHash,
      },
    });
    await prisma.customer.create({
      data: { name: `Default Cust ${suffix}`, phone: phoneDefault },
    });
    defaultMgrToken = (
      await http()
        .post('/api/auth/login')
        .send({ email: `e2e-def-mgr-${suffix}@test.local`, password })
        .expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    if (orgId) await purgeOrg(prisma, orgId);
    await prisma.customer.deleteMany({ where: { phone: phoneDefault } });
    await prisma.staff.deleteMany({
      where: { email: { endsWith: `${suffix}@test.local` } },
    });
    await runUnscoped(() =>
      prisma.platformAuditLog.deleteMany({
        where: { actor: { email: platformEmail } },
      }),
    );
    await prisma.platformAdmin.deleteMany({ where: { email: platformEmail } });
    await app.close();
  });

  it('platform login works; staff tokens / no token are rejected on platform routes', async () => {
    await http().get('/api/platform/organizations').expect(401);
    await http()
      .get('/api/platform/organizations')
      .set(bearer(defaultMgrToken))
      .expect(401);
    const res = await http()
      .post('/api/platform/auth/login')
      .send({ email: platformEmail, password })
      .expect(200);
    platformToken = res.body.accessToken;
    // Platform token staff routes pe nahi chalta
    await http().get('/api/auth/me').set(bearer(platformToken)).expect(401);
  });

  it('creates a client with subdomain, custom domain, defaults and first admin', async () => {
    const res = await http()
      .post('/api/platform/organizations')
      .set(bearer(platformToken))
      .send({
        name: 'Acme Corp',
        slug,
        brandName: 'Acme Calling',
        themePreset: 'emerald',
        customDomain,
        maxStaff: 3,
        admin: { name: 'Acme Admin', email: `admin-${suffix}@acme.test` },
      })
      .expect(201);
    orgId = res.body.organization.id;
    expect(
      res.body.organization.domains
        .map((d: { hostname: string }) => d.hostname)
        .sort(),
    ).toEqual([acmeHost, customDomain].sort());
    // Custom domain primary → login link wahi
    expect(res.body.adminCredentials.loginUrl).toBe(
      `https://${customDomain}/login`,
    );
    const tempPassword: string = res.body.adminCredentials.password;
    expect(tempPassword).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/);

    // Defaults seeded (outcomes / next actions / categories / settings)
    const counts = await runUnscoped(async () => ({
      outcomes: await prisma.callOutcome.count({
        where: { organizationId: orgId },
      }),
      actions: await prisma.nextAction.count({
        where: { organizationId: orgId },
      }),
      categories: await prisma.category.count({
        where: { organizationId: orgId },
      }),
      settings: await prisma.systemSetting.count({
        where: { organizationId: orgId },
      }),
    }));
    expect(counts).toEqual({
      outcomes: 7,
      actions: 5,
      categories: 4,
      settings: 2,
    });

    // Branding by host (subdomain + custom domain)
    const brand = await http().get('/api/branding').set(onAcme()).expect(200);
    expect(brand.body).toMatchObject({
      brandName: 'Acme Calling',
      themePreset: 'emerald',
    });
    const viaCustom = await http()
      .get('/api/branding')
      .set('X-Forwarded-Host', customDomain)
      .expect(200);
    expect(viaCustom.body.brandName).toBe('Acme Calling');

    // Admin login sirf acme ke host pe; default host pe wahi email nahi milta
    await http()
      .post('/api/auth/login')
      .send({ email: `admin-${suffix}@acme.test`, password: tempPassword })
      .expect(401);
    const login = await http()
      .post('/api/auth/login')
      .set(onAcme())
      .send({ email: `admin-${suffix}@acme.test`, password: tempPassword })
      .expect(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    const changed = await http()
      .post('/api/auth/change-password')
      .set(onAcme(login.body.accessToken))
      .send({ currentPassword: tempPassword, newPassword: password })
      .expect(200);
    acmeAdminToken = changed.body.accessToken;
  });

  it('unknown subdomain → 404 workspace not found', async () => {
    const res = await http()
      .get('/api/branding')
      .set('X-Forwarded-Host', `nope-${suffix}.${BASE}`)
      .expect(404);
    expect(res.body.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('data never crosses tenants (lists, ids, tokens)', async () => {
    const created = await http()
      .post('/api/customers')
      .set(onAcme(acmeAdminToken))
      .send({ name: `Acme Cust ${suffix}`, phone: phoneA })
      .expect(201);
    const acmeCustomerId = created.body.id;

    // Same phone default client me bhi ban sakta hai (unique per client)
    // ...par acme ka customer default ko dikhta nahi
    const defaultList = await http()
      .get(`/api/customers?search=${suffix}`)
      .set(bearer(defaultMgrToken))
      .expect(200);
    expect(defaultList.body.data.map((c: { name: string }) => c.name)).toEqual([
      `Default Cust ${suffix}`,
    ]);
    const acmeList = await http()
      .get(`/api/customers?search=${suffix}`)
      .set(onAcme(acmeAdminToken))
      .expect(200);
    expect(acmeList.body.data.map((c: { name: string }) => c.name)).toEqual([
      `Acme Cust ${suffix}`,
    ]);

    // Doosre client ki id se seedha access → 404
    await http()
      .get(`/api/customers/${acmeCustomerId}`)
      .set(bearer(defaultMgrToken))
      .expect(404);

    // Acme ka token default host pe (aur ulta) → 401
    await http().get('/api/auth/me').set(bearer(acmeAdminToken)).expect(401);
    await http().get('/api/auth/me').set(onAcme(defaultMgrToken)).expect(401);

    // Staff / settings bhi alag
    const staff = await http()
      .get('/api/staff')
      .set(onAcme(acmeAdminToken))
      .expect(200);
    const rows: { email: string }[] = Array.isArray(staff.body)
      ? staff.body
      : staff.body.data;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((s) => s.email.endsWith('@acme.test'))).toBe(true);
  });

  it('calling engine only hands out customers of the caller’s own client', async () => {
    await http()
      .post('/api/staff')
      .set(onAcme(acmeAdminToken))
      .send({
        name: 'Acme Caller',
        email: `caller-${suffix}@acme.test`,
        password,
        role: 'ASSISTANT',
      })
      .expect(201);
    const first = (
      await http()
        .post('/api/auth/login')
        .set(onAcme())
        .send({ email: `caller-${suffix}@acme.test`, password })
        .expect(200)
    ).body.accessToken;
    // Admin ka diya password → pehle khud badlo
    const caller = (
      await http()
        .post('/api/auth/change-password')
        .set(onAcme(first))
        .send({ currentPassword: password, newPassword: 'Password@456' })
        .expect(200)
    ).body.accessToken;
    const next = await http()
      .post('/api/calling/next')
      .set(onAcme(caller))
      .expect(200);
    // Default client me bhi fresh customers hain — par acme ko sirf apna milta hai
    expect(next.body.current?.customer?.phone).toBe(phoneA);
    await http().post('/api/calling/release').set(onAcme(caller)).expect(200);
  });

  it('enforces the staff limit of the plan', async () => {
    // admin + caller = 2 active; limit 3 → ek aur ban sakta hai, phir 409
    await http()
      .post('/api/staff')
      .set(onAcme(acmeAdminToken))
      .send({
        name: 'Third',
        email: `third-${suffix}@acme.test`,
        password,
        role: 'ASSISTANT',
      })
      .expect(201);
    const res = await http()
      .post('/api/staff')
      .set(onAcme(acmeAdminToken))
      .send({
        name: 'Fourth',
        email: `fourth-${suffix}@acme.test`,
        password,
        role: 'ASSISTANT',
      })
      .expect(409);
    expect(res.body.message).toMatch(/limit/i);
  });

  it('suspend blocks login + existing sessions; activate restores', async () => {
    await http()
      .post(`/api/platform/organizations/${orgId}/status`)
      .set(bearer(platformToken))
      .send({ status: 'SUSPENDED' })
      .expect(200);
    const blocked = await http()
      .get('/api/auth/me')
      .set(onAcme(acmeAdminToken))
      .expect(403);
    expect(blocked.body.code).toBe('WORKSPACE_SUSPENDED');
    // Branding phir bhi (login page "suspended" dikhaye)
    const brand = await http().get('/api/branding').set(onAcme()).expect(200);
    expect(brand.body.status).toBe('SUSPENDED');

    await http()
      .post(`/api/platform/organizations/${orgId}/status`)
      .set(bearer(platformToken))
      .send({ status: 'ACTIVE' })
      .expect(200);
    // Suspend pe purane tokens revoke ho gaye → dobara login
    await http().get('/api/auth/me').set(onAcme(acmeAdminToken)).expect(401);
    acmeAdminToken = (
      await http()
        .post('/api/auth/login')
        .set(onAcme())
        .send({ email: `admin-${suffix}@acme.test`, password })
        .expect(200)
    ).body.accessToken;
  });

  it('updates branding / theme and validates input', async () => {
    const logo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await http()
      .patch(`/api/platform/organizations/${orgId}`)
      .set(bearer(platformToken))
      .send({
        primaryColor: '#0EA5E9',
        sidebarStyle: 'light',
        logoUrl: logo,
        tagline: 'Sell more',
      })
      .expect(200);
    const brand = await http().get('/api/branding').set(onAcme()).expect(200);
    expect(brand.body).toMatchObject({
      primaryColor: '#0EA5E9',
      sidebarStyle: 'light',
      logoUrl: logo,
      tagline: 'Sell more',
    });

    await http()
      .patch(`/api/platform/organizations/${orgId}`)
      .set(bearer(platformToken))
      .send({ logoUrl: 'javascript:alert(1)' })
      .expect(400);
    await http()
      .patch(`/api/platform/organizations/${orgId}`)
      .set(bearer(platformToken))
      .send({ dialerMode: 'EXTERNAL_PANEL', externalDialerUrl: null })
      .expect(400);
    await http()
      .patch(`/api/platform/organizations/${orgId}`)
      .set(bearer(platformToken))
      .send({
        dialerMode: 'EXTERNAL_PANEL',
        externalDialerUrl: 'https://dialer.acme.test',
      })
      .expect(200);
    const tel = await http()
      .get('/api/telephony/config')
      .set(onAcme(acmeAdminToken))
      .expect(200);
    expect(tel.body).toEqual({
      provider: 'manual',
      mode: 'manual',
      externalDialerUrl: 'https://dialer.acme.test',
    });
  });

  it('manages domains and reports SSL status through the sync API', async () => {
    const added = await http()
      .post(`/api/platform/organizations/${orgId}/domains`)
      .set(bearer(platformToken))
      .send({ hostname: `app.${slug}.example.com` })
      .expect(201);
    await http()
      .post(`/api/platform/organizations/${orgId}/domains`)
      .set(bearer(platformToken))
      .send({ hostname: `app.${slug}.example.com` })
      .expect(409);

    // Sync script: token zaroori
    await http().get('/api/platform/domain-sync/domains').expect(401);
    const list = await http()
      .get('/api/platform/domain-sync/domains')
      .set('X-Sync-Token', SYNC_TOKEN)
      .expect(200);
    expect(list.text).toContain(`app.${slug}.example.com PENDING`);
    await http()
      .post('/api/platform/domain-sync/report')
      .set('X-Sync-Token', SYNC_TOKEN)
      .send({ hostname: `app.${slug}.example.com`, status: 'ACTIVE' })
      .expect(200);

    const org = await http()
      .get(`/api/platform/organizations/${orgId}`)
      .set(bearer(platformToken))
      .expect(200);
    const domain = org.body.domains.find(
      (d: { id: string }) => d.id === added.body.id,
    );
    expect(domain.status).toBe('ACTIVE');

    await http()
      .delete(`/api/platform/organizations/${orgId}/domains/${added.body.id}`)
      .set(bearer(platformToken))
      .expect(200);
    // Built-in subdomain hat nahi sakta
    const sub = org.body.domains.find(
      (d: { type: string }) => d.type === 'SUBDOMAIN',
    );
    await http()
      .delete(`/api/platform/organizations/${orgId}/domains/${sub.id}`)
      .set(bearer(platformToken))
      .expect(400);
  });

  it('resets a client admin password from the platform', async () => {
    const org = await http()
      .get(`/api/platform/organizations/${orgId}`)
      .set(bearer(platformToken))
      .expect(200);
    const admin = org.body.admins.find(
      (a: { email: string }) => a.email === `admin-${suffix}@acme.test`,
    );
    const reset = await http()
      .post(
        `/api/platform/organizations/${orgId}/staff/${admin.id}/reset-password`,
      )
      .set(bearer(platformToken))
      .expect(200);
    await http()
      .post('/api/auth/login')
      .set(onAcme())
      .send({
        email: `admin-${suffix}@acme.test`,
        password: reset.body.credentials.password,
      })
      .expect(200);
    // Default client ki list me acme nahi; platform list me dono
    const list = await http()
      .get('/api/platform/organizations')
      .set(bearer(platformToken))
      .expect(200);
    const slugs = list.body.map((o: { slug: string }) => o.slug);
    expect(slugs).toEqual(expect.arrayContaining(['default', slug]));
    const acme = list.body.find((o: { slug: string }) => o.slug === slug);
    expect(acme.usage.activeStaff).toBe(3);
    expect(acme.usage.customers).toBe(1);
  });
});

/** Test cleanup: ek client ka saara data (FK order me) */
async function purgeOrg(prisma: PrismaService, orgId: string) {
  if (orgId === DEFAULT_ORG_ID) throw new Error('never purge the default org');
  const tables = [
    'call_events',
    'call_sessions',
    'customer_category_changes',
    'follow_ups',
    'calls',
    'assignments',
    'notifications',
    'customer_tags',
    'campaign_customers',
    'campaign_staff',
    'campaign_teams',
    'campaign_fields',
    'import_rows',
    'import_batches',
    'campaigns',
    'customers',
    'tags',
    'categories',
    'call_outcomes',
    'next_actions',
    'system_settings',
    'audit_logs',
  ];
  for (const t of tables)
    await prisma.$executeRawUnsafe(
      `DELETE FROM "${t}" WHERE organization_id = $1::uuid`,
      orgId,
    );
  await prisma.$executeRawUnsafe(
    `UPDATE teams SET leader_id = NULL WHERE organization_id = $1::uuid`,
    orgId,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE staff SET team_id = NULL WHERE organization_id = $1::uuid`,
    orgId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM staff WHERE organization_id = $1::uuid`,
    orgId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM teams WHERE organization_id = $1::uuid`,
    orgId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM platform_audit_logs WHERE organization_id = $1::uuid`,
    orgId,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM organizations WHERE id = $1::uuid`,
    orgId,
  );
}
