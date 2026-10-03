# ADR 0007 — Assignment Engine & Calling Workflow

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Design doc section 5, 7, 9: assistant ek waqt me **ek** customer pe kaam kare; form poora kiye bina next nahi;
do assistants ko **kabhi same customer nahi**; manager manual assign / reassign kar sake.

## Decisions

| Topic               | Decision                                                                                                                         | Reason                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model               | **Pull**: assistant "Start Calling" dabaye → backend turant ek customer de                                                       | Simple, koi idle nahi, pre-distribution ki zaroorat nahi                                                                                                    |
| Queue order         | 1) already current → wahi 2) manager ki ASSIGNED queue (priority) 3) fresh customer                                              | Manager ka diya kaam pehle                                                                                                                                  |
| Fresh customer rule | `status = ACTIVE`, `last_called_at IS NULL`, koi open assignment nahi; `priority DESC, created_at ASC`                           | Dobara call = follow-up (Phase 3), random recall nahi                                                                                                       |
| Concurrency (1)     | `SELECT ... FOR UPDATE SKIP LOCKED`                                                                                              | Ek saath maangne wale assistants ko alag rows milti hain, koi wait nahi                                                                                     |
| Concurrency (2)     | Unique nullable columns `open_customer_id`, `in_progress_staff_id`                                                               | **DB-level guarantee**: ek customer = ek open assignment; ek staff = ek current. Prisma 7 partial indexes support nahi karta — ye trick fully supported hai |
| Double click        | Unique violation (P2002) pakad ke existing current return                                                                        | Idempotent "Start Calling"                                                                                                                                  |
| Save & Next         | Ek transaction: assignment lock → validate → call insert → customer update → assignment COMPLETED → audit. Phir (alag) next pull | Partial save kabhi nahi; next fail ho to bhi call safe                                                                                                      |
| Validation          | Pure function `validateCallForm` (backend) + same logic frontend me                                                              | Unit-testable; assistant ko turant feedback; asli check backend                                                                                             |
| Manual assignment   | Manager: kisi ko bhi; Team Leader: sirf apni team; ACTIVE customers only                                                         | Design doc section 9 + 13                                                                                                                                   |
| Reassign / cancel   | Purana `CANCELLED` + naya `ASSIGNED` (ek transaction, row lock)                                                                  | History bachi rahe; assistant ka Save 409 deta hai aur screen refresh                                                                                       |
| Assistant access    | Profile sirf apne current/assigned customer ka                                                                                   | "Permitted user history"                                                                                                                                    |
| E2E tests           | Files sequentially (`fileParallelism: false`)                                                                                    | Engine "koi bhi eligible customer" uthata hai — shared DB pe parallel files clash karti                                                                     |

## Future

- Follow-ups (Phase 3) engine ki queue me "due follow-ups" pehle aayenge
- Campaign/team-based eligibility (Phase 5)
- Load-based / round-robin push option agar business maange
