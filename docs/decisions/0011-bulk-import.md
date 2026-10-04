# ADR 0011 — Bulk Import (CSV / Excel)

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

Design doc section 16: 20,000 users ek controlled batch me import hone chahiye.
Flow: **upload → validation → duplicate detection → preview → confirm → background import → result**.
Import history rakhni hai (kisne, kab, kitne, kitne fail), aur bada import admin UI ko hang na kare.

## Decisions

| Topic              | Decision                                                                                                                                | Reason                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Formats            | `.csv` (`csv-parse`) + `.xlsx` (`exceljs`, pehli sheet). `.xls` (purana binary) nahi                                                    | Excel "Save as CSV / xlsx" dono aam; maintained libraries                  |
| Limits             | File max **10 MB**, max **50,000 rows**                                                                                                 | 20k comfortably; memory / zip-bomb risk limited                            |
| Columns            | `name`, `phone` required; `alternate_phone`, `email`, `external_id`, `priority`, `notes` optional. Header **aliases** ("Mobile No")     | Business ki existing Excel bina badle chal jaaye                           |
| Extra columns      | Ignore + preview me dikhao ("City ignore hua")                                                                                          | Silent data loss nahi                                                      |
| Validation         | Pure `validateRow` / `checkRows` (unit tests) — same phone normalize (E.164) jo manual add me                                           | Ek hi rule har jagah                                                       |
| Duplicates         | Same phone / externalId **file me** (pehli line jeetti hai) ya **DB me pehle se** → `DUPLICATE`, import nahi. Update-existing nahi (V1) | Galti se purana data overwrite na ho                                       |
| Preview storage    | `import_batches` + `import_rows` (raw + normalized data + status + errors) — preview hi DB me                                           | Confirm pe file dobara upload nahi; history + error report isi se          |
| Preview speed      | Sync request: parse + validate + DB lookup (5000 ke chunks) + rows insert (1000 ke chunks) ek transaction me                            | 20k ≈ 5 sec; simple; aadha-adhura preview nahi                             |
| Background import  | Confirm → `QUEUED` → BullMQ queue `imports` (concurrency 1) → `processBatch`                                                            | UI responsive; restart-safe                                                |
| Chunks             | 1000 rows / transaction: `createManyAndReturn(skipDuplicates)` + rows ka status ek `UPDATE … FROM unnest()` se                          | 20k ≈ 5 sec; har chunk atomic; 20k alag queries nahi                       |
| Idempotent         | Sirf `VALID` rows uthata hai → crash / retry pe wahin se aage, duplicate customer nahi                                                  | Safe retry                                                                 |
| Race after preview | Preview ke baad kisi ne same phone add kiya → `skipDuplicates` → row `SKIPPED`                                                          | Unique constraint DB pe — kabhi duplicate customer nahi                    |
| Recovery           | API start pe `QUEUED` / `PROCESSING` batches dobara queue (jobId = batchId → BullMQ duplicate job nahi)                                 | Server restart me import "atka" nahi rehta                                 |
| No Redis           | `SCHEDULER_ENABLED=false` (tests) → same process me `setImmediate`                                                                      | Tests ko Redis nahi chahiye                                                |
| Failure            | `FAILED` + error + notification; **Retry** button (`FAILED → QUEUED`)                                                                   | Manager ko pata chale, data loss nahi                                      |
| Confirm options    | Optional `campaignId` (COMPLETED nahi) + `tagId` (active) → naye customers seedhe campaign / tag me                                     | "New Users" campaign ek step me                                            |
| Error report       | `GET /imports/:id/problems.csv` — template wale columns + `row, status, problem`; UTF-8 BOM; formula injection se bachav                | Theek karke wahi file dobara upload                                        |
| Audit              | Batch level: `import.previewed / confirmed / completed / failed / cancelled` (20k alag `customer.created` nahi)                         | Audit log useful rahe; har customer ka `createdBy` + `import_rows` me link |
| Notifications      | `IMPORT_COMPLETED` / `IMPORT_FAILED` importer ko                                                                                        | Design doc 18: "import completion"                                         |
| Permissions        | Sirf MANAGER (+ SUPER_ADMIN)                                                                                                            | Bulk data change                                                           |

## Measured

Local (e2e test `20,000 rows`): preview + import **~10 sec total**. Browser me (BullMQ path): preview ~5 sec, import ~8 sec (2s polling ke saath).

## Known trade-offs

- `exceljs` ki dependency `uuid` pe ek moderate advisory hai (sirf v3/v5/v6 + buffer argument; exceljs v4 use karta hai) — 10 MB limit ke saath acceptable. Alternative library aaye to `import-parser.ts` hi badlega.
- Preview batches (cancel na kiye) DB me rehte hain — Phase 9 me purane `PREVIEW` / `CANCELLED` rows ki cleanup job.

## Future

- "Update existing customers" mode (match by phone / externalId)
- Column mapping UI (koi bhi header → field)
- Import ke saath custom fields / categories
- Purane import rows auto-cleanup (retention)
