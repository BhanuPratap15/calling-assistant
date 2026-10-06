# API Reference

Base URL (local): `http://localhost:4000/api` · Frontend se: `/api/...` (Next.js rewrite)

- **Auth:** browser → httpOnly cookie (login pe set); tools → `Authorization: Bearer <accessToken>`
- **Default:** har route ko login chahiye. `Public` = bina login.
- **SUPER_ADMIN** ko har route ka access hai (table me alag se nahi likha).
- Errors: `{ statusCode, message, error }` — `400` validation, `401` login nahi, `403` permission nahi,
  `404` nahi mila, `409` conflict (duplicate / state badal gaya)
- Manual testing: [`apps/api/api.http`](../apps/api/api.http) (VS Code "REST Client")

## Health

`GET /api/health` (public): `{ status, database, scheduler, version, uptimeSec }` — database down → **503**.

| Method | URL       | Access | Notes                                                        |
| ------ | --------- | ------ | ------------------------------------------------------------ |
| GET    | `/health` | Public | `{ status, database: up/down, scheduler: up/down/disabled }` |

## Auth & availability

| Method | URL                     | Access | Notes                                                                                                                                                          |
| ------ | ----------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/login`           | Public | `{ email, password }` → `{ accessToken, expiresAt, user (+ mustChangePassword) }` + cookie. Calling staff → AVAILABLE. 5 galat (IP + email) / 15 min → **429** |
| POST   | `/auth/logout`          | Public | Token **revoke** (purana token / cookie dobara kaam nahi karta) + cookie clear + OFFLINE                                                                       |
| GET    | `/auth/me`              | Any    | User + `availability` + `mustChangePassword`                                                                                                                   |
| PATCH  | `/auth/availability`    | Any    | `{ availability: AVAILABLE \| BREAK \| OFFLINE }` (ON_CALL system set karta hai)                                                                               |
| POST   | `/auth/change-password` | Any    | `{ currentPassword, newPassword }` → `{ accessToken, expiresAt }` (naya cookie). Baaki saare sessions logout. Naya ≠ purana                                    |

**Security (Phase 9):** manager ne staff banaya / password reset kiya → `mustChangePassword` — tab tak sirf `/auth/me` + `/auth/change-password`, baaki **403 `Password change required`**. Logout / password change / reset / deactivate → purane tokens **401 `Session expired`**. Har IP: `RATE_LIMIT_PER_MIN` (default 3000) → 429 + `Retry-After`. Har response me `X-Request-Id`.

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

| Method | URL                                                    | Access                           | Notes                                                                                                         |
| ------ | ------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| POST   | `/customers`                                           | MANAGER                          | Phone E.164 me normalize; duplicate → 409                                                                     |
| GET    | `/customers?search=&status=&priority=&page=&pageSize=` | MANAGER, TEAM_LEADER             | Paginated; open assignment ke saath                                                                           |
| GET    | `/customers/:id`                                       | MANAGER, TEAM_LEADER             |                                                                                                               |
| GET    | `/customers/:id/profile`                               | MANAGER, TEAM_LEADER, ASSISTANT* | 360°: details + calls (campaign + customFields) + campaigns + open assignment. *Assistant: sirf apna assigned |
| PATCH  | `/customers/:id`                                       | MANAGER                          | Delete nahi — `status: DO_NOT_CALL / INVALID`                                                                 |

## Call form settings

| Method       | URL                               | Access  | Notes                                                                                           |
| ------------ | --------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| GET          | `/call-config`                    | Any     | Active outcomes, next actions, required-field rules, follow-up timing                           |
| GET          | `/call-config/admin`              | MANAGER | Inactive bhi                                                                                    |
| POST / PATCH | `/call-config/outcomes[/:id]`     | MANAGER | `code` UPPER_SNAKE, immutable; `isConnected`                                                    |
| POST / PATCH | `/call-config/next-actions[/:id]` | MANAGER | `requiresFollowUp`                                                                              |
| PUT          | `/call-config/required-fields`    | MANAGER | `{ userResponse, notes, interestRating }` = `always \| connected \| optional`                   |
| PUT          | `/call-config/follow-up-timing`   | MANAGER | `{ reminderMinutesBefore, gracePeriodMinutes, presenceTimeoutMinutes }`                         |
| PUT          | `/call-config/calling-workflow`   | MANAGER | `{ incompleteFormMinutes (1–480), autoReleaseMinutes (0–1440, 0 = off) }` — watchdog (ADR 0015) |

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

| Method | URL                 | Access                 | Notes                                                                                                                                                                                                                            |
| ------ | ------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/calling/current`  | ASSISTANT, TEAM_LEADER | `{ current }` — null = koi nahi                                                                                                                                                                                                  |
| POST   | `/calling/next`     | ASSISTANT, TEAM_LEADER | "Start Calling": current → due follow-ups → manager queue → campaign queue → fresh (priority). Idempotent                                                                                                                        |
| POST   | `/calling/complete` | ASSISTANT, TEAM_LEADER | "Save & Next": `{ outcomeId, nextActionId, userResponse?, notes?, interestRating?, followUpAt?, customFields?, stop? }` → `{ call, current }`. `stop: true` = "Save & Stop" (current null, availability BREAK). 409 = reassigned |
| POST   | `/calling/release`  | ASSISTANT, TEAM_LEADER | "Stop calling": `{ note? }` → `{ released, result: 'released' \| 'requeued' }`. Bina call ke current chhodo; BREAK. 409 = current nahi / **dial ho chuka** (form save karo). ADR 0015                                            |
| POST   | `/calling/dial`     | ASSISTANT, TEAM_LEADER | "📞 Call" current customer: `{ number?: 'primary' \| 'alternate' }` → `{ session, dialUrl }` (manual: `tel:` link). 400 = current customer nahi, 409 = call already live, 502 = provider error                                   |
| GET    | `/calling/sessions` | ASSISTANT, TEAM_LEADER | Current customer ke dial attempts: `status, durationSec, recordingUrl, failReason` (UI 2s poll)                                                                                                                                  |

