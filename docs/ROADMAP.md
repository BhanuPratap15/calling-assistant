# Roadmap — Calling CRM

Har step ek chhota, testable kaam hai. Step complete → tick karo → commit.
Phases design doc (section 25) se liye gaye hain.

## Phase 0 — Project Setup

- [x] 0.1 Repo + README + .gitignore + design summary
- [x] 0.2 Tech stack decision (ADR 0001), roadmap, concepts doc
- [x] 0.3 Docker Compose: PostgreSQL + Redis
- [x] 0.4 Monorepo skeleton (npm workspaces): `apps/api` (NestJS), `apps/web` (Next.js)
- [x] 0.5 Code quality: Prettier (root) + lint (api: oxlint, web: ESLint) + typecheck
- [x] 0.6 CI: GitHub Actions (format, lint, typecheck, test, build — har push pe)

## Phase 1 — Foundation

- [x] 1.1 Prisma setup + DB connection (health endpoint DB check)
- [x] 1.2 Schema: roles (enum), staff, teams — migration `init_staff_and_teams`
- [ ] 1.3 Auth: login (JWT), password hashing
- [ ] 1.4 RBAC: Super Admin / Manager / Team Leader / Assistant guards
- [ ] 1.5 Users (customers) table + basic CRUD API
- [ ] 1.6 Audit log base
- [ ] 1.7 Frontend: login page + role-based layout

## Phase 2 — Calling Workflow

- [ ] 2.1 Assignment engine (backend lock, ONE user at a time)
- [ ] 2.2 User 360° profile + call history
- [ ] 2.3 Call form + configurable mandatory-field validation
- [ ] 2.4 "Save & Next" flow

## Phase 3 — Follow-ups

- [ ] 3.1 Follow-up records + scheduling
- [ ] 3.2 Assistant availability (Available / On Call / Break / Offline)
- [ ] 3.3 Reminders + grace period + escalation (BullMQ jobs)

## Phase 4 — Rating & Categories

## Phase 5 — Campaigns

## Phase 6 — Bulk Import (CSV/Excel, background)

## Phase 7 — Calling Provider Integration (API docs aane ke baad)

## Phase 8 — Dashboard & Reports

## Phase 9 — Production Hardening (security, backups, monitoring, deploy)

> Phase 4+ ke detailed steps us phase pe pahunch ke likhenge.
