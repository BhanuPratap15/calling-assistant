# Runbook — production me kuch ho to kya karein

Sab commands server pe `/opt/calling-crm` se. Short form:

```bash
alias crm='docker compose -f /opt/calling-crm/docker-compose.prod.yml --env-file /opt/calling-crm/.env.production'
```

## Roz / hafte ka kaam

| Kab    | Kya                         | Kaise                                                           |
| ------ | --------------------------- | --------------------------------------------------------------- |
| Roz    | Monitoring alerts dekho     | `tail /var/log/crm-check.log` (OK lines)                        |
| Roz    | Backup bana?                | `cat backups/.last_success` (aaj ki date)                       |
| Hafte  | Disk space                  | `df -h /` (80% se upar → purane backups / logs)                 |
| Mahina | **Restore drill** (staging) | Neeche                                                          |
| Mahina | Updates                     | `sudo apt upgrade` + `crm pull && crm up -d` (security patches) |

## Logs

```bash
crm ps                              # kaun up / healthy
crm logs -f --tail=100 api          # JSON lines: {"level":"log","context":"HTTP","message":"POST /api/calling/complete 200 34.1ms user=… req=…"}
crm logs api | grep '"level":"error"'
crm logs api | grep 'req=<request-id>'   # user ne error screenshot bheja → response header X-Request-Id
```

Logs me query string / passwords / phone **nahi** jaate (sirf path + status + user id).

## Incidents

### Website nahi khul rahi

1. `crm ps` — kaun sa container `unhealthy` / `exited`?
2. `curl -sk https://localhost/api/health` — `database` / `scheduler` kya bol raha hai?
3. Nginx: `crm logs --tail=50 nginx` (certificate expire? `openssl x509 -enddate -noout -in ops/certs/fullchain.pem`)
4. Restart: `crm restart api web nginx`

### `"database":"down"` (health 503)

`crm logs --tail=100 postgres` → disk full? (`df -h`) → jagah banao → `crm restart postgres api`.

### `"scheduler":"down"` — follow-up reminders / escalation / import band

`crm logs --tail=50 redis` → `crm restart redis api`. Data safe hai (DB source of truth; restart pe atke imports apne aap dobara chalte hain).

### Import "Queued" pe atka

Scheduler / Redis check (upar). `crm restart api` — QUEUED / PROCESSING imports khud re-queue hote hain.

### Kisi assistant ko "Too many failed login attempts"

5 galat password → 15 min lock (us IP + email). Wait karein, ya manager **password reset** kare (Staff → Reset password) aur 15 min baad login.

### Account chori / password leak ka shak

- Ek user: manager **Reset password** (uske saare sessions turant khatam) ya **Deactivate**
- Sab users: `.env.production` me naya `JWT_SECRET` → `crm up -d api` (sab logout — sabko dobara login)
- Audit logs dekho: Audit Logs → filter `auth.login_failed` / us staff ke actions; exports: `report.exported`

### Galat deploy (naya version me bug)

Actions → Deploy → purana commit "Run workflow" — ya `IMAGE_TAG=<old sha> crm up -d`.
⚠ Agar naye version ka migration DB badal chuka hai to purana code shayad na chale → backup se restore (neeche) ya fix-forward.

## Restore drill

Backup tabhi kaam ka jab restore ho sake. **Staging / doosre server pe** mahine me ek baar:

```bash
ls -lh backups/                                   # latest crm-<time>.dump
./ops/backup/restore.sh backups/crm-<time>.dump   # 'restore' type karo — API band → restore → migrate → start
curl -sk https://localhost/api/health
# Login karke customers / calls count production jaisa? Date + count note karo.
```

Production pe restore (data loss incident) bhi yahi script — pehle **current** DB ka ek aur backup: `crm exec backup sh /scripts/backup.sh`.

## Scaling (jab zaroorat ho)

- Load test numbers: [ADR 0014](decisions/0014-production-hardening.md#load-test-95) (~100× headroom for 20 assistants)
- Pehle: bada server (vertical). Phir: managed Postgres + 2 API containers — tab login limiter / throttler ke liye Redis store chahiye (code change)
- Lakhs calls pe reports slow → daily rollup table / materialized view (ADR 0013 future)
