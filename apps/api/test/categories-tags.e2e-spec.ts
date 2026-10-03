import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { CategoriesService } from '../src/categories/categories.service.js';
import type { SaveCategoriesDto } from '../src/categories/dto/category.dto.js';
import type { Category } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Rating, categories & tags (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-cat-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let original: Category[];
  let byCode: Record<string, Category>;
  let outcomes: Record<string, string>;
  let actions: Record<string, string>;
  const customers: string[] = [];
  const tagIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const customer = (id: string) =>
    prisma.customer.findUniqueOrThrow({ where: { id } });
  const asInput = (c: Category, patch: Partial<Category> = {}) => {
    const v = { ...c, ...patch };
    return {
      id: v.id,
      code: v.code,
      label: v.label,
      minRating: v.minRating,
      maxRating: v.maxRating,
      color: v.color,
      priority: v.priority,
      isActive: v.isActive,
      sortOrder: v.sortOrder,
    };
  };

  /** Manager customer ko assistant ki queue me daale, assistant call karke rating de */
  async function callWithRating(customerId: string, rating: number | null) {
    await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId, staffId: ids.asst })
      .expect(201);
    const next = await http()
      .post('/api/calling/next')
      .set(as('asst'))
      .expect(200);
    expect(next.body.current.customer.id).toBe(customerId);
    const body =
      rating === null
        ? {
            outcomeId: outcomes.NO_ANSWER,
            nextActionId: actions.NO_FURTHER_ACTION,
          }
        : {
            outcomeId: outcomes.CONNECTED,
            nextActionId: actions.NO_FURTHER_ACTION,
            userResponse: 'ok',
            notes: 'talked',
            interestRating: rating,
          };
    const done = await http()
      .post('/api/calling/complete')
      .set(as('asst'))
      .send(body)
      .expect(200);
    // Save & Next ne agla customer de diya ho (engine ka sahi behaviour) → test ke liye wapas pool me
    if (done.body.current) {
      await http()
        .post(`/api/assignments/${done.body.current.id}/cancel`)
        .set(as('mgr'))
        .expect(200);
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    original = await prisma.category.findMany();
    byCode = Object.fromEntries(original.map((c) => [c.code, c]));

    const passwordHash = await hashPassword(password);
    for (const [name, role] of [
      ['mgr', 'MANAGER'],
      ['asst', 'ASSISTANT'],
      ['other', 'ASSISTANT'],
    ] as const) {
      ids[name] = (
        await prisma.staff.create({
          data: { name: `Cat ${name}`, email: email(name), role, passwordHash },
        })
      ).id;
      tokens[name] = (
        await http()
          .post('/api/auth/login')
          .send({ email: email(name), password })
      ).body.accessToken;
    }
    for (let i = 0; i < 2; i++) {
      customers.push(
        (
          await prisma.customer.create({
            data: {
              name: `Cat Cust ${i} ${suffix}`,
              phone: `+97158${String(Date.now()).slice(-6)}${i}`,
              priority: 'NORMAL',
            },
          })
        ).id,
      );
    }
    const config = (await http().get('/api/call-config').set(as('asst'))).body;
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
    // Categories wapas original + baaki data ke customers bhi wapas recalculate
    await app.get(CategoriesService).save(
      {
        categories: original.map((c) =>
          asInput(c),
        ) as SaveCategoriesDto['categories'],
      },
      { id: ids.mgr, name: 'Cat mgr', email: email('mgr'), role: 'MANAGER' },
    );
    await prisma.category.deleteMany({
      where: { code: { endsWith: suffix.toUpperCase().replace(/-/g, '') } },
    });
    await prisma.tag.deleteMany({ where: { id: { in: tagIds } } });
    await prisma.assignment.deleteMany({
      where: { customerId: { in: customers } },
    });
    await prisma.followUp.deleteMany({
      where: { customerId: { in: customers } },
    });
    await prisma.customerCategoryChange.deleteMany({
      where: { customerId: { in: customers } },
    });
    await prisma.call.deleteMany({ where: { customerId: { in: customers } } });
    await prisma.customer.deleteMany({ where: { id: { in: customers } } });
    const staffIds = Object.values(ids);
    await prisma.customerCategoryChange.deleteMany({
      where: { changedById: { in: staffIds } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: staffIds } } });
    await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    await app.close();
  });

  it('default categories from migration (design doc thresholds)', async () => {
    const res = await http().get('/api/categories').set(as('asst')).expect(200);
    const ranges = Object.fromEntries(
      res.body.map((c: Category) => [c.code, `${c.minRating}-${c.maxRating}`]),
    );
    expect(ranges).toMatchObject({
      LOW_INTEREST: '0-4',
      MEDIUM_INTEREST: '5-7',
      HIGH_INTEREST: '8-9',
      VIP: '10-10',
    });
  });

  it('rating 9 → High Interest, priority HIGH, history + audit', async () => {
    await callWithRating(customers[0], 9);
    const c = await customer(customers[0]);
    expect(c).toMatchObject({
      interestRating: 9,
      categoryId: byCode.HIGH_INTEREST.id,
      priority: 'HIGH',
    });

    const history = await prisma.customerCategoryChange.findMany({
      where: { customerId: customers[0] },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromId: null,
      toId: byCode.HIGH_INTEREST.id,
      rating: 9,
      reason: 'call_rating',
    });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'customer.category_changed', entityId: customers[0] },
    });
    expect(audit.changes).toMatchObject({
      priority: { from: 'NORMAL', to: 'HIGH' },
    });
  });

  it('same category again → no new history; "No Answer" (no rating) keeps category', async () => {
    await callWithRating(customers[0], 8);
    await callWithRating(customers[0], null);
    const c = await customer(customers[0]);
    expect(c).toMatchObject({
      interestRating: 8,
      categoryId: byCode.HIGH_INTEREST.id,
    });
    expect(
      await prisma.customerCategoryChange.count({
        where: { customerId: customers[0] },
      }),
    ).toBe(1);
  });

  it('rating 10 → VIP with URGENT priority', async () => {
    await callWithRating(customers[0], 10);
    expect(await customer(customers[0])).toMatchObject({
      categoryId: byCode.VIP.id,
      priority: 'URGENT',
    });
  });

  it('manager changes "8+" to "7+" → existing customers recalculated (threshold_change)', async () => {
    // customer 1: pehle se rating 7 → Medium
    await prisma.customer.update({
      where: { id: customers[1] },
      data: { interestRating: 7, categoryId: byCode.MEDIUM_INTEREST.id },
    });
    const res = await http()
      .put('/api/categories')
      .set(as('mgr'))
      .send({
        categories: [
          asInput(byCode.MEDIUM_INTEREST, { maxRating: 6 }),
          asInput(byCode.HIGH_INTEREST, { minRating: 7 }),
        ],
      })
      .expect(200);
    expect(res.body.recalculated).toBeGreaterThanOrEqual(1);
    expect(res.body.uncovered).toEqual([]);

    expect(await customer(customers[1])).toMatchObject({
      categoryId: byCode.HIGH_INTEREST.id,
      priority: 'HIGH',
    });
    const change = await prisma.customerCategoryChange.findFirstOrThrow({
      where: { customerId: customers[1] },
    });
    expect(change).toMatchObject({
      fromId: byCode.MEDIUM_INTEREST.id,
      toId: byCode.HIGH_INTEREST.id,
      reason: 'threshold_change',
      changedById: ids.mgr,
    });
  });

  it('validation: overlap / code change → 400; assistant → 403', async () => {
    const overlap = await http()
      .put('/api/categories')
      .set(as('mgr'))
      .send({ categories: [asInput(byCode.LOW_INTEREST, { maxRating: 8 })] })
      .expect(400);
    expect(overlap.body.message.join(' ')).toContain('overlap');

    await http()
      .put('/api/categories')
      .set(as('mgr'))
      .send({ categories: [asInput(byCode.VIP, { code: 'SUPER_VIP' })] })
      .expect(400);
    await http()
      .put('/api/categories')
      .set(as('asst'))
      .send({ categories: [asInput(byCode.VIP)] })
      .expect(403);
  });

  it('deactivating VIP → rating 10 has no category (gap reported as warning)', async () => {
    const res = await http()
      .put('/api/categories')
      .set(as('mgr'))
      .send({ categories: [asInput(byCode.VIP, { isActive: false })] })
      .expect(200);
    expect(res.body.uncovered).toEqual([10]);
    expect((await customer(customers[0])).categoryId).toBeNull();

    await http()
      .put('/api/categories')
      .set(as('mgr'))
      .send({ categories: [asInput(byCode.VIP)] })
      .expect(200);
    expect((await customer(customers[0])).categoryId).toBe(byCode.VIP.id);
  });

  it('summary counts + list filter by category + sort by rating', async () => {
    const summary = await http()
      .get('/api/categories/summary')
      .set(as('mgr'))
      .expect(200);
    expect(
      summary.body.categories.find((c: { code: string }) => c.code === 'VIP')
        .count,
    ).toBeGreaterThanOrEqual(1);

    const list = await http()
      .get('/api/customers')
      .query({
        categoryId: byCode.VIP.id,
        sort: 'rating',
        search: `Cat Cust 0 ${suffix}`,
      })
      .set(as('mgr'))
      .expect(200);
    expect(list.body.data[0]).toMatchObject({
      id: customers[0],
      category: { code: 'VIP' },
    });
  });

  it('tags: manager creates (dup 409), sets on customer, filter works; assistant rules', async () => {
    const vip = await http()
      .post('/api/tags')
      .set(as('mgr'))
      .send({ name: `Big Spender ${suffix}`, color: 'green' })
      .expect(201);
    tagIds.push(vip.body.id);
    await http()
      .post('/api/tags')
      .set(as('mgr'))
      .send({ name: `Big Spender ${suffix}` })
      .expect(409);
    await http()
      .post('/api/tags')
      .set(as('asst'))
      .send({ name: `X ${suffix}` })
      .expect(403);
    const old = await http()
      .post('/api/tags')
      .set(as('mgr'))
      .send({ name: `Old ${suffix}` })
      .expect(201);
    tagIds.push(old.body.id);
    await http()
      .patch(`/api/tags/${old.body.id}`)
      .set(as('mgr'))
      .send({ isActive: false })
      .expect(200);

    await http()
      .put(`/api/customers/${customers[0]}/tags`)
      .set(as('mgr'))
      .send({ tagIds: [vip.body.id] })
      .expect(200);
    await http()
      .put(`/api/customers/${customers[0]}/tags`)
      .set(as('mgr'))
      .send({ tagIds: [old.body.id] })
      .expect(400); // inactive
    const filtered = await http()
      .get('/api/customers')
      .query({ tagId: vip.body.id })
      .set(as('mgr'))
      .expect(200);
    expect(filtered.body.data.map((c: { id: string }) => c.id)).toEqual([
      customers[0],
    ]);

    // assistant: sirf apna current customer
    await http()
      .put(`/api/customers/${customers[1]}/tags`)
      .set(as('other'))
      .send({ tagIds: [vip.body.id] })
      .expect(403);
    await http()
      .post('/api/assignments')
      .set(as('mgr'))
      .send({ customerId: customers[1], staffId: ids.other })
      .expect(201);
    await http()
      .put(`/api/customers/${customers[1]}/tags`)
      .set(as('other'))
      .send({ tagIds: [vip.body.id] })
      .expect(200);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'customer.tags_updated', entityId: customers[0] },
    });
    expect(audit.changes).toEqual({
      tags: { from: [], to: [`Big Spender ${suffix}`] },
    });
  });

  it('360° profile shows category, tags and category history', async () => {
    const res = await http()
      .get(`/api/customers/${customers[0]}/profile`)
      .set(as('mgr'))
      .expect(200);
    expect(res.body.category.code).toBe('VIP');
    expect(
      res.body.tags.map((t: { tag: { name: string } }) => t.tag.name),
    ).toEqual([`Big Spender ${suffix}`]);
    const reasons = res.body.categoryChanges.map(
      (c: { reason: string }) => c.reason,
    );
    expect(reasons).toEqual(
      expect.arrayContaining(['call_rating', 'threshold_change']),
    );
    expect(res.body.categoryChanges[0].to.code).toBe('VIP');
  });
});
