# ADR 0004 — Audit Log

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Design doc section 19: important actions traceable hone chahiye ("Amit assigned User #10234",
"Follow-up escalated because Amit unavailable"). Managers ko pata hona chahiye kisne kya kab badla.

## Decisions

| Topic         | Decision                                                                                              | Reason                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Storage       | Ek generic `audit_logs` table (Postgres)                                                              | Saari entities ke liye ek format; filter by entity/actor/action/date                |
| Format        | `action` (`entity.verb`), `entity_type`, `entity_id`, `actor_id`, `changes` (JSON), `metadata` (JSON) | Flexible — naye entities (calls, follow-ups) bina schema change ke                  |
| What changed  | Sirf **badle hue fields** `{ field: { from, to } }` (`diffChanges`)                                   | Chhota, padhne layak; kuch nahi badla to entry nahi                                 |
| Consistency   | Audit entry **same DB transaction** me jo asli change ho                                              | Change fail → audit bhi nahi; audit fail → change bhi rollback. Kabhi mismatch nahi |
| Immutability  | Append-only: sirf read API (`GET /api/audit-logs`), koi update/delete API nahi                        | Audit ko koi chhupa/badal na sake                                                   |
| Secrets       | Password / hash kabhi log nahi; password reset = sirf "hua" ka record                                 | Security                                                                            |
| Failed logins | Record hote hain (`actor_id = null`, email + reason)                                                  | Brute-force / galat access pakadna                                                  |
| Access        | MANAGER, SUPER_ADMIN                                                                                  | Sensitive history                                                                   |
| Actions list  | `AuditAction` constant (TypeScript)                                                                   | Typo se galat action save na ho                                                     |

## Future

- Request context (IP, user agent) har entry me — AsyncLocalStorage se
- Retention policy (e.g. 1–2 saal baad archive) — Phase 9
- Calls, assignments, follow-ups, escalations ke audit actions — Phase 2/3
- DB-level protection: app DB user ko `audit_logs` pe UPDATE/DELETE permission hi na ho — Phase 9
