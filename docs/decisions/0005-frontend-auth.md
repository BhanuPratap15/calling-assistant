# ADR 0005 — Frontend Authentication & API Access

- **Status:** Accepted
- **Date:** 2026-10-03

## Decisions

| Topic                        | Decision                                                                                 | Reason                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Token storage (browser)      | **httpOnly cookie** `access_token` (backend set karta hai)                               | JavaScript cookie padh nahi sakti → XSS se token chori nahi. `localStorage` me ye protection nahi |
| CSRF                         | Cookie `SameSite=Lax` + JSON API                                                         | Doosri site se aayi POST request ke saath cookie nahi jaati                                       |
| HTTPS                        | Production me cookie `Secure` (`NODE_ENV=production`)                                    | Token sirf encrypted connection pe                                                                |
| API access                   | Next.js **rewrites**: browser `/api/*` → backend `API_URL/api/*`                         | Same origin → CORS nahi, cookie first-party. Production me Nginx same kaam karega                 |
| API tools (api.http, mobile) | `Authorization: Bearer` header bhi chalta rahega                                         | Login response body me `accessToken` abhi bhi aata hai                                            |
| Route protection             | `proxy.ts` (Next 16 ka naya "middleware") — sirf cookie hai/nahi ka **optimistic** check | Fast redirect. **Asli** check hamesha backend guard karta hai                                     |
| Stale cookie                 | `/auth/me` 401 → `/auth/logout` call karke cookie saaf                                   | Proxy ↔ login redirect loop se bachav                                                             |
| Menu / page access           | `lib/navigation.ts` me role-wise config                                                  | Ek jagah se menu control. Sirf UI convenience — security backend `@Roles()` me                    |
| Open redirect                | Login ke baad `?next=` sirf `/...` (apne app ke) paths                                   | Attacker kisi bahar ki site pe redirect na kara sake                                              |

## Future

- Login response body se `accessToken` hatana (sirf cookie) jab api.http/mobile ke liye alag flow ho
- Refresh token + "remember me" — Phase 9
