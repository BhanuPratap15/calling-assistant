# Calling Assistant — Calling CRM & Lead Management System

Manual Excel-based calling ko replace karne wala CRM. Assistant ek waqt me **ek** customer pe kaam karta hai,
mandatory call form bhare bina agla customer nahi milta, follow-ups ("call me at 4 PM") apne aap
remind / escalate hote hain, aur managers ko poori visibility milti hai.

> Design: [docs/design-v1-summary.md](docs/design-v1-summary.md) · Progress: [docs/ROADMAP.md](docs/ROADMAP.md)

## Status

| Phase                                                                                           |     |                                                                                  |
| ----------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------- |
| 0 — Setup (monorepo, Docker, CI)                                                                | ✅  |                                                                                  |
| 1 — Foundation (auth, roles, staff, teams, customers, audit, admin UI)                          | ✅  |                                                                                  |
| 2 — Calling workflow (assignment engine, call form, Save & Next, 360° profile)                  | ✅  |                                                                                  |
| 3 — Follow-ups (availability, reminders, escalation, notifications)                             | ✅  | **Pilot-ready (M2)**                                                             |
| 4 — Rating & categories (configurable thresholds, history, tags)                                | ✅  |                                                                                  |
| 5 — Campaigns (customer groups, scripts, custom fields, priority)                               | ✅  |                                                                                  |
| 6 — Bulk import (CSV / Excel, preview, background job, 20k tested)                              | ✅  |                                                                                  |
| 7 — Calling provider layer (dial, call status webhooks, recordings)                             | ✅  | telecalling.ai adapter: docs ka wait ([guide](docs/telephony-provider-guide.md)) |
| 8 — Dashboard & reports (KPIs, trends, best hour, assistants, campaigns, CSV)                   | ✅  |                                                                                  |
| 9 — Production hardening (security, Docker + Nginx + HTTPS, CD, backups, monitoring, load test) | ✅  | **Production-ready (M4)** — [Deployment](docs/DEPLOYMENT.md)                     |

## Features (abhi tak)

