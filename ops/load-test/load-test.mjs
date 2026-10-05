#!/usr/bin/env node
/**
 * =====================================================================
 * Load test — "10+ assistants ek saath, 20,000 customers" (roadmap 9.5)
 * Sirf LOCAL / STAGING pe chalao — production pe NAHI (test calls + test staff banate hain).
 *
 *   node ops/load-test/load-test.mjs
 *
 * Env (sab optional):
 *   API_URL=http://localhost:4000      ADMIN_EMAIL / ADMIN_PASSWORD (manager / super admin)
 *   ASSISTANTS=10                      har assistant ek parallel "worker"
 *   CALLS_PER_ASSISTANT=40             itne Save & Next har worker
 *   THINK_MS=0                         har call ke beech ruko (0 = jitna tez ho sake — stress)
 *   MIN_CUSTOMERS=20000                kam hon to import API se baaki bana do
 *
 * Note: THINK_MS=0 pe 10 workers ~100+ req/sec bhejte hain (asli assistant ~1 call/min). API ka
 * RATE_LIMIT_PER_MIN (default 3000 / IP) is test ke liye badhao, warna 429 aayenge.
 *
 * Check karta hai: latency (p50 / p95 / p99), errors, aur **koi customer do assistants ko ek saath na mile**.
 * =====================================================================
 */
import { writeFileSync } from 'node:fs';

