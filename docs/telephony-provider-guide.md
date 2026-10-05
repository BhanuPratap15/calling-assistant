# Calling provider guide (telecalling.ai jodna)

CRM ka telephony layer provider-independent hai ([ADR 0012](decisions/0012-calling-provider.md)).
Aaj do providers hain: `manual` (default, `tel:` link) aur `mock` (demo / test).
telecalling.ai jodne ke liye **sirf ek nayi class** chahiye — calling screen, history, webhooks ka baaki code same rahega.

## 1. telecalling.ai se ye poochhna hai

| #   | Sawaal                                                                                       | Kyun chahiye                                     |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | API docs + **sandbox / test account** milega?                                                | Bina real paise / real customers ke test         |
| 2   | Authentication: API key / token? Header ka naam?                                             | `TELECALLING_API_KEY` env                        |
| 3   | **Click-to-call API**: endpoint, body (agent number / extension, customer number)?           | `startCall()`                                    |
| 4   | Response me **call ID** aata hai? (webhooks me wahi ID?)                                     | `providerCallId` se events match                 |
| 5   | Agent kaise identify hota hai — mobile number, extension, user ID?                           | Staff table me field chahiye ho sakta hai        |
| 6   | **Webhooks**: kaunse events (ringing, answered, completed, no answer, busy)? Payload sample? | `parseWebhook()` mapping                         |
| 7   | Webhook **signature / secret** kaise verify karein? (HMAC? header naam?)                     | Security — bina iske webhook accept nahi karenge |
| 8   | **Recording URL** kab aata hai (completed ke saath ya alag event)? Link expire hota hai?     | History me "▶ Recording"                         |
| 9   | Duration seconds me milti hai?                                                               | Talk time reports                                |
| 10  | Webhook retry policy (kitni baar, kab tak)? Event ID unique hai?                             | Duplicate handling (`eventId`)                   |
| 11  | Rate limits? IP whitelist chahiye (hamare server ka)?                                        | Production config                                |

## 2. Code me kya karna hai

1. `apps/api/src/telephony/providers/telecalling.provider.ts` — `TelephonyProvider` implement karo:
   - `name = 'telecalling'`, `mode = 'api'`, `initialStatus = 'INITIATED'`
   - `startCall({ sessionId, to, agent })` → unka click-to-call API (`fetch`), return `{ providerCallId }`
   - `parseWebhook({ headers, rawBody, body })` → unka signature check (galat → `UnauthorizedException`),
     phir unke events ko `NormalizedCallEvent[]` me map (`type`: ringing / answered / completed / no_answer / busy / failed / canceled / recording)
2. `telephony.module.ts` → `createProvider()` me `case 'telecalling': return new TelecallingProvider(...)`
3. `.env.example` → `TELECALLING_API_KEY=`, `TELECALLING_BASE_URL=` (secrets **kabhi commit nahi**)
4. Tests: `telephony-rules.spec.ts` jaisa unit test (unke sample payloads se) + e2e me provider ka `fetch` mock
5. telecalling.ai dashboard me webhook URL: `https://<crm-domain>/api/telephony/webhooks/telecalling`

## 3. Local pe mock provider se demo

```bash
# .env
TELEPHONY_PROVIDER=mock
TELEPHONY_WEBHOOK_SECRET=koi-bhi-lamba-random-string
TELEPHONY_MOCK_AUTOPLAY=true
```

API restart → assistant **Start Calling** → **📞** dabao: Connecting → Ringing → Connected (timer) → Completed → ▶ Recording (~10 sec).
Number ka last digit **0** = No answer, **9** = Busy. Recording link nakli (`*.mock.invalid`) hai — sirf flow dikhane ke liye.

Webhook haath se bhejna (curl / script): `X-CRM-Timestamp` + `X-CRM-Signature: sha256=HMAC(secret, "<timestamp>.<body>")` — format [docs/API.md](API.md#calling-provider-telephony).
