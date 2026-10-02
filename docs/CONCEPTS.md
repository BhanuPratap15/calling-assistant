# Concepts — Seekhne ke Notes

Jo bhi naya concept aayega, yahan short me add hoga.

| Concept | Simple matlab | Project me kahan |
|---|---|---|
| Monorepo | Ek repo me multiple apps (api + web) | `apps/api`, `apps/web` |
| ORM | Code ↔ Database translator; SQL ki jagah TypeScript functions | Prisma |
| Migration | DB schema change ka versioned script (git jaisa, DB ke liye) | `prisma migrate` |
| REST API | Frontend backend se HTTP (GET/POST/...) pe baat karta hai | NestJS controllers |
| JWT | Login ke baad milne wala signed token; har request me bheja jaata hai | Auth |
| RBAC | Role-Based Access Control — role ke hisaab se permission | NestJS Guards |
| Transaction | Multiple DB operations ya to sab honge ya koi nahi | Save & Next |
| Row lock | Ek row ko ek time pe ek hi process le sake | Assignment engine |
| Queue / Job | Kaam baad me / background me chalana | Follow-up reminders, import |
| Environment variables | Config/secrets code ke bahar (`.env`) | DB password, JWT secret |
| Healthcheck | Container ready hai ya nahi, check karne ka command | docker-compose |
| ADR | Architecture decision ka record | `docs/decisions/` |