const API =
  (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@crm.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe@123';
const ASSISTANTS = Number(process.env.ASSISTANTS ?? 10);
const CALLS = Number(process.env.CALLS_PER_ASSISTANT ?? 40);
const THINK_MS = Number(process.env.THINK_MS ?? 0);
const MIN_CUSTOMERS = Number(process.env.MIN_CUSTOMERS ?? 20_000);
const PASSWORD = 'LoadTest@2026';

const timings = new Map(); // "POST /calling/next" → [ms]
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(
  token,
  method,
  path,
  body,
  { expect = [200, 201, 204], label } = {},
) {
  const key =
    label ?? `${method} ${path.split('?')[0].replace(/[0-9a-f-]{36}/g, ':id')}`;
  const t0 = performance.now();
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = performance.now() - t0;
  if (!timings.has(key)) timings.set(key, []);
  timings.get(key).push(ms);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!expect.includes(res.status)) {
    const err = `${key} → ${res.status} ${data?.message ?? text.slice(0, 120)}`;
    errors.push(err);
    throw new Error(err);
  }
  return data;
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

// ---------- setup ----------
async function login(email, password) {
  return (
    await call(
      null,
      'POST',
      '/auth/login',
      { email, password },
      { label: 'POST /auth/login' },
    )
  ).accessToken;
}

async function ensureCustomers(admin) {
  const { meta } = await call(
    admin,
    'GET',
    '/customers?pageSize=1&status=ACTIVE',
  );
  if (meta.total >= MIN_CUSTOMERS) return meta.total;
  const need = MIN_CUSTOMERS - meta.total;
  console.log(
    `• ${meta.total} customers — import API se ${need} aur bana rahe hain…`,
  );
  const block = String(Date.now()).slice(-4);
  const rows = ['name,phone'];
  for (let i = 0; i < need; i++)
    rows.push(
      `Load Customer ${block}-${i},7${block}${String(i).padStart(5, '0')}`,
    );
  const form = new FormData();
  form.append(
    'file',
    new Blob([rows.join('\n')], { type: 'text/csv' }),
    'load-test.csv',
  );
  const res = await fetch(`${API}/imports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: form,
  });
  const batch = await res.json();
  if (!res.ok) throw new Error(`import failed: ${batch.message}`);
  await call(admin, 'POST', `/imports/${batch.id}/confirm`, {});
  for (;;) {
    const b = await call(admin, 'GET', `/imports/${batch.id}`);
    if (b.status === 'COMPLETED') return meta.total + b.importedRows;
    if (b.status === 'FAILED') throw new Error(`import failed: ${b.error}`);
    await sleep(1000);
  }
}

/** loadtest01@… staff: na ho to banao; ho to password reset — phir khud password change (forced flow bhi test) */
async function ensureAssistant(admin, i) {
  const email = `loadtest${String(i).padStart(2, '0')}@crm.local`;
  const existing = (await call(admin, 'GET', '/staff?role=ASSISTANT')).find(
    (s) => s.email === email,
  );
  if (existing) {
    if (!existing.isActive)
      await call(admin, 'PATCH', `/staff/${existing.id}`, { isActive: true });
    await call(admin, 'POST', `/staff/${existing.id}/reset-password`, {
      newPassword: 'Temp@2026x',
    });
  } else {
    await call(admin, 'POST', '/staff', {
      name: `Load Test ${i}`,
      email,
      password: 'Temp@2026x',
      role: 'ASSISTANT',
    });
  }
  const temp = await login(email, 'Temp@2026x');
  const { accessToken } = await call(temp, 'POST', '/auth/change-password', {
    currentPassword: 'Temp@2026x',
    newPassword: PASSWORD,
  });
  return { email, token: accessToken };
}

// ---------- workload ----------
const holder = new Map(); // customerId → assistant (abhi kiske paas)
const duplicates = [];
let completed = 0;

async function worker(a, config) {
  const connected = config.outcomes.filter((o) => o.isConnected);
  const notConnected = config.outcomes.filter((o) => !o.isConnected);
  const plain = config.nextActions.filter((x) => !x.requiresFollowUp);
  const followUp = config.nextActions.filter((x) => x.requiresFollowUp);
  let current = (await call(a.token, 'POST', '/calling/next')).current;
  for (let n = 0; n < CALLS && current; n++) {
    const cid = current.customer.id;
    if (holder.has(cid) && holder.get(cid) !== a.email)
      duplicates.push(`${cid}: ${holder.get(cid)} + ${a.email}`);
    holder.set(cid, a.email);

    await call(a.token, 'POST', '/calling/dial', {}); // manual provider: tel: link + attempt record
    if (THINK_MS) await sleep(THINK_MS);
    const isConnected = Math.random() < 0.6;
    const wantsFollowUp = isConnected && followUp.length && Math.random() < 0.1;
    const body = {
      outcomeId: (isConnected ? connected : notConnected)[
        Math.floor(
          Math.random() * (isConnected ? connected : notConnected).length,
        )
      ].id,
      nextActionId: (wantsFollowUp ? followUp : plain)[0].id,
      userResponse: 'load test',
      notes: 'load test call',
      interestRating: Math.floor(Math.random() * 11),
      followUpAt: wantsFollowUp
        ? new Date(Date.now() + 2 * 86400_000).toISOString()
        : undefined,
    };
    const res = await call(a.token, 'POST', '/calling/complete', body);
    holder.delete(cid);
    completed++;
    current = res.current;
  }
  // Bacha hua customer release (manager cancel) — test ke baad koi atka na rahe
  return current?.id ?? null;
}

async function managerWatcher(admin, stop) {
  while (!stop.done) {
    await call(admin, 'GET', '/reports/summary?range=today').catch(
      () => undefined,
    );
    await call(admin, 'GET', '/follow-ups/summary').catch(() => undefined);
    await sleep(1000);
  }
}

// ---------- main ----------
const t0 = performance.now();
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
const total = await ensureCustomers(admin);
const assistants = [];
for (let i = 1; i <= ASSISTANTS; i++)
  assistants.push(await ensureAssistant(admin, i));
const config = await call(assistants[0].token, 'GET', '/call-config');
console.log(
  `• ${total} active customers · ${ASSISTANTS} assistants · ${CALLS} calls each · think ${THINK_MS}ms`,
);

timings.clear(); // setup ke timings report me nahi
const stop = { done: false };
const watcher = managerWatcher(admin, stop);
const runStart = performance.now();
const leftovers = await Promise.allSettled(
  assistants.map((a) => worker(a, config)),
);
const runSec = (performance.now() - runStart) / 1000;
stop.done = true;
await watcher;

for (const r of leftovers) {
  if (r.status === 'fulfilled' && r.value)
    await call(admin, 'POST', `/assignments/${r.value}/cancel`).catch(
      () => undefined,
    );
}
for (const a of assistants)
  await call(a.token, 'POST', '/auth/logout').catch(() => undefined);

// ---------- report ----------
const rows = [...timings.entries()].map(([k, v]) => ({
  endpoint: k,
  requests: v.length,
  p50: Math.round(pct(v, 50)),
  p95: Math.round(pct(v, 95)),
  p99: Math.round(pct(v, 99)),
  max: Math.round(Math.max(...v)),
}));
const totalReq = rows.reduce((n, r) => n + r.requests, 0);
console.log('\nLatency (ms):');
console.table(rows);
const summary = {
  when: new Date().toISOString(),
  apiUrl: API,
  customers: total,
  assistants: ASSISTANTS,
  callsCompleted: completed,
  runSeconds: Math.round(runSec * 10) / 10,
  callsPerSecond: Math.round((completed / runSec) * 10) / 10,
  requestsPerSecond: Math.round((totalReq / runSec) * 10) / 10,
  errors: errors.length,
  duplicateAssignments: duplicates.length,
  endpoints: rows,
  totalSeconds: Math.round((performance.now() - t0) / 100) / 10,
};
console.log(
  `\n${completed} calls in ${summary.runSeconds}s → ${summary.callsPerSecond} calls/s, ${summary.requestsPerSecond} req/s · errors ${errors.length} · duplicate assignments ${duplicates.length}`,
);
if (errors.length) console.log('First errors:', errors.slice(0, 5));
if (duplicates.length) console.log('DUPLICATES:', duplicates.slice(0, 5));
writeFileSync('load-test-result.json', JSON.stringify(summary, null, 2));
console.log('Result → load-test-result.json');
process.exit(errors.length || duplicates.length ? 1 : 0);
