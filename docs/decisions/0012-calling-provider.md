# ADR 0012 — Calling provider integration (telephony layer)

- **Status:** Accepted (telecalling.ai adapter pending — provider docs ka wait)
- **Date:** 2026-10-05

## Context

Design doc section 17: asli calling + recording existing tool **voice.telecalling.ai** karta hai; CRM uske upar
"control layer" hai — CRM se call lagana / kholna, aur call events (webhook) se history bharna.
"Exact API endpoints, authentication, call identifiers and webhooks confirm karne baaki hain."
Public docs nahi mile (aur is dev environment se site reachable nahi), isliye provider ka API **guess nahi** kiya.

## Decisions

| Topic            | Decision                                                                                                                             | Reason                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Adapter pattern  | `TelephonyProvider` interface: `startCall()` + `parseWebhook()`; Nest token `TELEPHONY_PROVIDER`, env `TELEPHONY_PROVIDER` se choose | Provider badalna = ek nayi class, CRM ka baaki code same              |
| Providers abhi   | `manual` (default: `tel:` link, attempt record) · `mock` (asli jaisa: call ID + signed webhooks + autoplay demo)                     | Aaj se kaam chale; poora flow end-to-end test ho                      |
| Galat config     | Unknown `TELEPHONY_PROVIDER` → app start hi nahi hota                                                                                | Silently galat provider pe chalna confusing                           |
| Data model       | `call_sessions` (ek dial attempt) + `call_events` (har webhook, raw payload)                                                         | Ek CRM call (form) ke kai attempts (No answer → alternate number)     |
| Dial rule        | Sirf apne **current** customer ko (`inProgressStaffId`); ek waqt ek live call (row lock + 409)                                       | Assignment engine ka "ek customer ek waqt" rule telephony me bhi      |
| Provider call    | DB transaction ke **bahar**; fail → session `FAILED` + 502                                                                           | Slow provider API pe DB lock na rahe                                  |
| Status machine   | Pure `applyEvent`: status sirf aage (rank), terminal final; recording / duration baad me bhi                                         | Webhooks out-of-order / late aate hain                                |
| Duplicates       | `call_events (provider, eventId)` unique + session row `FOR UPDATE`                                                                  | Provider retry = same event dobara; concurrent events serialize       |
| Unknown call ID  | 200 + `unknown` count (log)                                                                                                          | 4xx/5xx pe provider retry storm karta hai                             |
| Webhook security | `@Public` route + **HMAC-SHA256** over `timestamp.rawBody`, 5 min window, `timingSafeEqual`; `rawBody: true` (main.ts)               | Provider ke paas login token nahi; replay + tampering se bachav       |
| Recording link   | Sirf `https:` URLs save; UI me `target=_blank rel=noopener noreferrer`                                                               | `javascript:` link se XSS nahi                                        |
| CRM call link    | Save & Next transaction me us assignment ke attempts → `call_id`                                                                     | Profile history me duration + recording us call ke saath              |
| Outcome          | Provider ka result form **auto-fill nahi** karta — sirf hint ("Provider: No answer")                                                 | Assistant hi final outcome decide kare (design doc 6: assistant form) |
| Audit            | `call.dialed` (kisne, kis number pe, provider); webhooks `call_events` me (audit log me nahi — volume)                               | Traceable, audit log saaf                                             |
| UI polling       | Live call me har 2s; call khatam hone ke 2 min baad tak (recording ka wait)                                                          | WebSocket abhi zaroori nahi                                           |

## telecalling.ai adapter (jab docs milein)

Checklist + sawaal: [docs/telephony-provider-guide.md](../telephony-provider-guide.md). Kaam: `providers/telecalling.provider.ts`
(`startCall` = unka click-to-call API, `parseWebhook` = unka signature + payload → `NormalizedCallEvent`) + `telephony.module.ts` me ek `case` + e2e.

## Future

- Inbound calls (customer ne call kiya → CRM me customer khule)
- Recording proxy (provider link expire hota ho to CRM se signed stream)
- Agent ka softphone / WebRTC embed
- Call events se reports (talk time per assistant — Phase 8)
