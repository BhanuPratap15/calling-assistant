# Concepts — Seekhne ke Notes

Jo bhi naya concept aayega, yahan short me add hoga.

| Concept                   | Simple matlab                                                                                | Project me kahan                              |
| ------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Monorepo                  | Ek repo me multiple apps (api + web)                                                         | `apps/api`, `apps/web`                        |
| ORM                       | Code ↔ Database translator; SQL ki jagah TypeScript functions                                | Prisma                                        |
| Migration                 | DB schema change ka versioned script (git jaisa, DB ke liye)                                 | `prisma migrate`                              |
| REST API                  | Frontend backend se HTTP (GET/POST/...) pe baat karta hai                                    | NestJS controllers                            |
| JWT                       | Login ke baad milne wala signed token; har request me bheja jaata hai                        | Auth                                          |
| RBAC                      | Role-Based Access Control — role ke hisaab se permission                                     | NestJS Guards                                 |
| Transaction               | Multiple DB operations ya to sab honge ya koi nahi                                           | Save & Next                                   |
| Row lock                  | Ek row ko ek time pe ek hi process le sake                                                   | Assignment engine                             |
| Queue / Job               | Kaam baad me / background me chalana                                                         | Follow-up reminders, import                   |
| Environment variables     | Config/secrets code ke bahar (`.env`)                                                        | DB password, JWT secret                       |
| Healthcheck               | Container ready hai ya nahi, check karne ka command                                          | docker-compose                                |
| ADR                       | Architecture decision ka record                                                              | `docs/decisions/`                             |
| npm workspaces            | Root `package.json` se saare apps ki dependencies ek saath install/manage                    | `"workspaces": ["apps/*"]`                    |
| package-lock.json         | Exact installed versions ka record — sabki machine pe same versions                          | Root pe, hamesha commit karo                  |
| Module (NestJS)           | Ek feature ka box: controller + service ek saath                                             | `app.module.ts`                               |
| Controller                | URL/route sunta hai (GET /api/health) aur response deta hai                                  | `app.controller.ts`                           |
| Service                   | Asli business logic; controller isko call karta hai                                          | `app.service.ts`                              |
| Decorator                 | `@Get()`, `@Controller()` — function/class pe label jo framework ko batata hai kya karna hai | NestJS everywhere                             |
| Dependency Injection      | Class khud object nahi banati, framework bana ke deta hai (constructor me)                   | `constructor(private appService: AppService)` |
| CORS                      | Browser security: ek origin (3000) dusre (4000) ko call kar sake, uski permission            | `main.ts`                                     |
| Unit test vs e2e test     | Unit = ek class akeli; e2e = poora app HTTP request se                                       | `*.spec.ts`, `test/*.e2e-spec.ts`             |
| App Router (Next.js)      | `src/app/` me folder = URL page (`app/login/page.tsx` → `/login`)                            | `apps/web/src/app`                            |
| Prettier                  | Code formatter — spaces/quotes/commas automatically ek jaise                                 | `npm run format`                              |
| Linter                    | Code me galtiyan/bad patterns pakadta hai (format nahi, logic)                               | oxlint (api), ESLint (web)                    |
| Typecheck                 | TypeScript types sahi hain ya nahi, bina run kiye check                                      | `npm run typecheck`                           |
| CI (GitHub Actions)       | Har push pe GitHub server pe checks automatically chalte hain                                | `.github/workflows/ci.yml`                    |
| `npm ci` vs `npm install` | `ci` = lockfile se exact install (CI ke liye); `install` = lockfile update kar sakta hai     | CI workflow                                   |