`current.campaign` = `{ id, name, script, fields[] }` (campaign customer ho to). `customFields` = `{ "<field key>": value }` —
campaign ke active fields se validate (unknown key / required / type → 400).

## Calling provider (telephony)

| Method | URL                             | Access            | Notes                                                                                    |
| ------ | ------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/telephony/config`             | Any logged-in     | `{ provider, mode: 'manual' \| 'api' }`                                                  |
| POST   | `/telephony/webhooks/:provider` | **Public** + HMAC | Provider → CRM call events. Response `{ received, applied, stale, duplicates, unknown }` |

Webhook (mock / generic format) — headers `X-CRM-Timestamp: <unix sec>`, `X-CRM-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>`;
body `{ "events": [ { eventId, callId, type, occurredAt?, durationSec?, recordingUrl?, reason? } ] }`.
`type`: `ringing | answered | completed | no_answer | busy | failed | canceled | recording`. 5 min se purana timestamp → 401.
Session status: `DIALED` (manual) / `INITIATED → RINGING → ANSWERED → COMPLETED | NO_ANSWER | BUSY | FAILED | CANCELED` (sirf aage badhta hai).
Save & Next pe attempts CRM call se link → profile `calls[].telephony[]`. Details: [ADR 0012](decisions/0012-calling-provider.md).

## Assignments

| Method | URL                                                                              | Access               | Notes                                                                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/assignments?status=open\|ASSIGNED\|IN_PROGRESS\|COMPLETED\|CANCELLED&staffId=` | MANAGER, TEAM_LEADER | TL: apni team                                                                                                                                                                                                                                                                      |
| GET    | `/assignments/assignable-staff`                                                  | MANAGER, TEAM_LEADER | Dropdown ke liye (scoped)                                                                                                                                                                                                                                                          |
| POST   | `/assignments`                                                                   | MANAGER, TEAM_LEADER | `{ customerId, staffId, campaignId? }` — open hai to 409; campaignId: customer us campaign me ho                                                                                                                                                                                   |
| POST   | `/assignments/:id/reassign`                                                      | MANAGER, TEAM_LEADER | `{ staffId }`                                                                                                                                                                                                                                                                      |
| POST   | `/assignments/:id/cancel`                                                        | MANAGER, TEAM_LEADER | Customer wapas pool me                                                                                                                                                                                                                                                             |
| POST   | `/assignments/distribute`                                                        | MANAGER, TEAM_LEADER | Bulk: `{ staffIds[], strategy: ROUND_ROBIN \| LOAD_BASED, limit ≤ 2000, perStaffLimit?, campaignId?, categoryId?, tagId?, priority?, onlyFresh = true, dryRun = false }` → `{ eligible, assigned, perStaff[{ name, currentLoad, newCount }] }`. TL: sirf apni team (403). ADR 0015 |

