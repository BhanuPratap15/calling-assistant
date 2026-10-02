# ADR 0003 — Authentication & Authorization

- **Status:** Accepted
- **Date:** 2026-10-02

## Decisions

| Topic                | Decision                                                                  | Reason                                                                   |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Login method         | Email + password → **JWT access token**                                   | Simple, stateless, frontend/mobile dono ke liye standard                 |
| Token lifetime       | `JWT_EXPIRES_IN` (default `8h` = ek shift)                                | Shift ke beech logout na ho; refresh token baad me (Phase 9)             |
| Password hashing     | **bcryptjs**, cost 12                                                     | Pure JS — Windows pe native build ki problem nahi; industry standard     |
| Default access       | **Secure by default**: global `JwtAuthGuard`, khule routes pe `@Public()` | Naya route banake guard lagana bhoolne ka risk khatam                    |
| Roles                | Global `RolesGuard` + `@Roles(...)`; SUPER_ADMIN har jagah allowed        | Design doc section 13                                                    |
| Per-request DB check | Guard har request pe staff ko DB se laata hai (`isActive`, latest `role`) | Deactivate/role change **turant** effect kare, token expire ka wait nahi |
| Library              | Nest ka `@nestjs/jwt` seedha (Passport nahi)                              | Kam magic, code padh ke samajh aata hai                                  |
| Errors               | Login fail pe ek hi message "Invalid email or password"                   | Attacker ko pata na chale kaunsa email exist karta hai                   |

## Future

- Refresh tokens + logout (token revoke)
- Password change / reset flow
- Login rate limiting (brute-force protection) — Phase 9
- Login/logout audit log (Step 1.6)
