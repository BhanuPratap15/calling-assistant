# ADR 0001 — Tech Stack

- **Status:** Accepted
- **Date:** 2026-10-02

> **ADR kya hota hai?** "Architecture Decision Record": ek chhota document jo batata hai
> _kya decide kiya, kyun kiya, aur kya alternatives the_. Future me koi poochhe "ye NestJS kyun?",
> to jawab yahan milega. Decision badle to naya ADR likho (purana delete mat karo).

## Context

- Team chhoti hai, developer backend/frontend seekh raha hai → **ek hi language** poore project me.
- Requirements: RBAC, background jobs (follow-ups, import), backend locking, configurable rules.
- Scale: 20k+ users, 6+ assistants — moderate, koi exotic tech ki zaroorat nahi.

## Decision

| Layer           | Choice                     | Reason                                                                                    | Alternative (kyun nahi)                                            |
| --------------- | -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Language        | TypeScript                 | Frontend + backend dono ek language; types se bugs jaldi pakde jaate hain                 | Python (FastAPI) — frontend ke liye phir bhi JS seekhna padta      |
| Backend         | NestJS                     | Fixed structure (modules/controllers/services), Guards = RBAC, built-in scheduler         | Express — bahut free-form, beginner ko structure khud banana padta |
| Database        | PostgreSQL                 | Transactions + row locks (`SELECT ... FOR UPDATE SKIP LOCKED`) assignment ke liye perfect | MongoDB — relational data (users↔calls↔follow-ups) ke liye weak    |
| ORM             | Prisma                     | Schema ek readable file me, auto migrations, type-safe queries                            | TypeORM — zyada complex, kam predictable                           |
| Queue / cache   | Redis + BullMQ             | Reminders, escalation, 20k import background jobs                                         | Sirf cron — retry/delay/scale nahi milta                           |
| Frontend        | Next.js (React) + Tailwind | Industry standard, bada ecosystem                                                         | Plain React — routing/setup khud karna padta                       |
| Local infra     | Docker Compose             | Postgres/Redis ek command me; DevOps background se match                                  | Local install — har machine pe alag setup                          |
| Package manager | npm workspaces             | Node ke saath aata hai, monorepo support                                                  | pnpm/yarn — extra tool seekhna                                     |

## Consequences

- Sab kuch TypeScript me → ek hi language seekhni hai.
- Calling provider (telecalling.ai) ka code alag module me rahega taaki provider badalna aasaan ho.
- Stack badalna ho to naya ADR (`0002-...md`) likhenge.
