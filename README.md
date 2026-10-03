# Calling Assistant — Calling CRM & Lead Management System

Manual Excel-based calling ko replace karne wala CRM: assistant ek time pe ek user ko call karta hai,
mandatory call form bhare bina next user nahi milta, follow-ups automatic schedule/escalate hote hain,
aur managers ko live dashboard milta hai.

## Docs

| File                                                   | Kya hai                              |
| ------------------------------------------------------ | ------------------------------------ |
| [docs/design-v1-summary.md](docs/design-v1-summary.md) | Business design ka summary           |
| [docs/ROADMAP.md](docs/ROADMAP.md)                     | Step-by-step plan + progress         |
| [docs/decisions/](docs/decisions/)                     | Tech decisions (ADRs) — kya aur kyun |
| [docs/CONCEPTS.md](docs/CONCEPTS.md)                   | Seekhne ke notes / glossary          |

## Tech Stack

TypeScript · NestJS · Next.js · PostgreSQL · Prisma · Redis + BullMQ · Docker Compose
(Reason: [ADR 0001](docs/decisions/0001-tech-stack.md))

## Local Setup

Requirements: **Node.js 24 LTS** (npm 11 ke saath aata hai), Docker Desktop, Git

```bash
cp .env.example .env          # local config
npm ci                        # saare apps ki dependencies (lockfile se exact versions)
npm run infra:up              # Postgres + Redis start (docker compose up -d)
npm run db:migrate            # DB me tables banao (migrations apply)
npm run db:seed               # pehla Super Admin (email/password .env me)
npm run dev:api               # Backend  → http://localhost:4000/api/health
npm run dev:web               # Frontend → http://localhost:3000   (dusre terminal me)
                              # Login: SEED_ADMIN_EMAIL / password (.env)
```

## Har `git pull` ke baad

```bash
npm ci                # dependencies sync (lockfile nahi badalta)
npm run db:migrate    # naye DB changes apply
```

> `npm install <package>` sirf tab jab nayi library add karni ho.
> Windows pe `EPERM` aaye: saare dev servers band karo, `node_modules` delete karo, phir `npm ci`.

## Commit se pehle (CI yahi checks chalata hai)

```bash
npm run format && npm run lint && npm run typecheck && npm test
```

## Useful Commands (root se chalao)

| Command                           | Kya karta hai                                           |
| --------------------------------- | ------------------------------------------------------- |
| `npm run dev:api`                 | NestJS backend watch mode me (file save → auto restart) |
| `npm run dev:web`                 | Next.js frontend dev server                             |
| `npm run build`                   | Dono apps ka production build                           |
| `npm test`                        | Backend unit tests                                      |
| `npm run test:e2e -w @crm/api`    | Backend end-to-end tests                                |
| `npm run lint`                    | Code quality check (dono apps)                          |
| `npm run infra:up` / `infra:down` | Docker infra start / stop                               |

## API Endpoints (abhi tak)

| Method | URL               | Access                                                   |
| ------ | ----------------- | -------------------------------------------------------- |
| GET    | `/api/health`     | Public                                                   |
| POST   | `/api/auth/login` | Public — `{ email, password }` → `{ accessToken, user }` |
| GET    | `/api/auth/me`    | Koi bhi logged-in staff                                  |
| GET    | `/api/staff`      | MANAGER, SUPER_ADMIN                                     |

Test karne ke liye: `apps/api/api.http` (VS Code "REST Client" extension).
Auth design: [ADR 0003](docs/decisions/0003-authentication.md) · Audit: [ADR 0004](docs/decisions/0004-audit-log.md) · Frontend auth: [ADR 0005](docs/decisions/0005-frontend-auth.md)

## Folder Structure

```
calling-assistant/
├── apps/
│   ├── api/            # NestJS backend  (@crm/api, port 4000)
│   │   ├── prisma/     #   schema.prisma + migrations/ (database)
│   │   ├── src/        #   main.ts = entry point, app.module.ts = root module
│   │   │   ├── prisma/ #   PrismaService (DB connection)
│   │   │   ├── auth/   #   login, JWT, guards, @Public/@Roles
│   │   │   ├── staff/  #   staff APIs (create, roles, password reset)
│   │   │   ├── teams/  #   teams APIs
│   │   │   ├── audit/  #   audit log (record + read API)
│   │   │   ├── customers/ # customers APIs (jinko call karna hai)
│   │   │   └── common/ #   shared helpers (phone, pagination)
│   │   └── test/       #   e2e tests
│   └── web/            # Next.js frontend (@crm/web, port 3000)
│       └── src/
│           ├── app/          # pages (App Router): login/, (app)/dashboard, ...
│           ├── components/   # AppShell (sidebar + header), ComingSoon
│           ├── lib/          # api.ts, auth-context.tsx, navigation.ts (role menu)
│           └── proxy.ts      # login nahi → /login redirect
├── docs/               # design, roadmap, ADRs, concepts
├── package.json        # root: npm workspaces + common scripts
├── docker-compose.yml  # local Postgres + Redis
└── .env.example        # config template
```
