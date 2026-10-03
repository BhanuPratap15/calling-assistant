# ADR 0006 — Configurable Call Form (outcomes, next actions, mandatory fields)

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Design doc section 6/7/22: call outcomes, next actions aur mandatory fields **hard-code nahi** hone chahiye.
Company ki final list abhi pending hai (section 27) — isliye defaults ke saath shuru, baad me Settings se badlo.

## Decisions

| Topic                   | Decision                                                                      | Reason                                                           |
| ----------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Outcomes / next actions | Alag DB tables (`call_outcomes`, `next_actions`)                              | Manager UI se add/rename/deactivate; reports `code` se           |
| `code` vs `label`       | `code` (UPPER_SNAKE) kabhi nahi badalta; `label` badal sakte hain             | Rename karne se purani reports/integrations na tootein           |
| Delete                  | Nahi — `is_active = false`                                                    | Purani calls jis outcome se judi hain wo record bacha rahe       |
| Outcome flag            | `is_connected`                                                                | "No Answer" pe notes/rating maangna bekaar — rules isi flag pe   |
| Next action flag        | `requires_follow_up`                                                          | True → follow-up date/time mandatory (doc section 7)             |
| Mandatory fields        | `system_settings` JSON: har field ka rule `always` / `connected` / `optional` | Flexible, ek row; naye fields aage add ho sakte                  |
| Always required         | Outcome + Next Action (configurable nahi)                                     | Inke bina call record ka matlab hi nahi                          |
| Defaults                | **Data migration** (`INSERT ... ON CONFLICT DO NOTHING`)                      | Har environment (local, CI, prod) me same defaults automatically |
| Audit                   | Har create/update/setting change audit log me                                 | Kisne rule badla, pata rahe                                      |

## Default values

- **Outcomes:** Connected, Interested, Not Interested (connected) · No Answer, Busy, Switched Off, Wrong Number (not connected)
- **Next actions:** No Further Action, Follow-up ⏰, Call Again ⏰, Send Information, Escalate (⏰ = date/time required)
- **Mandatory:** User Response, Notes, Interest Rating → "required only when connected"
