# Concepts — Seekhne ke Notes

Jo bhi naya concept aayega, yahan short me add hoga.

| Concept                           | Simple matlab                                                                                | Project me kahan                              |
| --------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Monorepo                          | Ek repo me multiple apps (api + web)                                                         | `apps/api`, `apps/web`                        |
| ORM                               | Code ↔ Database translator; SQL ki jagah TypeScript functions                                | Prisma                                        |
| Migration                         | DB schema change ka versioned script (git jaisa, DB ke liye)                                 | `prisma migrate`                              |
| REST API                          | Frontend backend se HTTP (GET/POST/...) pe baat karta hai                                    | NestJS controllers                            |
| JWT                               | Login ke baad milne wala signed token; har request me bheja jaata hai                        | Auth                                          |
| RBAC                              | Role-Based Access Control — role ke hisaab se permission                                     | NestJS Guards                                 |
| Transaction                       | Multiple DB operations ya to sab honge ya koi nahi                                           | Save & Next                                   |
| Row lock                          | Ek row ko ek time pe ek hi process le sake                                                   | Assignment engine                             |
| Queue / Job                       | Kaam baad me / background me chalana                                                         | Follow-up reminders, import                   |
| Environment variables             | Config/secrets code ke bahar (`.env`)                                                        | DB password, JWT secret                       |
| Healthcheck                       | Container ready hai ya nahi, check karne ka command                                          | docker-compose                                |
| ADR                               | Architecture decision ka record                                                              | `docs/decisions/`                             |
| npm workspaces                    | Root `package.json` se saare apps ki dependencies ek saath install/manage                    | `"workspaces": ["apps/*"]`                    |
| package-lock.json                 | Exact installed versions ka record — sabki machine pe same versions                          | Root pe, hamesha commit karo                  |
| Module (NestJS)                   | Ek feature ka box: controller + service ek saath                                             | `app.module.ts`                               |
| Controller                        | URL/route sunta hai (GET /api/health) aur response deta hai                                  | `app.controller.ts`                           |
| Service                           | Asli business logic; controller isko call karta hai                                          | `app.service.ts`                              |
| Decorator                         | `@Get()`, `@Controller()` — function/class pe label jo framework ko batata hai kya karna hai | NestJS everywhere                             |
| Dependency Injection              | Class khud object nahi banati, framework bana ke deta hai (constructor me)                   | `constructor(private appService: AppService)` |
| CORS                              | Browser security: ek origin (3000) dusre (4000) ko call kar sake, uski permission            | `main.ts`                                     |
| Unit test vs e2e test             | Unit = ek class akeli; e2e = poora app HTTP request se                                       | `*.spec.ts`, `test/*.e2e-spec.ts`             |
| App Router (Next.js)              | `src/app/` me folder = URL page (`app/login/page.tsx` → `/login`)                            | `apps/web/src/app`                            |
| Prettier                          | Code formatter — spaces/quotes/commas automatically ek jaise                                 | `npm run format`                              |
| Linter                            | Code me galtiyan/bad patterns pakadta hai (format nahi, logic)                               | oxlint (api), ESLint (web)                    |
| Typecheck                         | TypeScript types sahi hain ya nahi, bina run kiye check                                      | `npm run typecheck`                           |
| CI (GitHub Actions)               | Har push pe GitHub server pe checks automatically chalte hain                                | `.github/workflows/ci.yml`                    |
| `npm ci` vs `npm install`         | `ci` = lockfile se exact install (CI ke liye); `install` = lockfile update kar sakta hai     | CI workflow                                   |
| Prisma schema                     | `schema.prisma` — tables (models), columns, relations ek file me                             | `apps/api/prisma/schema.prisma`               |
| Prisma Client                     | Schema se generate hua TypeScript code jisse DB query karte hain                             | `src/generated/prisma` (git me nahi)          |
| Migration (practical)             | Schema badlo → `npm run db:migrate -- --name xyz` → SQL file banti hai + DB update           | `prisma/migrations/` (git me commit)          |
| `migrate dev` vs `migrate deploy` | dev = naya migration banao (local); deploy = bane hue apply karo (CI/production)             | package.json scripts                          |
| Primary key / UUID                | Har row ki unique ID; UUID = random 36-char ID                                               | `id` column                                   |
| Foreign key / Relation            | Ek table doosre ko point kare (`staff.team_id → teams.id`)                                   | Staff ↔ Team                                  |
| Index                             | DB ki "kitaab ki index" — search fast                                                        | `@@index`, `@unique`                          |
| Enum                              | Fixed values ki list (DB galat value reject karega)                                          | `staff_role`, `availability`                  |
| Global module                     | NestJS me ek baar register, har jagah available                                              | `PrismaModule`                                |
| Mock                              | Test me asli cheez (DB) ki jagah nakli object                                                | `app.controller.spec.ts`                      |
| CI service container              | CI job ke saath chalne wala temporary DB                                                     | `ci.yml` → `services: postgres`               |
| Password hashing (bcrypt)         | Password ko one-way "hash" me badalna; DB leak ho to bhi password nahi milta                 | `auth/password.ts`                            |
| JWT (practical)                   | Login pe server signed token deta hai; har request me `Authorization: Bearer <token>`        | `auth.service.ts`                             |
| Guard (NestJS)                    | Route se pehle chalne wala check — allow/deny                                                | `auth/guards/`                                |
| Secure by default                 | Har route pe login zaroori; khula route explicitly `@Public()`                               | `JwtAuthGuard`                                |
| 401 vs 403                        | 401 = login nahi / token galat; 403 = login hai par permission nahi                          | Guards                                        |
| DTO + ValidationPipe              | Request body ka shape + rules; galat body → 400                                              | `auth/dto/login.dto.ts`                       |
| Seed                              | DB me shuruaati zaroori data (pehla Super Admin)                                             | `prisma/seed.ts`                              |
| Timing attack                     | Response time se secret ka andaza lagana — isliye email na mile tab bhi hash compare         | `auth.service.ts`                             |
| `.http` file                      | VS Code se API requests bhejne ki file (Postman jaisa)                                       | `apps/api/api.http`                           |
| E.164 phone format                | International standard: `+919876543210` — ek number ka ek hi roop                            | `common/phone.ts`                             |
| Pagination                        | Bada data pages me: `?page=2&pageSize=20` + `meta.total`                                     | `common/pagination.dto.ts`                    |
| Query params vs Body              | GET me filters URL me (`?search=`), POST/PATCH me data body (JSON) me                        | Customers API                                 |
| POST vs PATCH                     | POST = naya banao (201); PATCH = sirf diye hue fields badlo (200)                            | Customers API                                 |
| 409 Conflict                      | Request sahi hai par data clash (duplicate phone)                                            | `customers.service.ts`                        |
| Unique constraint                 | DB khud duplicate rokta hai — app me bug ho tab bhi                                          | `phone @unique`                               |
| Soft status (no delete)           | Delete ki jagah `DO_NOT_CALL` / `INVALID` — history bachi rahe                               | `CustomerStatus`                              |
| Test isolation                    | Parallel tests apna-apna unique data use karein, ek doosre ka delete na karein               | `test/*.e2e-spec.ts`                          |
