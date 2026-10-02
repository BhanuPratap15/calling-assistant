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
Requirements: Node.js 22 LTS+, Docker Desktop, Git

```bash
cp .env.example .env          # local config
docker compose up -d          # Postgres + Redis start
docker compose ps             # dono "healthy" dikhne chahiye
```

## Folder Structure (planned)
```
calling-assistant/
├── apps/
│   ├── api/            # NestJS backend        (step 0.4)
│   └── web/            # Next.js frontend      (step 0.4)
├── docs/               # design, roadmap, ADRs, concepts
├── docker-compose.yml  # local Postgres + Redis
└── .env.example        # config template
```
