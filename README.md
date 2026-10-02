# Calling Assistant — Calling CRM & Lead Management System

Manual Excel-based calling ko replace karne wala CRM: assistant ek time pe ek user ko call karta hai,
mandatory call form bhare bina next user nahi milta, follow-ups automatic schedule/escalate hote hain,
aur managers ko live dashboard milta hai.

## Docs
| File | Kya hai |
|---|---|
| [docs/design-v1-summary.md](docs/design-v1-summary.md) | Business design ka summary |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Step-by-step plan + progress |
| [docs/decisions/](docs/decisions/) | Tech decisions (ADRs) — kya aur kyun |
| [docs/CONCEPTS.md](docs/CONCEPTS.md) | Seekhne ke notes / glossary |

## Tech Stack
TypeScript · NestJS · Next.js · PostgreSQL · Prisma · Redis + BullMQ · Docker Compose
(Reason: [ADR 0001](docs/decisions/0001-tech-stack.md))

## Local Setup
Requirements: **Node.js 24 LTS** (npm 11 ke saath aata hai), Docker Desktop, Git

```bash
cp .env.example .env          # local config
npm install                   # saare apps ki dependencies (root se hi chalana)
npm run infra:up              # Postgres + Redis start (docker compose up -d)
npm run dev:api               # Backend  → http://localhost:4000/api/health
npm run dev:web               # Frontend → http://localhost:3000   (dusre terminal me)
```

## Useful Commands (root se chalao)
| Command | Kya karta hai |
|---|---|
| `npm run dev:api` | NestJS backend watch mode me (file save → auto restart) |
| `npm run dev:web` | Next.js frontend dev server |
| `npm run build` | Dono apps ka production build |
| `npm test` | Backend unit tests |
| `npm run test:e2e -w @crm/api` | Backend end-to-end tests |
| `npm run lint` | Code quality check (dono apps) |
| `npm run infra:up` / `infra:down` | Docker infra start / stop |

## Folder Structure
```
calling-assistant/
├── apps/
│   ├── api/            # NestJS backend  (@crm/api, port 4000)
│   │   ├── src/        #   main.ts = entry point, app.module.ts = root module
│   │   └── test/       #   e2e tests
│   └── web/            # Next.js frontend (@crm/web, port 3000)
│       └── src/app/    #   pages (App Router)
├── docs/               # design, roadmap, ADRs, concepts
├── package.json        # root: npm workspaces + common scripts
├── docker-compose.yml  # local Postgres + Redis
└── .env.example        # config template
```
