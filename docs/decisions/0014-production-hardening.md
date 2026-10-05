# ADR 0014 — Production hardening

- **Status:** Accepted (hosting provider / domain: business decision pending — setup kisi bhi Docker wale Linux VPS pe chalta hai)
- **Date:** 2026-10-05

## Context

Design doc section 25 (Phase 9): security, deployment, backups, monitoring, load test, UAT.
Team chhoti hai (6–20 assistants, 20k+ customers) — ek server (VPS) kaafi hai; Kubernetes jaisi complexity nahi chahiye.

## Decisions

### Security

| Topic                          | Decision                                                                                                                   | Reason                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Login brute force              | Per IP + email: 5 galat / 15 min → 429 (sahi password bhi nahi chalta); per IP: 30 galat / 15 min (password spraying)      | Email exist kare ya na kare same behaviour — account enumeration nahi         |
| Global rate limit              | `@nestjs/throttler`: `RATE_LIMIT_PER_MIN` per IP (default 3000 — poora office ek NAT IP); Nginx: login 20/min, API 50/s    | Flood / script se bachav, asli users pe asar nahi                             |
| Token revoke                   | `staff.tokenVersion` JWT me (`ver`): logout, password change, manager reset, deactivate → version++ → purane tokens 401    | Stateless JWT ka kami: chura / copy token logout ke baad bhi chal jaata       |
| Forced password change         | `mustChangePassword`: manager ne banaya / reset kiya, seed admin → sirf `me` + `change-password` (baaki 403)               | Manager ko staff ka password pata na rahe; default seed password live na rahe |
| Refresh tokens                 | **Nahi** (8h access token = ek shift). Revoke version se                                                                   | Ek device per assistant; complexity kam                                       |
| Self-service "forgot password" | **Nahi** (email service nahi) → manager reset + forced change                                                              | Internal tool; manager available hai                                          |
| Headers                        | API: `helmet` (HSTS, nosniff, frame, no X-Powered-By). Web: Nginx (HSTS, CSP, X-Frame-Options DENY, Referrer, Permissions) | Browser-level attacks (clickjacking, sniffing) band                           |
| Real client IP                 | `TRUST_PROXY=1` sirf Nginx ke peeche; bina proxy `X-Forwarded-For` ignore                                                  | Fake header se rate limit bypass nahi                                         |
| Cookies                        | httpOnly + SameSite=Lax + `Secure` (production / `COOKIE_SECURE`)                                                          | XSS / CSRF / sniffing                                                         |

### Deployment

| Topic      | Decision                                                                                                              | Reason                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Packaging  | Docker multi-stage: API (build → migrate → runtime ~250MB deps), Web (Next.js `standalone` ~45MB)                     | Har jagah same; chhote images                           |
| Stack      | `docker-compose.prod.yml`: nginx (sirf 80/443 bahar), web, api, migrate (one-off), postgres, redis (password), backup | Ek command se poora system; DB / Redis internet pe nahi |
| Migrations | Alag `migrate` container har deploy pe pehle; fail → API start nahi                                                   | Half-migrated DB pe app nahi chalta                     |
| HTTPS      | Nginx + Let's Encrypt (certbot webroot), HTTP → HTTPS                                                                 | Free, auto-renew                                        |
| CI         | Har push: poora prod stack Docker me build + smoke test (`ops/smoke/prod-stack-smoke.sh`)                             | Dockerfile / nginx / compose ki galti merge se pehle    |
| CD         | GitHub Actions "Deploy": images → GHCR (`:<git sha>`), SSH → pull → migrate → up → health check `version == sha`      | Repeatable; rollback = purana sha deploy                |
| Approval   | `environment: production` (GitHub me required reviewers)                                                              | Galti se deploy nahi                                    |

### Operations

| Topic   | Decision                                                                                                   | Reason                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Backups | `pg_dump -Fc` har 24h, verify (`pg_restore --list`), 14 din retention, `.last_success` marker              | Restore tested (20,035 customers same); off-site copy: RUNBOOK |
| Logs    | `LOG_FORMAT=json` + har request ek line (method, path **bina query**, status, ms, user, request id)        | Search aasaan; query me PII (naam / phone) log nahi            |
| Health  | `/api/health`: database + scheduler + version + uptime; DB down → **503**                                  | Docker / uptime monitor / deploy check                         |
| Alerts  | `ops/monitoring/check.sh` (cron 5 min): API / DB / scheduler / backup age → webhook (Slack / Chat / Teams) | Bina extra service ke; baad me Uptime Kuma / Grafana           |

### Load test (9.5)

`ops/load-test/load-test.mjs`: 20k customers, assistants bina ruke (stress). Dev machine (single API process):

| Assistants | Calls | Errors | Duplicates | Save & Next p95 | Throughput   |
| ---------- | ----- | ------ | ---------- | --------------- | ------------ |
| 10         | 400   | 0      | 0          | 400 ms          | 34.6 calls/s |
| 20         | 600   | 0      | 0          | 551 ms          | 38.8 calls/s |

Asli load: 20 assistants × ~1 call/min ≈ 0.33 calls/s → **~100× headroom**.

**Load test me mila bug (fixed):** bahut assistants ek hi pal me queue ka pehla customer maangein to unique
constraint duplicate rokta tha (data safe), par engine 3 retry ke baad galti se "koi customer nahi" bol deta tha.
Fix: 10 retries + random jitter. Regression test: `test/engine-contention.e2e-spec.ts` (12 assistants × 5 rounds).

## Consequences

- Ek server = single point of failure; backups + restore drill + monitoring zaroori (RUNBOOK). Zaroorat pade to
  managed Postgres + 2 API containers (login limiter / throttler ke liye Redis store chahiye hoga).
- Login limiter memory me hai → API restart pe reset (acceptable; Nginx limit bhi hai).

## Future

- Off-site backups (S3 / Backblaze) automatic, point-in-time recovery (WAL archiving)
- Grafana / Loki dashboards, error tracking (Sentry)
- 2FA for managers, IP allow-list for admin
- Old `import_rows` / `call_events` retention cleanup job
