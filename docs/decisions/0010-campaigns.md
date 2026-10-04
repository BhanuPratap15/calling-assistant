# ADR 0010 — Campaigns

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

Design doc section 11: manager ek **campaign** chalata hai ("Diwali Bonus", "VIP Reactivation") —
customers ka group + script + extra call-form fields, chuni hui teams / assistants ke liye, priority ke saath.
Assistant ke liye kuch nahi badalna chahiye: wahi **Start Calling → Save & Next**, bas campaign ka
customer aaye to script + extra fields dikhein.

## Decisions

| Topic             | Decision                                                                                                                                 | Reason                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Tables            | `campaigns`, `campaign_customers` (PK campaign+customer), `campaign_staff`, `campaign_teams`, `campaign_fields`                          | Ek customer kai campaigns me; join tables = many-to-many                   |
| Status            | State machine: `DRAFT → ACTIVE ↔ PAUSED → COMPLETED` (pure `canTransition`)                                                              | Galat jump (COMPLETED → ACTIVE) se reports kharab na hon                   |
| Date window       | Optional `startsAt` / `endsAt`; engine sirf window ke andar campaign uthata hai                                                          | "Sirf Diwali week" campaigns                                               |
| Adding customers  | IDs **ya filter** (category, tag, priority, never called, name) — sirf ACTIVE customers, `skipDuplicates`, `{ matched, added, skipped }` | 20k me se group chunna; Excel ki jagah                                     |
| Who calls         | Staff + teams list; **dono khaali = sab**                                                                                                | Simple default, restriction optional                                       |
| Engine order      | current → due follow-ups → manual queue → **campaign queue** → general pool                                                              | Promise (follow-up) aur manager ka kaam pehle; campaign general se pehle   |
| Campaign queue    | ACTIVE + window + member rule; customer: campaign me abhi call nahi hua, ACTIVE, open assignment nahi, open follow-up nahi               | Ek campaign me ek customer ek baar (re-engagement = naya campaign)         |
| Ordering          | Campaign `priority` DESC → customer priority DESC → `added_at`                                                                           | Design doc 9: priority-aware                                               |
| General pool      | Jo customer kisi **non-COMPLETED** campaign me hai wo general pool me nahi aata                                                          | Warna member restriction bypass ho jaati                                   |
| Race safety       | `FOR UPDATE OF cc SKIP LOCKED` + same customer do campaigns me → unique conflict pe retry (max 3)                                        | 5 assistants ek saath bhi duplicate nahi                                   |
| Custom fields     | `campaign_fields` (key snake_case, TEXT / NUMBER / SELECT / BOOLEAN, required, active); **key + type permanent**, hatana = deactivate    | Purani calls ka data isi key se padha jaata hai                            |
| Call storage      | `calls.campaign_id` + `calls.custom_fields` (JSONB, sirf validated values)                                                               | Har campaign ke alag columns nahi; reports campaign_id se                  |
| Validation        | Pure `validateFieldDefinitions` + `validateCustomFields` (unknown key / required / type) — Save & Next reject karta hai                  | Galat data DB me na jaaye; frontend `lib/campaign.ts` me copy (instant UX) |
| Progress          | `campaign_customers.call_count / last_called_at / last_outcome_id` (Save & Next me update)                                               | Progress bar + pending list fast (calls scan nahi)                         |
| Follow-up inherit | Follow-up call ka campaign = jis call me promise hua uska campaign                                                                       | Script / fields follow-up pe bhi dikhein                                   |
| Manual assign     | `POST /assignments` me optional `campaignId` (customer us campaign me ho, campaign COMPLETED na ho)                                      | Manager kisi campaign ke under specific customer de sake                   |
| Permissions       | Manager: sab; TL: read-only (list / detail / customers); Assistant: sirf calling screen pe                                               | Design doc roles                                                           |
| Audit             | `campaign.created / updated / members_updated / customers_added / customers_removed / fields_updated`                                    | Kisne kab kya badla                                                        |

## Consequences

- Assistant UI simple raha — koi "campaign chuno" step nahi; engine decide karta hai.
- Ek customer ek campaign me ek hi baar auto-call hota hai. Dobara chahiye → naya campaign (ya manual assign / follow-up).
- Completed campaign ke customers wapas general pool me aa jaate hain.

## Future

- Campaign reports + CSV export (Phase 8)
- Script me placeholders (`{name}`) auto-fill
- Campaign-wise re-attempt rules (No Answer → 2 ghante baad dobara)
