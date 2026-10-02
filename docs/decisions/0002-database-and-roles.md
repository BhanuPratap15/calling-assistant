# ADR 0002 — Database Conventions & Roles

- **Status:** Accepted
- **Date:** 2026-10-02

## Decisions

| Topic              | Decision                                                                              | Reason                                                                             |
| ------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Primary keys       | UUID (`@db.Uuid`)                                                                     | URL me guess nahi ho sakte (`/staff/1`, `/staff/2`...), multiple systems me unique |
| Naming             | TS me camelCase, DB me snake_case (`@map`/`@@map`)                                    | Dono duniya ke standard convention                                                 |
| Timestamps         | `timestamptz` (timezone ke saath)                                                     | Follow-up "4 PM" jaise time timezone ke saath sahi store ho                        |
| Roles              | Postgres **enum** `staff_role` (4 fixed roles)                                        | Design doc me 4 roles confirmed; enum simple + DB-level safe                       |
| Delete             | `is_active = false` (soft deactivate)                                                 | Purane calls/history ka link toote nahi                                            |
| Staff vs Customers | Alag tables: `staff` (login karne wale) aur customers (jinko call hota hai, Step 1.5) | Dono ka data aur security bilkul alag hai                                          |
| Prisma 7           | `prisma-client` generator + `@prisma/adapter-pg` driver adapter                       | Prisma 7 ka recommended setup                                                      |

## Future

- Agar fine-grained permissions chahiye (e.g. "TL X ko reports dikhen par export nahi"),
  to `permissions` + `role_permissions` tables add karenge — naya ADR.
