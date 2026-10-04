import { randomInt, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { ImportRunner } from '../src/imports/import-runner.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Phase 6 — Bulk import (design doc section 16 + ADR 0011).
 * Tests me Redis nahi (SCHEDULER_ENABLED=false) → ImportRunner isi process me chalata hai;
 * runner.idle() se import khatam hone ka wait.
 */
describe('Bulk import (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let runner: ImportRunner;
  const suffix = randomUUID().slice(0, 8);
  const email = (n: string) => `e2e-imp-${n}-${suffix}@test.local`;
  const password = 'Password@123';
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  // Har run ke apne phone numbers: 9 + 4 random digits + 5 digit counter (10 digits, India)
  const block = String(randomInt(1000, 9999));
  const phone = (i: number) => `9${block}${String(i).padStart(5, '0')}`;
  const e164 = (i: number) => `+91${phone(i)}`;

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const upload = (
    content: string | Buffer,
    fileName = 'users.csv',
    who = 'mgr',
  ) =>
    http()
      .post('/api/imports')
      .set(as(who))
      .attach(
        'file',
        Buffer.isBuffer(content) ? content : Buffer.from(content),
        fileName,
      );
  const confirm = async (id: string, body: object = {}) => {
    const res = await http()
      .post(`/api/imports/${id}/confirm`)
      .set(as('mgr'))
      .send(body);
    await runner.idle();
    return res;
  };
  const get = async (id: string) =>
    (await http().get(`/api/imports/${id}`).set(as('mgr')).expect(200)).body;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    runner = app.get(ImportRunner);

    const passwordHash = await hashPassword(password);
    for (const [n, role] of [
      ['mgr', 'MANAGER'],
      ['tl', 'TEAM_LEADER'],
    ] as const) {
      ids[n] = (
        await prisma.staff.create({
          data: { name: `Imp ${n}`, email: email(n), role, passwordHash },
        })
      ).id;
      tokens[n] = (
        await http()
          .post('/api/auth/login')
          .send({ email: email(n), password })
      ).body.accessToken;
    }
    // Pehle se maujood customer → file me aaya to DUPLICATE
    ids.existing = (
      await prisma.customer.create({
        data: {
          name: `Imp Existing ${suffix}`,
          phone: e164(1),
          externalId: `EXT-${suffix}-0`,
        },
      })
    ).id;
  });

  afterAll(async () => {
    const customers = await prisma.customer.findMany({
      where: { phone: { startsWith: `+919${block}` } },
      select: { id: true },
    });
    const customerIds = customers.map((c) => c.id);
    await prisma.campaign.deleteMany({ where: { createdById: ids.mgr } });
    await prisma.customerTag.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    if (ids.tag) await prisma.tag.delete({ where: { id: ids.tag } });
    await prisma.importBatch.deleteMany({ where: { createdById: ids.mgr } }); // rows cascade
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: ids.mgr } });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [ids.mgr, ids.tl] } },
    });
    await prisma.staff.deleteMany({ where: { id: { in: [ids.mgr, ids.tl] } } });
    await app.close();
  });

  // ---------------- 6.1 upload + parse ----------------

  it('only managers can import (TL 403, no token 401)', async () => {
    await upload('name,phone\nA,9876543210\n', 'a.csv', 'tl').expect(403);
    await http()
      .post('/api/imports')
      .attach('file', Buffer.from('x'), 'a.csv')
      .expect(401);
    await http().get('/api/imports').set(as('tl')).expect(403);
  });

  it('rejects missing file, wrong type, missing columns, empty file', async () => {
    await http().post('/api/imports').set(as('mgr')).expect(400);
    const xls = await upload('x', 'users.xls').expect(400);
    expect(xls.body.message).toMatch(/csv and \.xlsx/);
    const cols = await upload('full name,city\nA,Delhi\n').expect(400);
    expect(cols.body.message).toBe(
      'Missing required column(s): phone. Found: full name, city',
    );
    await upload('name,phone\n').expect(400);
    await upload('name,phone,mobile\nA,1,2\n').expect(400); // phone do baar
  });

  // ---------------- 6.2 validation + duplicates + preview ----------------

  let previewId: string;

  it('preview: validates every row, finds in-file + database duplicates, creates nothing yet', async () => {
    const csv = [
      'Full Name,Mobile,E-mail,User ID,Priority,Remarks,City',
      `Rahul ${suffix},${phone(2)},RAHUL@X.COM,EXT-${suffix}-2,high,"VIP, plays daily",Delhi`, // valid
      `Priya ${suffix},+91 ${phone(3).slice(0, 5)} ${phone(3).slice(5)},,,,,Pune`, // valid (spaces)
      `Dup In File,${phone(2)},,,,,`, // same phone as row 2
      `Old Customer,${phone(1)},,,,,`, // DB me pehle se
      `Same Ext,${phone(4)},,EXT-${suffix}-0,,,`, // externalId DB me pehle se
      `,${phone(5)},bad-email,,VIP,,`, // name missing + bad email + bad priority
      `Wrong Number,12345,,,,,`,
      ',,,,,,', // khaali line — gin'ti me nahi
    ].join('\n');
    const res = await upload(csv, 'october-users.csv').expect(201);
    previewId = res.body.id;
    expect(res.body).toMatchObject({
      fileName: 'october-users.csv',
      status: 'PREVIEW',
      totalRows: 7,
      validRows: 2,
      invalidRows: 2,
      duplicateRows: 3,
      importedRows: 0,
      ignoredColumns: ['City'],
      createdBy: { id: ids.mgr },
    });
    // Preview me customers nahi bante
    expect(await prisma.customer.count({ where: { phone: e164(2) } })).toBe(0);

    const rows = (
      await http()
        .get(`/api/imports/${previewId}/rows?pageSize=50`)
        .set(as('mgr'))
        .expect(200)
    ).body;
    expect(rows.meta.total).toBe(7);
    const byRow = Object.fromEntries(
      rows.data.map((r: { rowNumber: number }) => [r.rowNumber, r]),
    );
    expect(byRow[2]).toMatchObject({ status: 'VALID', errors: [] });
    expect(byRow[4]).toMatchObject({
      status: 'DUPLICATE',
      errors: ['Same phone as row 2'],
    });
    expect(byRow[5]).toMatchObject({
      status: 'DUPLICATE',
      customerId: ids.existing,
    });
    expect(byRow[6].errors[0]).toMatch(/^externalId already exists/);
    expect(byRow[7]).toMatchObject({ status: 'INVALID' });
    expect(byRow[7].errors).toEqual([
      'name is required',
      'email "bad-email" is not valid',
      'priority must be one of LOW, NORMAL, HIGH, URGENT',
    ]);
    expect(byRow[8].errors).toEqual(['phone "12345" is not a valid number']);

    const invalid = (
      await http()
        .get(`/api/imports/${previewId}/rows?status=INVALID`)
        .set(as('mgr'))
        .expect(200)
    ).body;
    expect(invalid.meta.total).toBe(2);
  });

  it('problem rows download as CSV (same columns as template, ready to fix & re-upload)', async () => {
    const res = await http()
      .get(`/api/imports/${previewId}/problems.csv`)
      .set(as('mgr'))
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="import-.*-problems\.csv"/,
    );
    const lines = res.text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lines[0]).toBe(
      'row,status,problem,name,phone,alternate_phone,email,external_id,priority,notes',
    );
    expect(lines).toHaveLength(1 + 5);
    expect(lines[1]).toBe(
      `4,DUPLICATE,Same phone as row 2,Dup In File,${phone(2)},,,,,`,
    );
  });

  // ---------------- 6.3 confirm → background import ----------------

  it('confirm validates campaign / tag and status', async () => {
    await http()
      .post(`/api/imports/${previewId}/confirm`)
      .set(as('mgr'))
      .send({ campaignId: randomUUID() })
      .expect(400);
    await http()
      .post(`/api/imports/${previewId}/confirm`)
      .set(as('mgr'))
      .send({ extra: 1 })
      .expect(400); // whitelist
    expect((await get(previewId)).status).toBe('PREVIEW');
  });

  it('confirm → background import → customers created (+ campaign + tag), notification, audit', async () => {
    ids.campaign = (
      await http()
        .post('/api/campaigns')
        .set(as('mgr'))
        .send({ name: `Imp Campaign ${suffix}` })
        .expect(201)
    ).body.id;
    ids.tag = (
      await http()
        .post('/api/tags')
        .set(as('mgr'))
        .send({ name: `Imp Oct ${suffix}`, color: 'blue' })
        .expect(201)
    ).body.id;

    const res = await confirm(previewId, {
      campaignId: ids.campaign,
      tagId: ids.tag,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('QUEUED'); // response turant, kaam background me

    const done = await get(previewId);
    expect(done).toMatchObject({
      status: 'COMPLETED',
      importedRows: 2,
      skippedRows: 0,
      campaign: { id: ids.campaign },
      tag: { id: ids.tag },
    });
    expect(done.finishedAt).not.toBeNull();

    const rahul = await prisma.customer.findUniqueOrThrow({
      where: { phone: e164(2) },
      include: { tags: true, campaigns: true },
    });
    expect(rahul).toMatchObject({
      name: `Rahul ${suffix}`,
      email: 'rahul@x.com',
      externalId: `EXT-${suffix}-2`,
      priority: 'HIGH',
      notes: 'VIP, plays daily',
      createdById: ids.mgr,
      status: 'ACTIVE',
    });
    expect(rahul.tags.map((t) => t.tagId)).toEqual([ids.tag]);
    expect(rahul.campaigns.map((c) => c.campaignId)).toEqual([ids.campaign]);
    expect(await prisma.customer.count({ where: { phone: e164(3) } })).toBe(1);

    const rows = (
      await http()
        .get(`/api/imports/${previewId}/rows?status=IMPORTED`)
        .set(as('mgr'))
    ).body;
    expect(
      rows.data.map((r: { customerId: string }) => r.customerId),
    ).toContain(rahul.id);

    const notes = await prisma.notification.findMany({
      where: { recipientId: ids.mgr },
    });
    expect(notes).toEqual([
      expect.objectContaining({
        type: 'IMPORT_COMPLETED',
        title: 'Import complete: 2 customers added',
        link: `/imports/${previewId}`,
      }),
    ]);
    const actions = (
      await prisma.auditLog.findMany({
        where: { entityType: 'import', entityId: previewId },
        orderBy: { createdAt: 'asc' },
      })
    ).map((a) => a.action);
    expect(actions).toEqual([
      'import.previewed',
      'import.confirmed',
      'import.completed',
    ]);
  });

  it('cannot confirm twice / cancel after confirm', async () => {
    await http()
      .post(`/api/imports/${previewId}/confirm`)
      .set(as('mgr'))
      .send({})
      .expect(400);
    await http()
      .post(`/api/imports/${previewId}/cancel`)
      .set(as('mgr'))
      .expect(400);
  });

  it('phone added by someone after the preview → that row SKIPPED, rest imported', async () => {
    const res = await upload(
      `name,phone\nLate A,${phone(10)}\nLate B,${phone(11)}\n`,
    ).expect(201);
    expect(res.body.validRows).toBe(2);
    await prisma.customer.create({
      data: { name: 'Manual add', phone: e164(11) },
    });
    await confirm(res.body.id);
    const done = await get(res.body.id);
    expect(done).toMatchObject({
      status: 'COMPLETED',
      importedRows: 1,
      skippedRows: 1,
    });
    const skipped = (
      await http()
        .get(`/api/imports/${res.body.id}/rows?status=SKIPPED`)
        .set(as('mgr'))
    ).body.data;
    expect(skipped[0]).toMatchObject({
      rowNumber: 3,
      errors: ['Phone or externalId already exists (added after preview)'],
    });
  });

  it('cancel a preview; confirm with no valid rows → 400', async () => {
    const res = await upload(`name,phone\nX,${phone(20)}\n`).expect(201);
    const cancelled = await http()
      .post(`/api/imports/${res.body.id}/cancel`)
      .set(as('mgr'))
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');
    await http()
      .post(`/api/imports/${res.body.id}/confirm`)
      .set(as('mgr'))
      .send({})
      .expect(400);
    expect(await prisma.customer.count({ where: { phone: e164(20) } })).toBe(0);

    const bad = await upload('name,phone\nX,123\n').expect(201);
    expect(bad.body.validRows).toBe(0);
    const r = await http()
      .post(`/api/imports/${bad.body.id}/confirm`)
      .set(as('mgr'))
      .send({});
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('No valid rows to import');
  });

  it('Excel (.xlsx) upload works the same way (numbers keep all digits)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['Name', 'Phone Number', 'Alternate Mobile']);
    ws.addRow([`Excel ${suffix}`, Number(phone(30)), phone(31)]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await upload(buffer, 'users.xlsx').expect(201);
    expect(res.body).toMatchObject({ totalRows: 1, validRows: 1 });
    await confirm(res.body.id);
    const c = await prisma.customer.findUniqueOrThrow({
      where: { phone: e164(30) },
    });
    expect(c.alternatePhone).toBe(e164(31));
  });

  it('a failed import can be retried and continues where it stopped', async () => {
    const res = await upload(
      `name,phone\nR1,${phone(40)}\nR2,${phone(41)}\n`,
    ).expect(201);
    // Fail simulate: pehli row import ho chuki thi, phir error → FAILED
    const r1 = await prisma.customer.create({
      data: { name: 'R1', phone: e164(40), createdById: ids.mgr },
    });
    await prisma.importRow.update({
      where: { batchId_rowNumber: { batchId: res.body.id, rowNumber: 2 } },
      data: { status: 'IMPORTED', customerId: r1.id },
    });
    await prisma.importBatch.update({
      where: { id: res.body.id },
      data: { status: 'FAILED', error: 'db down', importedRows: 1 },
    });
    await http()
      .post(`/api/imports/${previewId}/retry`)
      .set(as('mgr'))
      .expect(400); // COMPLETED
    const retried = await http()
      .post(`/api/imports/${res.body.id}/retry`)
      .set(as('mgr'))
      .expect(201);
    expect(retried.body).toMatchObject({ status: 'QUEUED', error: null });
    await runner.idle();
    expect(await get(res.body.id)).toMatchObject({
      status: 'COMPLETED',
      importedRows: 2,
    });
    // R1 dobara nahi bana (skip bhi nahi) — sirf bachi hui R2 import hui
    expect((await get(res.body.id)).skippedRows).toBe(0);
    expect(await prisma.customer.count({ where: { phone: e164(41) } })).toBe(1);
  });

  it('history lists imports newest first with who / counts', async () => {
    const list = (
      await http().get('/api/imports?pageSize=100').set(as('mgr')).expect(200)
    ).body;
    const mine = list.data.filter(
      (b: { createdBy: { id: string } }) => b.createdBy?.id === ids.mgr,
    );
    expect(mine.length).toBe(6); // preview, late, cancelled, no-valid, xlsx, retry
    expect(mine[mine.length - 1].id).toBe(previewId); // sabse purana last
    const cancelled = (
      await http()
        .get('/api/imports?status=CANCELLED')
        .set(as('mgr'))
        .expect(200)
    ).body.data.map((b: { id: string }) => b.id);
    expect(cancelled.length).toBeGreaterThan(0);
  });

  // ---------------- load: 20,000 users (design doc section 16) ----------------

  it('20,000 rows: preview + background import finish quickly', async () => {
    const N = 20_000;
    const lines = ['name,phone,external_id'];
    for (let i = 0; i < N; i++)
      lines.push(`Load ${i},${phone(50_000 + i)},LOAD-${suffix}-${i}`);
    lines.push(`Load dup,${phone(50_000)},`); // 1 duplicate
    const t0 = Date.now();
    const res = await upload(lines.join('\n'), 'load.csv').expect(201);
    const previewMs = Date.now() - t0;
    expect(res.body).toMatchObject({
      totalRows: N + 1,
      validRows: N,
      duplicateRows: 1,
    });

    const t1 = Date.now();
    await confirm(res.body.id);
    const importMs = Date.now() - t1;
    expect(await get(res.body.id)).toMatchObject({
      status: 'COMPLETED',
      importedRows: N,
    });
    expect(
      await prisma.customer.count({
        where: { externalId: { startsWith: `LOAD-${suffix}-` } },
      }),
    ).toBe(N);
    console.log(`20k import: preview ${previewMs} ms, import ${importMs} ms`);
    expect(previewMs + importMs).toBeLessThan(60_000);
  }, 120_000);
});
