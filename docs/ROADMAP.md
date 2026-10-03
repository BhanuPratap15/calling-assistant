# Roadmap — Calling CRM

Har step ek chhota, testable kaam hai. Step complete → tick karo → commit.
Phases design doc (section 25) se liye gaye hain.

## Summary

| Phase                    | Steps  | Estimate (working days) | Status  |
| ------------------------ | ------ | ----------------------- | ------- |
| 0 — Project Setup        | 6      | —                       | ✅ Done |
| 1 — Foundation           | 9      | —                       | ✅ Done |
| 2 — Calling Workflow     | 7      | —                       | ✅ Done |
| 3 — Follow-ups           | 6      | —                       | ✅ Done |
| 4 — Rating & Categories  | 4      | 3                       | ⬜      |
| 5 — Campaigns            | 4      | 4                       | ⬜      |
| 6 — Bulk Import          | 4      | 4                       | ⬜      |
| 7 — Calling Provider     | 3      | 3–5 (provider docs pe)  | ⬜      |
| 8 — Dashboard & Reports  | 3      | 4                       | ⬜      |
| 9 — Production Hardening | 5      | 5–7                     | ⬜      |
| **Total**                | **51** | **~42–50 working days** |         |

### Timeline (full-time, ~6–8 ghante/din, seekhte hue)

| Milestone                                                                                                       | Kab tak (approx.)                  |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **M1 — Foundation ready** (login, staff/teams/customers admin UI)                                               | ✅ Done                            |
| **M2 — Pilot / MVP** (assistants real calling shuru kar sakein: assignment, call form, Save & Next, follow-ups) | ✅ Done (pilot test ke liye ready) |
| **M3 — Feature complete** (categories, campaigns, import, provider, dashboard)                                  | Week 7–8                           |
| **M4 — Production live** (security, deploy, backups, monitoring, load test)                                     | Week 9–10                          |

> Estimates hain, promise nahi. Ye badal sakte hain agar:
>
> - din me kam ghante milein (part-time → ~2x time)
> - design doc section 27 ke decisions (call outcomes, mandatory fields, thresholds...) late aayein
> - telecalling.ai ki API/webhook docs late milein ya limited hon
> - requirements beech me badlein

### Decisions jo pehle chahiye (business se)

| Decision (design doc §27)                          | Kis step se pehle |
| -------------------------------------------------- | ----------------- |
| Final call outcome list + mandatory fields         | 2.1               |
| Assignment algorithm (round-robin / load / hybrid) | 2.2               |
| Reminder time, grace period, availability rules    | 3.3               |
| Category names + rating thresholds                 | 4.1               |
| telecalling.ai API/webhook docs + credentials      | 7.1               |
| Hosting (cloud/VPS), domain, backup policy         | 9.2               |

> Ye defaults ke saath configurable banayenge — decision aane pe sirf settings badlengi, code nahi.

---

## Phase 0 — Project Setup ✅

- [x] 0.1 Repo + README + .gitignore + design summary
- [x] 0.2 Tech stack decision (ADR 0001), roadmap, concepts doc
- [x] 0.3 Docker Compose: PostgreSQL + Redis
- [x] 0.4 Monorepo skeleton (npm workspaces): `apps/api` (NestJS), `apps/web` (Next.js)
- [x] 0.5 Code quality: Prettier (root) + lint (api: oxlint, web: ESLint) + typecheck
- [x] 0.6 CI: GitHub Actions (format, lint, typecheck, test, build — har push pe)

## Phase 1 — Foundation ✅

- [x] 1.1 Prisma setup + DB connection (health endpoint DB check)
- [x] 1.2 Schema: roles (enum), staff, teams — migration `init_staff_and_teams`
- [x] 1.3 Auth: login (JWT), password hashing (bcrypt), seed Super Admin
- [x] 1.4 RBAC: global JwtAuthGuard + RolesGuard, `@Public()` / `@Roles()` decorators
- [x] 1.5 Customers (jinko call karna hai) table + CRUD API, phone normalize + duplicate check
- [x] 1.6 Staff & Team management APIs (staff banao, password set, team assign)
- [x] 1.7 Audit log base (kisne kya kab kiya)
- [x] 1.8 Frontend: login page, auth state, role-based layout
- [x] 1.9 Frontend: admin screens — staff, teams, customers

## Phase 2 — Calling Workflow (core) ✅

- [x] 2.1 Configurable settings: call outcomes, next actions, mandatory fields
- [x] 2.2 Assignment engine — backend lock, ONE customer at a time, no duplicates
- [x] 2.3 Calls table + call form API with mandatory-field validation
- [x] 2.4 "Save & Next" — ek transaction me save + next release
- [x] 2.5 Customer 360° profile API (details + call history + timeline)
- [x] 2.6 Frontend: assistant calling screen (Start Calling → profile → form → Save & Next)
- [x] 2.7 Manager manual assignment / reassignment (API + UI)

## Phase 3 — Follow-ups ✅

- [x] 3.1 Follow-ups table — call save pe automatic create
- [x] 3.2 Assistant availability (Available / On Call / Break / Offline) — API + UI toggle
- [x] 3.3 BullMQ + Redis setup — scheduled reminder jobs
- [x] 3.4 Due → grace period → escalation to another available assistant
- [x] 3.5 In-app notifications (assistant, TL, manager)
- [x] 3.6 Frontend: follow-up list (due / pending / overdue)

## Phase 4 — Rating & Categories

- [ ] 4.1 Category thresholds as settings (0–4 Low, 5–7 Medium, 8–9 High, 10 VIP)
- [ ] 4.2 Category engine — call save pe auto category update + history
- [ ] 4.3 Tags + priority
- [ ] 4.4 Frontend: admin settings screen

## Phase 5 — Campaigns

- [ ] 5.1 Campaigns, campaign customers, campaign assistants/teams
- [ ] 5.2 Campaign-aware + priority-aware assignment
- [ ] 5.3 Campaign custom fields + call scripts
- [ ] 5.4 Frontend: campaign management

## Phase 6 — Bulk Import (20,000 users)

- [ ] 6.1 CSV/Excel upload + parse
- [ ] 6.2 Validation + duplicate detection + preview (success/failure counts)
- [ ] 6.3 Background import job + import history
- [ ] 6.4 Frontend: import wizard

## Phase 7 — Calling Provider Integration (telecalling.ai docs ke baad)

- [ ] 7.1 Provider adapter interface (provider badalna aasaan)
- [ ] 7.2 Click-to-call / open call from CRM
- [ ] 7.3 Webhooks → call events + recording link in history

## Phase 8 — Dashboard & Reports

- [ ] 8.1 Dashboard APIs (today/week/month/custom filters)
- [ ] 8.2 Frontend: management dashboard
- [ ] 8.3 Reports + CSV export (assistant, campaign, follow-ups)

## Phase 9 — Production Hardening

- [ ] 9.1 Security: rate limiting, refresh tokens, security headers, password reset
- [ ] 9.2 Production Dockerfiles + Nginx + environment configs
- [ ] 9.3 CD pipeline (GitHub Actions → server deploy)
- [ ] 9.4 Backups + monitoring + logging + alerts
- [ ] 9.5 Load test (20k customers, 10+ assistants) + UAT with real team
