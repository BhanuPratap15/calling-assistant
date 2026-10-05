# Deployment guide — production server pe CRM chalana

Ek Linux server (VPS) + Docker. Saari services `docker-compose.prod.yml` me hain:

```
Internet ──► Nginx (80 → 443, HTTPS, security headers, rate limit)
               ├── /api/*  ──► api (NestJS)  ──► postgres (data)
               │                              └─► redis (scheduler, import queue)
               └── /*      ──► web (Next.js)
             migrate (har deploy pe pehle DB migrations) · backup (roz pg_dump → ./backups)
```

Bahar sirf **80 / 443** khulte hain — Postgres / Redis kabhi internet pe nahi. Decisions: [ADR 0014](decisions/0014-production-hardening.md).

---

## 1. Server

| Cheez     | Minimum (20 assistants, 20k–1 lakh customers)             |
| --------- | --------------------------------------------------------- |
| OS        | Ubuntu 24.04 LTS                                          |
| CPU / RAM | 2 vCPU / 4 GB                                             |
| Disk      | 40 GB SSD (DB + 14 din backups)                           |
| Domain    | e.g. `crm.yourcompany.com` → DNS **A record** = server IP |

```bash
# Firewall: sirf SSH + web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# Docker Engine + compose plugin (official script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # logout / login ke baad sudo bina docker chalega
docker compose version          # v2.x
```

## 2. Code

```bash
sudo mkdir -p /opt/calling-crm && sudo chown $USER /opt/calling-crm
git clone https://github.com/BhanuPratap15/calling-assistant.git /opt/calling-crm
cd /opt/calling-crm
```

## 3. Config (secrets)

```bash
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32   # har secret ke liye alag (POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET)
nano .env.production   # SERVER_NAME, passwords, SEED_ADMIN_*
```

Passwords me sirf letters + numbers (`openssl rand -hex` wala theek hai). `.env.production` **kabhi commit nahi**.

## 4. HTTPS certificate (Let's Encrypt, free)

Pehli baar (stack abhi band hai, port 80 free):

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d crm.yourcompany.com -m you@yourcompany.com --agree-tos \
  --deploy-hook /opt/calling-crm/ops/certs/install-cert.sh
ls ops/certs   # fullchain.pem  privkey.pem
```

Renewal (har ~60 din, automatic `certbot.timer`) ke liye webroot pe switch — stack chalte hue port 80 Nginx ke paas hai:

```bash
sudo certbot reconfigure --cert-name crm.yourcompany.com --webroot -w /opt/calling-crm/ops/certbot-www
sudo certbot renew --dry-run   # test
```

## 5. Pehli baar start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps     # sab "healthy" / migrate "exited (0)"
curl -s https://crm.yourcompany.com/api/health                             # "database":"up","scheduler":"up"

# Pehla Super Admin (.env.production ka SEED_ADMIN_*) — pehle login pe password badalna zaroori
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npx prisma db seed
```

Browser: `https://crm.yourcompany.com` → login → naya password → Settings / Staff / Import. Phir [UAT checklist](UAT-CHECKLIST.md).

> Tip: `alias crm='docker compose -f /opt/calling-crm/docker-compose.prod.yml --env-file /opt/calling-crm/.env.production'`
> → `crm ps`, `crm logs -f api`, `crm restart api`.

## 6. Monitoring + off-site backup (cron)

```bash
crontab -e
# Har 5 min health + backup check → problem pe webhook alert (.env.production me ALERT_WEBHOOK_URL=...)
*/5 * * * * cd /opt/calling-crm && ./ops/monitoring/check.sh >> /var/log/crm-check.log 2>&1
# Roz raat backups doosri jagah (rclone / aws s3 / scp — server khud kharab ho to bhi data bache)
30 3 * * * rclone copy /opt/calling-crm/backups remote:crm-backups --max-age 48h
```

`ALERT_WEBHOOK_URL`: Slack / Google Chat / Teams ka "incoming webhook" URL. Bahar se bhi ek uptime monitor (UptimeRobot / Better Stack free) `https://<domain>/api/health` pe lagao — server hi band ho to cron alert nahi bhej payega.

## 7. Automatic deploy (GitHub Actions)

Workflow: `.github/workflows/deploy.yml` → **Actions → Deploy → Run workflow** (ya `git tag v1.0.0 && git push --tags`).

1. Server pe deploy user ka SSH key: `ssh-keygen -t ed25519 -f deploy_key` → `deploy_key.pub` server ke `~/.ssh/authorized_keys` me
2. GitHub repo → **Settings → Secrets and variables → Actions**:
   `DEPLOY_HOST` (IP / domain), `DEPLOY_USER`, `DEPLOY_SSH_KEY` (private key), `DEPLOY_PATH` (`/opt/calling-crm`)
3. **Settings → Environments → production → Required reviewers** (deploy se pehle approval)
4. Server ko GHCR images pull karne do (private repo): GitHub PAT (scope `read:packages`) →
   `echo <PAT> | docker login ghcr.io -u <github-user> --password-stdin`

Deploy: images build → `ghcr.io/<owner>/calling-crm-{api,migrate,web}:<git sha>` → server pe `git checkout <sha>` →
`pull` → `migrate` → `up -d` (containers recreate — ~10–20 sec downtime, isliye deploy shift ke bahar) →
health check me `version` = naya sha. Naya version healthy na ho → workflow **red** → turant rollback (neeche, aur RUNBOOK).

**Rollback:** Actions → Deploy → purane commit pe "Run workflow" (ya server pe `IMAGE_TAG=<old sha> crm up -d`).

## 8. Manual update (CD ke bina)

```bash
cd /opt/calling-crm && git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Checklist — go-live se pehle

- [ ] `.env.production` me koi `CHANGE_ME` nahi; `chmod 600`
- [ ] HTTPS green lock; `http://` → `https://`
- [ ] Super Admin ne default password badal diya
- [ ] Backup ban raha hai + **restore drill** ([RUNBOOK](RUNBOOK.md#restore-drill)) staging pe
- [ ] Monitoring alert test (API band karke dekho)
- [ ] [UAT checklist](UAT-CHECKLIST.md) sign-off
- [ ] Load test staging pe (`node ops/load-test/load-test.mjs`, ADR 0014 numbers se compare)
