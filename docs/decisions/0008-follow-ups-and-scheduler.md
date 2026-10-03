# ADR 0008 — Follow-ups, Availability, Scheduler & Notifications

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Design doc section 8 ("4 PM example"), 8.2 (availability), 18 (notifications):
follow-up promise miss nahi hona chahiye; original assistant unavailable ho to grace period ke baad
kisi aur available assistant ko jaana chahiye, poori history ke saath.

## Decisions

| Topic                              | Decision                                                                                                          | Reason                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Follow-up record                   | Alag `follow_ups` table; Save & Next transaction ke andar banta hai                                               | Reminder, escalation, report — comment me dabba nahi                                                |
| Ek customer = ek open follow-up    | Unique nullable `open_customer_id` (assignments wali trick)                                                       | Duplicate promises nahi; customer ko koi bhi call kare → open follow-up complete                    |
| Engine order                       | current → **mere due follow-ups** → manager queue → fresh                                                         | Promise time pe pehle                                                                               |
| Availability                       | `AVAILABLE / ON_CALL / BREAK / OFFLINE`; login → AVAILABLE, logout → OFFLINE, Start Calling → ON_CALL             | Design doc 8.2                                                                                      |
| Presence                           | `last_seen_at` heartbeat (auth guard, max 1/min) + `presenceTimeoutMinutes`                                       | Browser band karke gaya assistant "AVAILABLE" dikhte hue bhi escalation pakad le                    |
| Scheduler                          | **BullMQ job scheduler** (Redis) har 30s `tick()`                                                                 | Multi-server safe (ek hi job ek baar), retry, observability                                         |
| Source of truth                    | Har tick **database** se poochta hai (per-follow-up delayed jobs nahi)                                            | Job miss / restart / reschedule / setting change — sab automatically sahi; cleanup ki zaroorat nahi |
| Idempotency                        | Markers (`reminder_sent_at`, `due_notified_at`, `overdue_notified_at`, `escalated_at`) + `FOR UPDATE SKIP LOCKED` | Dobara tick = dobara notification nahi; 2 servers = double processing nahi                          |
| Escalation rule                    | Grace ke baad PENDING + owner unavailable → available colleague (same team pehle, kam open follow-ups, naam)      | Design doc 8.1; load balance; predictable                                                           |
| Owner available par call nahi kiya | Escalate nahi; **Team Leader** (ya managers) ko ek baar OVERDUE alert                                             | Insaan decide kare — kaam chhinna galat                                                             |
| Ping-pong                          | Agla escalation check `escalated_at + grace` ke baad                                                              | Baar-baar owner badalta na rahe                                                                     |
| Notifications                      | `notifications` table + `🔔` header, 30s polling                                                                  | Simple, reliable; WebSocket/email baad me isi table se                                              |
| Timing config                      | `follow_up.timing` setting (reminder 1, grace 10, presence 5 min) — Settings page                                 | Design doc: "configurable by admin"                                                                 |
| Testability                        | `tick(now)` → tests time travel; tests me `SCHEDULER_ENABLED=false`; CI smoke test asli Redis ke saath            | Fast deterministic tests + real wiring check                                                        |

## Future

- Real-time push (WebSocket / SSE) — polling hata ke
- Email / SMS / WhatsApp notification channels
- Escalation attempts limit + manager auto-assign