| Role                  | Kya kar sakta hai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Calling Assistant** | Login → status (Available / Break / Offline) · **Start Calling** → ek customer (due follow-ups sabse pehle) · profile + call history + category + 📞 · current customer pe **tags** · call form (rules ke hisaab se mandatory) · **📞 dial** (live status: ringing / connected timer / no answer) · campaign customer pe **script + extra fields** · **Save & Next** · apne follow-ups · 🔔 notifications                                                                                                                                                                                                                                    |
| **Team Leader**       | Assistant wala sab + apni team ke customers / assignments / follow-ups dekhna, assign / reassign, tags, **overdue alerts**, customers by interest, campaigns (read-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Dashboard**         | Har role: aaj / 7 / 30 din / custom — calls, connect rate, avg rating, talk time (pichhle period se ▲▼), calls per day, best time to call, outcomes. Assistant = apne numbers, TL = team, Manager = sab                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Manager**           | **Reports** (assistant / campaign performance, follow-up health, team / assistant / campaign filters, **CSV export**), Staff, teams, customers (search, category / tag filters, highest-interest sort), manual assign / reassign (campaign ke saath bhi), saare follow-ups, audit logs, dashboard, **Campaigns** (banana, customers filter se add, kaun call kare, script, custom fields, Activate / Pause / Complete, progress + results), **Import** (CSV / Excel → preview → background import, problem rows CSV, history), **Settings** (call outcomes, next actions, categories & thresholds, tags, mandatory fields, follow-up timing) |
| **Super Admin**       | Sab kuch + Managers banana                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Background: har 30s scheduler → follow-up **reminder** (1 min pehle) → **due** → grace (10 min) ke baad owner unavailable to
**escalate** (same team, kam load), warna Team Leader ko **overdue** alert. Call ki **interest rating** se customer apne aap
Low / Medium / High / VIP category me (thresholds configurable, history ke saath; VIP → URGENT priority).
**Start Calling order:** due follow-up → manager ka assign kiya → ACTIVE campaign (priority wala pehle) → general pool. Har zaroori action **audit log** me.

## Architecture

```
Browser ──► Next.js (web, :3000) ──/api/* rewrite──► NestJS (api, :4000) ──► PostgreSQL (data)
                                                          │
                                                          └──► Redis + BullMQ (scheduler: har 30s tick)
```

**Stack:** TypeScript · NestJS · Next.js 16 · PostgreSQL · Prisma 7 · Redis + BullMQ · Docker Compose · GitHub Actions
— kyun: [ADR 0001](docs/decisions/0001-tech-stack.md)

## Local Setup (pehli baar)

Requirements: **Node.js 24 LTS** (npm 11), **Docker Desktop**, Git

```bash
cp .env.example .env     # config (ports: Postgres 5433, Redis 6380)
npm ci                   # dependencies (lockfile se exact versions)
npm run infra:up         # Postgres + Redis (Docker)
npm run db:migrate       # tables + default settings
npm run db:seed          # pehla Super Admin (.env: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
npm run dev:api          # terminal 1 → http://localhost:4000/api/health
npm run dev:web          # terminal 2 → http://localhost:3000
```

Health check me teeno `up` hone chahiye: `{"database":"up","scheduler":"up"}`.

## Har `git pull` ke baad

```bash
# pehle saare dev servers Ctrl+C se band karo
npm ci                   # dependencies sync (lockfile nahi badalta)
npm run db:migrate       # naye DB changes
```

> `npm install <package>` sirf tab jab **nayi library add** karni ho.

## Commands (root se)

| Command                               | Kya karta hai                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev:api` / `npm run dev:web` | Backend / frontend dev server (save → auto reload)                            |
| `npm run infra:up` / `infra:down`     | Docker Postgres + Redis start / stop                                          |
| `npm run db:migrate`                  | Pending migrations apply. Schema badla: `npm run db:migrate -- --name <naam>` |
| `npm run db:seed`                     | Super Admin banao (dobara chalana safe)                                       |
| `npm run db:studio`                   | Browser me DB tables (Prisma Studio)                                          |
| `npm run check`                       | **Commit se pehle:** format check + lint + typecheck + unit tests             |
| `npm run format`                      | Prettier se saara code format                                                 |
| `npm test`                            | Backend unit tests                                                            |
| `npm run test:e2e`                    | Backend e2e tests (real DB; Redis nahi chahiye)                               |
| `npm run build`                       | Dono apps ka production build                                                 |

## Testing

| Layer | Kahan                         | Kya                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit  | `apps/api/src/**/*.spec.ts`   | Pure logic: call form rules, category ranges, escalation picking, presence, permissions, phone, diff, campaign rules, import rules + CSV / Excel parsing, call status machine + webhook signatures, report date ranges (time zone)                                                                                                                                                                                                                                           |
| E2E   | `apps/api/test/*.e2e-spec.ts` | Real Postgres: auth, RBAC, customers, staff/teams, audit, call config, **5 assistants ek saath Start Calling**, Save & Next, follow-up "4 PM" flow (time-travel `tick(now)`), category engine + threshold recalculation, tags, campaigns (status, members, priority, date window, custom fields), bulk import (validation, duplicates, retry, **20,000 rows**), telephony (dial, signed webhooks, out-of-order / duplicate events), reports (exact KPIs, scope, ranges, CSV) |
| CI    | `.github/workflows/ci.yml`    | Har push: format → lint → typecheck → unit → migrations → e2e → build → **smoke test** (built API + real Redis; DB + scheduler `up`)                                                                                                                                                                                                                                                                                                                                         |

E2E files ek-ek karke chalti hain (shared DB) aur apna data khud saaf karti hain.
CI ka DB **khaali** hota hai, local DB me data bhara hota hai — dono pe pass hona chahiye. CI jaisa check:
`createdb calling_crm_ci` → `DATABASE_URL=.../calling_crm_ci npx -w @crm/api prisma migrate deploy` → `DATABASE_URL=.../calling_crm_ci npm run test:e2e`.

## Environment variables

| Variable                                     | Kahan                           | Matlab                                                       |
| -------------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`                               | api                             | Postgres connection                                          |
| `REDIS_URL`                                  | api                             | Redis (BullMQ)                                               |
| `SCHEDULER_ENABLED`                          | api                             | `false` = background scheduler band (tests me automatically) |
| `TELEPHONY_PROVIDER`                         | api                             | `manual` (tel: link, default) / `mock` (demo provider)       |
| `TELEPHONY_WEBHOOK_SECRET`                   | api                             | Provider webhooks ka HMAC secret                             |
| `TELEPHONY_MOCK_AUTOPLAY`                    | api                             | mock: call events apne aap simulate                          |
| \1                                           | `RATE_LIMIT_PER_MIN`, `LOGIN_*` | api                                                          | Rate limit / brute-force lock (defaults theek) |
| `TRUST_PROXY`, `COOKIE_SECURE`, `LOG_FORMAT` | api                             | Production (Nginx ke peeche, HTTPS cookie, JSON logs)        |
| `JWT_SECRET`, `JWT_EXPIRES_IN`               | api                             | Login token sign / expiry (default 8h)                       |
| `API_PORT`, `WEB_ORIGIN`                     | api                             | Port 4000, CORS origin                                       |
| `API_URL`                                    | web                             | Next.js `/api/*` kahan forward kare                          |
| `SEED_ADMIN_*`                               | seed                            | Pehla Super Admin                                            |
| `POSTGRES_*`, `REDIS_PORT`                   | docker                          | Local containers                                             |

Poori list + comments: [.env.example](.env.example). `.env` **kabhi commit nahi** hota.

## API

Poori reference: **[docs/API.md](docs/API.md)** · Manual testing: `apps/api/api.http` (VS Code "REST Client")

## Folder structure

```
calling-assistant/
├── apps/
│   ├── api/                      # NestJS backend (@crm/api, :4000)
│   │   ├── prisma/               #   schema.prisma, migrations/, seed.ts
│   │   ├── src/
│   │   │   ├── auth/             #   login, JWT, guards, @Public/@Roles, availability
│   │   │   ├── staff/ teams/     #   staff + teams management
│   │   │   ├── customers/        #   customers, 360° profile
│   │   │   ├── call-config/      #   outcomes, next actions, mandatory rules, follow-up timing
│   │   │   ├── calling/          #   assignment engine, Save & Next, form validation
│   │   │   ├── assignments/      #   manual assign / reassign / cancel
│   │   │   ├── follow-ups/       #   follow-ups API + scheduler tick + escalation
│   │   │   ├── scheduler/        #   BullMQ (Redis) — har 30s tick
│   │   │   ├── notifications/    #   in-app 🔔
│   │   │   ├── presence/         #   "kaun sach me available hai"
│   │   │   ├── categories/       #   rating → category engine, thresholds, recalculation
│   │   │   ├── tags/             #   tags + customer tags
│   │   │   ├── campaigns/        #   campaigns, members, customers, custom fields, rules
│   │   │   ├── imports/          #   CSV / Excel parse, validation, preview, background import (BullMQ)
│   │   │   ├── telephony/        #   calling provider layer: providers/ (manual, mock), webhooks, call sessions
│   │   │   ├── reports/          #   dashboard KPIs, assistant / campaign reports, CSV export
│   │   │   ├── security/         #   login brute-force limiter
│   │   │   ├── audit/            #   audit log
│   │   │   ├── common/ prisma/   #   shared helpers, DB connection
│   │   │   └── main.ts           #   entry point
│   │   ├── test/                 #   e2e tests
│   │   └── api.http              #   manual API requests
│   └── web/                      # Next.js frontend (@crm/web, :3000)
│       └── src/
│           ├── app/              #   login/, (app)/dashboard, calling, follow-ups, customers[/id],
│           │                     #   campaigns[/id], imports[/new, /id], reports, assignments, teams[/id], staff,
│           │                     #   audit-logs, settings
│           ├── components/       #   ui/ kit, layout/ (bell, availability), feature components
│           ├── lib/              #   api, auth-context, use-api, navigation, permissions, call-form, campaign, import, telephony, report
│           └── proxy.ts          #   login nahi → /login
├── ops/                          # nginx, backup / restore, monitoring, smoke test, load test
├── docs/                         # design, roadmap, API, ADRs, concepts, deployment, runbook, UAT
├── .github/workflows/ci.yml      # CI pipeline
├── docker-compose.yml            # local Postgres + Redis
├── docker-compose.prod.yml       # production stack (nginx, web, api, migrate, postgres, redis, backup)
└── .env.example                  # config template
```

## Docs

| File                                                                 | Kya hai                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| [docs/design-v1-summary.md](docs/design-v1-summary.md)               | Business design summary                                       |
| [docs/ROADMAP.md](docs/ROADMAP.md)                                   | 51 steps, progress, timeline, pending business decisions      |
| [docs/API.md](docs/API.md)                                           | Saare endpoints + access rules                                |
| [docs/decisions/](docs/decisions/)                                   | ADRs — har bada technical decision aur uski wajah (0001–0014) |
| [docs/CONCEPTS.md](docs/CONCEPTS.md)                                 | Seekhne ke notes — har naya concept short me                  |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                             | Production server pe chalana (Docker, HTTPS, CD)              |
| [docs/RUNBOOK.md](docs/RUNBOOK.md)                                   | Incidents, logs, backup restore drill                         |
| [docs/UAT-CHECKLIST.md](docs/UAT-CHECKLIST.md)                       | Go-live se pehle asli team ke saath testing                   |
| [docs/telephony-provider-guide.md](docs/telephony-provider-guide.md) | telecalling.ai jodne ki checklist + unse poochhne wale sawaal |

## Troubleshooting

| Problem                                              | Wajah                                 | Fix                                                                                                  |
| ---------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Server se connection nahi" / `Request failed (500)` | Frontend ko backend (:4000) nahi mila | `npm run dev:api` chalao, uske terminal ka error dekho                                               |
| `dev:api` start hote hi crash                        | Dependencies / DB / migration missing | `npm ci` → `npm run infra:up` → `npm run db:migrate`                                                 |
| Health: `"database":"down"`                          | Docker Postgres band / port galat     | `npm run infra:up`; `.env` `DATABASE_URL` port (5433)                                                |
| Health: `"scheduler":"down"`                         | Redis band / `REDIS_URL` galat        | `npm run infra:up`; `.env` `REDIS_URL` port (6380)                                                   |
| Follow-up reminder / escalation nahi aa rahe         | Scheduler band                        | Health check; `SCHEDULER_ENABLED` `false` to nahi?                                                   |
| `EPERM` on `npm ci` (Windows)                        | Koi process file use kar raha         | Saare dev servers + VS Code band, `node_modules` delete, `npm ci`                                    |
| `'nest' / 'prisma' is not recognized`                | `node_modules` adhura                 | `npm ci`                                                                                             |
| `git pull` blocked by `package-lock.json`            | Local `npm install` ne lockfile badli | `git restore package-lock.json` → `git pull` → `npm ci`                                              |
| Import "Queued" pe atka                              | Redis / scheduler band                | Health check `scheduler`; `npm run infra:up`, API restart (atke imports apne aap dobara chalte hain) |
| API start nahi ho raha: `Unknown TELEPHONY_PROVIDER` | `.env` me galat provider naam         | `TELEPHONY_PROVIDER=manual` (ya `mock`)                                                              |
| 📞 dabane pe status "Connecting…" pe atka            | Provider ka webhook nahi aaya         | mock: `TELEPHONY_MOCK_AUTOPLAY=true`; real: webhook URL + secret                                     |
| Import: "Missing required column(s)"                 | File me `name` / `phone` header nahi  | Import page se **template** download karo, headers match karo                                        |