## Campaigns

| Method | URL                                                                 | Access               | Notes                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/campaigns?status=DRAFT\|ACTIVE\|PAUSED\|COMPLETED`                | MANAGER, TEAM_LEADER | `_count` + `progress { total, called }`                                                                                                                                              |
| GET    | `/campaigns/:id`                                                    | MANAGER, TEAM_LEADER | + createdBy, staff, teams, fields, `stats { total, called, pending, byOutcome[] }`                                                                                                   |
| GET    | `/campaigns/:id/customers?state=all\|pending\|called&search=&page=` | MANAGER, TEAM_LEADER | Pending pehle                                                                                                                                                                        |
| POST   | `/campaigns`                                                        | MANAGER              | `{ name, description?, priority? (0–100), script?, startsAt?, endsAt? }` → DRAFT. Naam unique (409)                                                                                  |
| PATCH  | `/campaigns/:id`                                                    | MANAGER              | Upar wale fields + `status`. Allowed: DRAFT→ACTIVE/COMPLETED, ACTIVE↔PAUSED, →COMPLETED (final). Dates `null` = hatao                                                                |
| PUT    | `/campaigns/:id/members`                                            | MANAGER              | `{ staffIds, teamIds }` (poori list replace). Dono khaali = sab assistants                                                                                                           |
| POST   | `/campaigns/:id/customers`                                          | MANAGER              | `{ customerIds }` **ya** `{ filter: { categoryId\|'none', tagId, priority, neverCalled, search } }` → `{ matched, added, skipped }`. Sirf ACTIVE customers; COMPLETED campaign → 400 |
| POST   | `/campaigns/:id/customers/remove`                                   | MANAGER              | `{ customerIds }` → `{ removed }`                                                                                                                                                    |
| PUT    | `/campaigns/:id/fields`                                             | MANAGER              | `{ fields: [{ id?, key, label, type: TEXT\|NUMBER\|SELECT\|BOOLEAN, options, required, isActive, sortOrder }] }` — key + type save ke baad fix                                       |

Engine (Start Calling) campaign ke customers tabhi deta hai jab campaign **ACTIVE** ho, date window ke andar ho, aur
assistant member ho (ya campaign ke koi members na hon). Details: [ADR 0010](decisions/0010-campaigns.md).

## Dashboard & reports

Query (sab endpoints): `range=today|yesterday|week|month|7d|30d|custom` (default `7d`; `week` = Monday se, `month` = 1 tareekh se), custom → `from=YYYY-MM-DD&to=YYYY-MM-DD`
(inclusive, max 366 din), optional `teamId`, `staffId`, `campaignId`. Time zone: `REPORT_TIMEZONE` (default Asia/Kolkata).
Scope apne aap: ASSISTANT = khud, TEAM_LEADER = apni team (doosri team / staff → 403), MANAGER = sab.

| Method | URL                                                              | Access                          | Notes                                                                                                                                                                                                                                                      |
| ------ | ---------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/reports/summary`                                               | MANAGER, TEAM_LEADER, ASSISTANT | `kpis` (calls, connected, connectRate, avgRating, customers, followUpsPromised, dials, answered, talkTimeSec), `previous` (pichhla period), `daily[]`, `byHour[24]`, `outcomes[]`, `followUps` (due, completed, onTime, onTimeRate, escalated, overdueNow) |
| GET    | `/reports/assistants`                                            | MANAGER, TEAM_LEADER            | Har assistant: calls, connectRate, avgRating, talk time, follow-ups, overdue now, availability                                                                                                                                                             |
| GET    | `/reports/campaigns`                                             | MANAGER, TEAM_LEADER            | Progress (all time) + period ke calls, connectRate, avgRating                                                                                                                                                                                              |
| GET    | `/reports/export/calls.csv` · `assistants.csv` · `campaigns.csv` | MANAGER, TEAM_LEADER            | Same filters; max 50,000 rows (zyada → 400); audit `report.exported`                                                                                                                                                                                       |

