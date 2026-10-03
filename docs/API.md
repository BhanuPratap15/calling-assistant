# API Reference

Base URL (local): `http://localhost:4000/api` · Frontend se: `/api/...` (Next.js rewrite)

- **Auth:** browser → httpOnly cookie (login pe set); tools → `Authorization: Bearer <accessToken>`
- **Default:** har route ko login chahiye. `Public` = bina login.
- **SUPER_ADMIN** ko har route ka access hai (table me alag se nahi likha).
- Errors: `{ statusCode, message, error }` — `400` validation, `401` login nahi, `403` permission nahi,
  `404` nahi mila, `409` conflict (duplicate / state badal gaya)
- Manual testing: [`apps/api/api.http`](../apps/api/api.http) (VS Code "REST Client")

## Health

| Method | URL       | Access | Notes                                                        |
| ------ | --------- | ------ | ------------------------------------------------------------ |
| GET    | `/health` | Public | `{ status, database: up/down, scheduler: up/down/disabled }` |

## Auth & availability

| Method | URL                     | Access | Notes                                                                                          |
| ------ | ----------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| POST   | `/auth/login`           | Public | `{ email, password }` → `{ accessToken, expiresAt, user }` + cookie. Calling staff → AVAILABLE |
| POST   | `/auth/logout`          | Public | Cookie clear + OFFLINE                                                                         |
| GET    | `/auth/me`              | Any    | User + `availability`                                                                          |
| PATCH  | `/auth/availability`    | Any    | `{ availability: AVAILABLE \| BREAK \| OFFLINE }` (ON_CALL system set karta hai)               |
| POST   | `/auth/change-password` | Any    | `{ currentPassword, newPassword }` → 204                                                       |

## Staff & teams

| Method      | URL                              | Access               | Notes                                                             |
| ----------- | -------------------------------- | -------------------- | ----------------------------------------------------------------- |
| POST        | `/staff`                         | MANAGER              | Manager sirf TEAM_LEADER / ASSISTANT bana sakta hai               |
| GET         | `/staff?role=&teamId=&isActive=` | MANAGER              |                                                                   |
| GET / PATCH | `/staff/:id`                     | MANAGER              | Khud ka role / active status nahi badal sakte                     |
| POST        | `/staff/:id/reset-password`      | MANAGER              | `{ newPassword }` → 204                                           |
| POST        | `/teams`                         | MANAGER              | `{ name, description?, leaderId? }` (leader = active TEAM_LEADER) |
| GET         | `/teams`, `/teams/:id`           | MANAGER, TEAM_LEADER | TL: sirf apni teams; `:id` me members                             |
| PATCH       | `/teams/:id`                     | MANAGER              | `leaderId: null` = leader hatao                                   |

## Customers

| Method | URL                                                    | Access                           | Notes                                                                   |
| ------ | ------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------- |
| POST   | `/customers`                                           | MANAGER                          | Phone E.164 me normalize; duplicate → 409                               |
| GET    | `/customers?search=&status=&priority=&page=&pageSize=` | MANAGER, TEAM_LEADER             | Paginated; open assignment ke saath                                     |
| GET    | `/customers/:id`                                       | MANAGER, TEAM_LEADER             |                                                                         |
| GET    | `/customers/:id/profile`                               | MANAGER, TEAM_LEADER, ASSISTANT* | 360°: details + calls + open assignment. *Assistant: sirf apna assigned |
| PATCH  | `/customers/:id`                                       | MANAGER                          | Delete nahi — `status: DO_NOT_CALL / INVALID`                           |

## Call form settings

| Method       | URL                               | Access  | Notes                                                                         |
| ------------ | --------------------------------- | ------- | ----------------------------------------------------------------------------- |
| GET          | `/call-config`                    | Any     | Active outcomes, next actions, required-field rules, follow-up timing         |
| GET          | `/call-config/admin`              | MANAGER | Inactive bhi                                                                  |
| POST / PATCH | `/call-config/outcomes[/:id]`     | MANAGER | `code` UPPER_SNAKE, immutable; `isConnected`                                  |
| POST / PATCH | `/call-config/next-actions[/:id]` | MANAGER | `requiresFollowUp`                                                            |
| PUT          | `/call-config/required-fields`    | MANAGER | `{ userResponse, notes, interestRating }` = `always \| connected \| optional` |
| PUT          | `/call-config/follow-up-timing`   | MANAGER | `{ reminderMinutesBefore, gracePeriodMinutes, presenceTimeoutMinutes }`       |

