# ADR 0015 — Calling workflow completion (Phase 10)

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Phase 9 ke baad poore system ka test hua: saare automated checks, plus browser me design doc section 28 ki
"Complete Example Journey". Journey me import, campaign, Start Calling, follow-up, escalation, dashboard aur audit
sab sahi chale. Do cheezein saamne aayin:

1. **Asli bug (workflow):** "Save & Next" hamesha agla customer khol deta tha, aur assistant ke paas **rukne ka
   koi tareeka nahi tha**. Shift ke end me browser band → woh customer assistant ke naam pe **lock** reh jaata. Koi aur
   us customer ko call nahi kar sakta tha, aur sirf manager "Cancel" karke chhuda sakta tha.
2. **Design doc ke gaps:**
   - Section 9: round-robin / load-based assignment
   - Section 18: notifications "new assignment", "incomplete form", "campaign alerts"
   - Section 14: dashboard filters "This Week" / "This Month"

## Decisions

### 10.1 Save & Stop + Stop calling

| Topic          | Decision                                                                                                                                         | Reason                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Save & Stop    | `POST /calling/complete` me `stop: true` → call save, agla customer **nahi**, availability **BREAK**                                             | Break / shift end. BREAK isliye ki escalation aur auto-assign isse na dein                                   |
| Stop calling   | `POST /calling/release { note? }` → bina call record ke current chhodo                                                                           | Galti se khula / shift khatam / customer ka time nahi                                                        |
| Dial ke baad   | Agar is customer ko **dial ho chuka** (koi call session) → **409**, form save karna padega                                                       | Baat ya attempt hua hai to record zaroori ("No Answer" bhi outcome hai). Excel wali "data miss" problem nahi |
| Customer kahan | AUTO → wapas pool / campaign queue. MANUAL / DISTRIBUTED → wapas **usi assistant ki** ASSIGNED queue. FOLLOW_UP → follow-up PENDING (owner wahi) | Manager ka faisla mitta nahi. Follow-up ki zimmedari aur escalation same rehte hain                          |
| Anti-skip      | Chhoda gaya AUTO customer pool me apni jagah (priority / purana) pe rehta hai → agli baar wapas mil sakta hai                                    | "Mushkil customer skip karo" ka raasta nahi                                                                  |
| Audit          | `assignment.released` (reason, note, source, result) + `assignments.release_reason`                                                              | Manager dekh sake kaun kitna chhodta hai                                                                     |

### 10.2 Watchdog (scheduler ke har tick pe)

| Topic           | Decision                                                                                                                                                                          | Reason                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Setting         | `calling.workflow`: `incompleteFormMinutes` (default 15), `autoReleaseMinutes` (default 30, 0 = band) — Settings → Calling workflow                                               | Hard-code nahi (design doc section 22)                                              |
| Form incomplete | Current itni der se khula → assistant ko **ek** `FORM_INCOMPLETE` (marker `stale_notified_at`)                                                                                    | Design doc section 18                                                               |
| Auto-release    | Current `autoReleaseMinutes` se khula **aur** assistant away (BREAK / OFFLINE / heartbeat `presenceTimeout` se purana) **aur** live call nahi → release (reason `assistant_away`) | Browser band = lock hamesha ke liye nahi. Kaam karte assistant ko chheda nahi jaata |
| Kisko batana    | Assistant + uska Team Leader (TL khud ho / team nahi → managers), `ASSIGNMENT_AUTO_RELEASED`. Dial hua tha to message me "dialled Nx, form not saved"                             | Supervisor follow up kare                                                           |
| Safety          | Follow-up scheduler jaisa: DB source of truth, `FOR UPDATE SKIP LOCKED`, markers → idempotent, kai servers pe safe                                                                | ADR 0008 pattern                                                                    |

### 10.3 Bulk distribute (round-robin / load-based)

| Topic       | Decision                                                                                                                                                                                             | Reason                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| API         | `POST /assignments/distribute { staffIds, strategy, limit ≤ 2000, perStaffLimit?, campaignId?, categoryId?, tagId?, priority?, onlyFresh=true, dryRun }`                                             | Ek run = ek transaction. 20k customers ke liye 10 run                                           |
| Strategies  | `ROUND_ROBIN` (baari baari, sabko barabar naye), `LOAD_BASED` (har customer → abhi ke sabse kam open load wala). Pure function `planDistribution` + unit tests                                       | Design doc section 9. "Hybrid" = pull engine already load-based hai (jo free hai wahi leta hai) |
| Eligible    | ACTIVE, kisi ke paas open nahi, open follow-up nahi. Campaign diya → us campaign ke `call_count = 0`. Nahi diya → kisi chalu campaign me nahi (member restriction bypass na ho) + default sirf fresh | Engine ke same rules                                                                            |
| Concurrency | Rows `FOR UPDATE SKIP LOCKED` + `createManyAndReturn(skipDuplicates)` on unique `open_customer_id`                                                                                                   | Isi pal koi "Start Calling" kare to bhi duplicate nahi (DB guarantee)                           |
| Source      | Naya enum `DISTRIBUTED` (assignments list: "Distributed by X")                                                                                                                                       | Reports / audit me manual se alag                                                               |
| Scope       | Manager: koi bhi assistant / TL. TL: sirf apni team (403)                                                                                                                                            | ADR 0007 jaisa                                                                                  |
| UX          | Modal: assistants → strategy → filters → **Preview** (dryRun: open now / +new / after) → Distribute. Filter badla → preview reset                                                                    | Galti se 2000 galat logon ko na chale jaayein                                                   |
| Output      | Ek audit `assignment.distributed` (per-staff counts, filters) + har assistant ko **ek** `ASSIGNMENT_NEW` ("3 customers assigned to you")                                                             | 2000 notifications nahi                                                                         |

### 10.4 Notifications

- `ASSIGNMENT_NEW`: manual assign / reassign / distribute → assistant ko ("comes first when you press Start Calling").
- `CAMPAIGN_EXHAUSTED`: active campaign ke saare customers call ho gaye → creator + managers ko **ek baar**. Ye ek atomic
  `UPDATE campaigns … WHERE exhausted_notified_at IS NULL AND NOT EXISTS(pending) RETURNING` hai. Customers add ya
  import hone pe marker reset hota hai, isliye campaign dobara khatam ho to alert phir aata hai.
- Bell generic hai (title + link), isliye UI change nahi chahiye.

### 10.5 Report presets

- `week` = Monday se aaj tak (India time). Previous = pichhle hafte ke **wahi din**, taaki Mon–Wed vs pichhla Mon–Wed
  ho aur weekend beech me na aaye.
- `month` = 1 tareekh se aaj tak. Previous = pichhle mahine ki 1 tareekh se utne din. Mahina chhota ho to uske end tak
  (31 March → poora February).

## Consequences

- Assistant ke paas ab rukne ke do saaf raaste hain, aur dono audited hain. Customer kabhi permanently lock nahi rehta.
- Watchdog har 30 sec do chhoti indexed queries chalata hai (sirf `IN_PROGRESS` rows), jo load pe negligible hain.
- Released MANUAL / DISTRIBUTED customer usi assistant ki queue me rehta hai. Assistant chala gaya ho to manager ko
  "Reassign" karna padega. Auto-release notification usi ke liye hai.

## Future

- Assistant-wise "released without call" count reports me
- Distribute ka schedule (har subah 9 baje auto-distribute)
- Campaign end date aa gayi → auto-complete + alert