Details: [ADR 0013](decisions/0013-dashboard-and-reports.md).

## Bulk import

Sirf **MANAGER** (+ SUPER_ADMIN). Flow: upload → preview → confirm → background → result. Details: [ADR 0011](decisions/0011-bulk-import.md).

| Method | URL                                                                           | Notes                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/imports`                                                                    | `multipart/form-data`, field `file` (.csv / .xlsx, max 10 MB, 50k rows) → batch `PREVIEW` (abhi customers nahi bante). 400 = missing column / galat file |
| GET    | `/imports?status=&page=`                                                      | History: file, status, counts, createdBy, campaign, tag                                                                                                  |
| GET    | `/imports/:id`                                                                | `totalRows, validRows, invalidRows, duplicateRows, importedRows, skippedRows, ignoredColumns, error` (UI progress ke liye poll)                          |
| GET    | `/imports/:id/rows?status=VALID\|INVALID\|DUPLICATE\|IMPORTED\|SKIPPED&page=` | Har line: `rowNumber, raw, status, errors[], customerId`                                                                                                 |
| GET    | `/imports/:id/problems.csv`                                                   | INVALID / DUPLICATE / SKIPPED lines + wajah (CSV download, template columns)                                                                             |
| POST   | `/imports/:id/confirm`                                                        | `{ campaignId?, tagId? }` — sirf PREVIEW; `QUEUED` return, kaam background me                                                                            |
| POST   | `/imports/:id/cancel`                                                         | Sirf PREVIEW                                                                                                                                             |
| POST   | `/imports/:id/retry`                                                          | Sirf FAILED — bachi hui VALID lines se aage                                                                                                              |

Columns: `name`_, `phone`_, `alternate_phone`, `email`, `external_id`, `priority` (LOW/NORMAL/HIGH/URGENT), `notes`.
Aliases chalte hain ("Full Name", "Mobile No", "User ID", "Remarks"...). Batch status: `PREVIEW → QUEUED → PROCESSING → COMPLETED | FAILED`, ya `CANCELLED`.

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

Types: `FOLLOW_UP_*` (Phase 3), `IMPORT_COMPLETED / FAILED`, `ASSIGNMENT_NEW` (assign / reassign / distribute),
`FORM_INCOMPLETE` (watchdog), `ASSIGNMENT_AUTO_RELEASED` (assistant + TL / managers), `CAMPAIGN_EXHAUSTED` (creator + managers, ek baar).

## Audit

| Method | URL                                                                  | Access  | Notes                   |
| ------ | -------------------------------------------------------------------- | ------- | ----------------------- |
| GET    | `/audit-logs?entityType=&entityId=&actorId=&action=&from=&to=&page=` | MANAGER | Read-only, newest first |