## Categories & tags

| Method | URL                   | Access               | Notes                                                                                                                                                           |
| ------ | --------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/categories`         | Any                  | Rating ranges (inactive bhi)                                                                                                                                    |
| GET    | `/categories/summary` | MANAGER, TEAM_LEADER | `{ categories: [{…, count}], uncategorized }`                                                                                                                   |
| PUT    | `/categories`         | MANAGER              | `{ categories: [{ id?, code, label, minRating, maxRating, color, priority, isActive, sortOrder }] }` → `{ categories, recalculated, uncovered }`. Overlap → 400 |
| GET    | `/tags`               | Any                  | `_count.customers` ke saath                                                                                                                                     |
| POST   | `/tags`               | MANAGER              | `{ name, color? }` — duplicate → 409                                                                                                                            |
| PATCH  | `/tags/:id`           | MANAGER              | `{ name?, color?, isActive? }`                                                                                                                                  |

Rating → category **Save & Next** ke andar apne aap (`interestRating` diya ho to).

## Calling (assistant workflow)

| Method | URL                 | Access                 | Notes                                                                                                                                     |
| ------ | ------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/calling/current`  | ASSISTANT, TEAM_LEADER | `{ current }` — null = koi nahi                                                                                                           |
| POST   | `/calling/next`     | ASSISTANT, TEAM_LEADER | "Start Calling": current → due follow-ups → manager queue → fresh (priority). Idempotent                                                  |
| POST   | `/calling/complete` | ASSISTANT, TEAM_LEADER | "Save & Next": `{ outcomeId, nextActionId, userResponse?, notes?, interestRating?, followUpAt? }` → `{ call, current }`. 409 = reassigned |

## Assignments

| Method | URL                                                                              | Access               | Notes                                       |
| ------ | -------------------------------------------------------------------------------- | -------------------- | ------------------------------------------- |
| GET    | `/assignments?status=open\|ASSIGNED\|IN_PROGRESS\|COMPLETED\|CANCELLED&staffId=` | MANAGER, TEAM_LEADER | TL: apni team                               |
| GET    | `/assignments/assignable-staff`                                                  | MANAGER, TEAM_LEADER | Dropdown ke liye (scoped)                   |
| POST   | `/assignments`                                                                   | MANAGER, TEAM_LEADER | `{ customerId, staffId }` — open hai to 409 |
| POST   | `/assignments/:id/reassign`                                                      | MANAGER, TEAM_LEADER | `{ staffId }`                               |
| POST   | `/assignments/:id/cancel`                                                        | MANAGER, TEAM_LEADER | Customer wapas pool me                      |

## Follow-ups

| Method | URL                                                                              | Access               | Notes                                        |
| ------ | -------------------------------------------------------------------------------- | -------------------- | -------------------------------------------- |
| GET    | `/follow-ups?bucket=open\|upcoming\|due\|overdue\|completed\|cancelled&ownerId=` | Any (scoped)         | Assistant: apne · TL: team · Manager: sab    |
| GET    | `/follow-ups/summary`                                                            | Any (scoped)         | `{ upcoming, due, overdue, completedToday }` |
| POST   | `/follow-ups/:id/reschedule`                                                     | Owner, TL, MANAGER   | `{ dueAt }` (future) — reminders reset       |
| POST   | `/follow-ups/:id/reassign`                                                       | MANAGER, TEAM_LEADER | `{ staffId }` + notification                 |
| POST   | `/follow-ups/:id/cancel`                                                         | MANAGER, TEAM_LEADER |                                              |

Follow-up **create / complete** alag API nahi — `/calling/complete` (Save & Next) ke andar hota hai.
Reminder / due / escalation / overdue — background scheduler (BullMQ, har 30s).

## Notifications

| Method | URL                           | Access | Notes                   |
| ------ | ----------------------------- | ------ | ----------------------- |
| GET    | `/notifications?unread=true`  | Any    | Sirf apni, latest 50    |
| GET    | `/notifications/unread-count` | Any    | `{ count }` (header 🔔) |
| POST   | `/notifications/:id/read`     | Any    | 204                     |
| POST   | `/notifications/read-all`     | Any    | 204                     |

## Audit

| Method | URL                                                                  | Access  | Notes                   |
| ------ | -------------------------------------------------------------------- | ------- | ----------------------- |
| GET    | `/audit-logs?entityType=&entityId=&actorId=&action=&from=&to=&page=` | MANAGER | Read-only, newest first |
