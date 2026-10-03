# Calling Assistant — Calling CRM & Lead Management System

Manual Excel-based calling ko replace karne wala CRM. Assistant ek waqt me **ek** customer pe kaam karta hai,
mandatory call form bhare bina agla customer nahi milta, follow-ups ("call me at 4 PM") apne aap
remind / escalate hote hain, aur managers ko poori visibility milti hai.

> Design: [docs/design-v1-summary.md](docs/design-v1-summary.md) · Progress: [docs/ROADMAP.md](docs/ROADMAP.md)

## Status

| Phase                                                                          |     |                            |
| ------------------------------------------------------------------------------ | --- | -------------------------- |
| 0 — Setup (monorepo, Docker, CI)                                               | ✅  |                            |
| 1 — Foundation (auth, roles, staff, teams, customers, audit, admin UI)         | ✅  |                            |
| 2 — Calling workflow (assignment engine, call form, Save & Next, 360° profile) | ✅  |                            |
| 3 — Follow-ups (availability, reminders, escalation, notifications)            | ✅  | **Pilot-ready (M2)**       |
| 4–9 — Categories, campaigns, import, telecalling.ai, dashboard, production     | ⬜  | [Roadmap](docs/ROADMAP.md) |

## Features (abhi tak)

| Role                  | Kya kar sakta hai                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Calling Assistant** | Login → status (Available / Break / Offline) · **Start Calling** → ek customer (due follow-ups sabse pehle) · profile + call history + 📞 · call form (rules ke hisaab se mandatory) · **Save & Next** · apne follow-ups · 🔔 notifications |
| **Team Leader**       | Assistant wala sab + apni team ke customers / assignments / follow-ups dekhna, assign / reassign, **overdue alerts**                                                                                                                        |
| **Manager**           | Staff, teams, customers (add / edit / search), manual assign / reassign, saare follow-ups, audit logs, **Settings** (call outcomes, next actions, mandatory fields, follow-up timing)                                                       |
| **Super Admin**       | Sab kuch + Managers banana                                                                                                                                                                                                                  |

Background: har 30s scheduler → follow-up **reminder** (1 min pehle) → **due** → grace (10 min) ke baad owner unavailable to
**escalate** (same team, kam load), warna Team Leader ko **overdue** alert. Har zaroori action **audit log** me.

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

| Layer | Kahan                         | Kya                                                                                                                                                                          |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit  | `apps/api/src/**/*.spec.ts`   | Pure logic: call form rules, escalation picking, presence, permissions, phone, diff                                                                                          |
| E2E   | `apps/api/test/*.e2e-spec.ts` | Real Postgres: auth, RBAC, customers, staff/teams, audit, call config, **5 assistants ek saath Start Calling**, Save & Next, follow-up "4 PM" flow (time-travel `tick(now)`) |
| CI    | `.github/workflows/ci.yml`    | Har push: format → lint → typecheck → unit → migrations → e2e → build → **smoke test** (built API + real Redis; DB + scheduler `up`)                                         |

E2E files ek-ek karke chalti hain (shared DB) aur apna data khud saaf karti hain.

## Environment variables

| Variable                       | Kahan  | Matlab                                                       |
| ------------------------------ | ------ | ------------------------------------------------------------ |
| `DATABASE_URL`                 | api    | Postgres connection                                          |
| `REDIS_URL`                    | api    | Redis (BullMQ)                                               |
| `SCHEDULER_ENABLED`            | api    | `false` = background scheduler band (tests me automatically) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | api    | Login token sign / expiry (default 8h)                       |
| `API_PORT`, `WEB_ORIGIN`       | api    | Port 4000, CORS origin                                       |
| `API_URL`                      | web    | Next.js `/api/*` kahan forward kare                          |
| `SEED_ADMIN_*`                 | seed   | Pehla Super Admin                                            |
| `POSTGRES_*`, `REDIS_PORT`     | docker | Local containers                                             |

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
│   │   │   ├── audit/            #   audit log
│   │   │   ├── common/ prisma/   #   shared helpers, DB connection
│   │   │   └── main.ts           #   entry point
│   │   ├── test/                 #   e2e tests
│   │   └── api.http              #   manual API requests
│   └── web/                      # Next.js frontend (@crm/web, :3000)
│       └── src/
│           ├── app/              #   login/, (app)/dashboard, calling, follow-ups, customers[/id],
│           │                     #   assignments, teams[/id], staff, audit-logs, settings
│           ├── components/       #   ui/ kit, layout/ (bell, availability), feature components
│           ├── lib/              #   api, auth-context, use-api, navigation, permissions, call-form
│           └── proxy.ts          #   login nahi → /login
├── docs/                         # design, roadmap, API, ADRs, concepts
├── .github/workflows/ci.yml      # CI pipeline
├── docker-compose.yml            # local Postgres + Redis
└── .env.example                  # config template
```

## Docs

| File                                                   | Kya hai                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| [docs/design-v1-summary.md](docs/design-v1-summary.md) | Business design summary                                       |
| [docs/ROADMAP.md](docs/ROADMAP.md)                     | 51 steps, progress, timeline, pending business decisions      |
| [docs/API.md](docs/API.md)                             | Saare endpoints + access rules                                |
| [docs/decisions/](docs/decisions/)                     | ADRs — har bada technical decision aur uski wajah (0001–0008) |
| [docs/CONCEPTS.md](docs/CONCEPTS.md)                   | Seekhne ke notes — har naya concept short me                  |

## Troubleshooting

| Problem                                              | Wajah                                 | Fix                                                               |
| ---------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| "Server se connection nahi" / `Request failed (500)` | Frontend ko backend (:4000) nahi mila | `npm run dev:api` chalao, uske terminal ka error dekho            |
| `dev:api` start hote hi crash                        | Dependencies / DB / migration missing | `npm ci` → `npm run infra:up` → `npm run db:migrate`              |
| Health: `"database":"down"`                          | Docker Postgres band / port galat     | `npm run infra:up`; `.env` `DATABASE_URL` port (5433)             |
| Health: `"scheduler":"down"`                         | Redis band / `REDIS_URL` galat        | `npm run infra:up`; `.env` `REDIS_URL` port (6380)                |
| Follow-up reminder / escalation nahi aa rahe         | Scheduler band                        | Health check; `SCHEDULER_ENABLED` `false` to nahi?                |
| `EPERM` on `npm ci` (Windows)                        | Koi process file use kar raha         | Saare dev servers + VS Code band, `node_modules` delete, `npm ci` |
| `'nest' / 'prisma' is not recognized`                | `node_modules` adhura                 | `npm ci`                                                          |
| `git pull` blocked by `package-lock.json`            | Local `npm install` ne lockfile badli | `git restore package-lock.json` → `git pull` → `npm ci`           |
