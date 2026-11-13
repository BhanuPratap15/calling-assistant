# White-label platform (CRM as a service)

Ek hi server pe kai clients. Har client ka **apna brand, theme, domain, dialer aur data**. Aap **Platform panel**
(`/platform`) se client banate ho — baaki sab automatic.

> Design / reasons: [ADR 0016](decisions/0016-multi-tenant-white-label.md)

## Kaun kya dekhta hai

| Kaun                       | Kahan                               | Kya                                                                                  |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| **Aap (platform admin)**   | `https://<main domain>/platform`    | Saare clients, naya client, branding, domains, dialer, plan, client admins, activity |
| **Client ka Super Admin**  | Client ka domain (`crm.client.com`) | Apna CRM — staff, teams, settings… (sirf apna data; platform panel nahi)             |
| **Client ke callers / TL** | Client ka domain                    | Normal CRM, client ke brand me                                                       |

Data har client ka alag hai — ek client ka customer / staff / report doosre client ko kabhi nahi dikhta (API level
pe enforced, tests: `apps/api/test/platform-tenancy.e2e-spec.ts`).

## Naya client — step by step

1. **Platform → New client**
   - Company name + **slug** (e.g. `sunrise`) → free address `sunrise.<PLATFORM_BASE_DOMAIN>`
   - Client ka apna domain (optional, baad me bhi): `crm.sunriserealty.com`
   - **Branding**: brand name, tagline, logo, favicon, theme colour (13 presets ya koi bhi custom rang), sidebar
     (dark / light / brand colour), login page (split / centered), support email / phone — right side **live preview**
   - **Dialer**: _Our dialer_ (integrated) / _Client's own dialer panel_ (link) / _Mobile (tel:)_
   - **Plan**: label + max active users
   - **First admin**: naam + email (password khaali = system banata hai)
2. **Create** → login details **ek hi baar** dikhte hain → "Copy message for the client" → WhatsApp / email.
   Admin pehle login pe apna password set karta hai.
3. **DNS** (client karta hai, apne domain provider pe) — Domains tab me exact record dikhta hai:
   - Sub-domain (`crm.client.com`): **CNAME** → `PLATFORM_CNAME_TARGET`
   - Root domain: **A** → `PLATFORM_SERVER_IP`
4. **SSL** automatic: DNS sahi hote hi ~1 minute me `ops/platform/sync-domains.sh` certificate bana deti hai,
   status **Live (HTTPS)** ho jaata hai. "Check DNS" se turant dekh sakte ho.

Baad me: branding / dialer / plan kabhi bhi badlo (client ko agle page load pe dikhta hai). **Suspend** = client ke
sab users bahar, login band, data safe. **Activate** = wapas chalu. Admin password bhool gaya → Admins tab →
Reset password.

## Server setup (ek baar)

`.env.production` me (dekho `.env.production.example`):

| Variable                            | Kya                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `PLATFORM_ADMIN_EMAIL` / `PASSWORD` | Platform panel ka pehla login (seed). Baaki admins panel → Platform team se              |
| `PLATFORM_BASE_DOMAIN`              | e.g. `crm.yourcompany.com` → clients ko `<slug>.crm.yourcompany.com` (wildcard DNS)      |
| `PLATFORM_SERVER_IP`                | Server ka public IP (DNS check + client ko dikhane ke liye)                              |
| `PLATFORM_CNAME_TARGET`             | Client sub-domains ka CNAME target (default `app.<base>`)                                |
| `PLATFORM_SYNC_TOKEN`               | Sync script ↔ API (`openssl rand -hex 32`)                                               |
| `LETSENCRYPT_EMAIL`                 | Certificates ka email                                                                    |
| `PLATFORM_HOSTS`                    | `/platform` sirf in hosts pe (optional, e.g. main domain)                                |
| `TENANT_FALLBACK_SLUG`              | Anjaan address → is client (default `default` = purana data). Sab set ho jaaye to khaali |

```bash
# deploy (memory / DEPLOYMENT.md wale steps) — migration khud chalti hai, purana data "default" client (Addaplay) me
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npx prisma db seed  # platform admin
sudo ./ops/nginx/install-host-nginx.sh      # naya nginx config (port 80 sab domains ke liye + snippet)
sudo crontab -e
# * * * * * /root/calling-assistant/ops/platform/sync-domains.sh >> /var/log/crm-domains.log 2>&1
```

**Purana (Addaplay) domain:** Platform → Addaplay → Domains → apna current domain add karo (sync script ise
`SERVER_NAME` pehchaan ke turant Live mark karti hai). Uske baad `TENANT_FALLBACK_SLUG=` (khaali) kar sakte ho.

**Sub-domains ke liye wildcard DNS** (optional): `*.crm.yourcompany.com A <server IP>` — har naye client ka
`<slug>.crm.yourcompany.com` apne aap point karega; certificate sync script har sub-domain ke liye alag banati hai.

## Local development

```bash
# .env: PLATFORM_BASE_DOMAIN=localhost, PLATFORM_ADMIN_EMAIL / PASSWORD (dekho .env.example)
npm run db:migrate && npm run db:seed
npm run dev:api & npm run dev:web
```

- Platform panel: http://localhost:3000/platform
- Default client: http://localhost:3000
- Naya client (slug `sunrise`): http://sunrise.localhost:3000 (Chrome / Firefox `*.localhost` khud resolve karte hain)

## Code map

| Kya                     | Kahan                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| Tenant context + filter | `apps/api/src/tenancy/` (context, extension, middleware, resolver)     |
| Platform API            | `apps/api/src/platform/` (`/api/platform/*`)                           |
| Public branding         | `GET /api/branding` (host se)                                          |
| Theme / branding (web)  | `apps/web/src/lib/theme.ts`, `lib/branding*.ts`, root `app/layout.tsx` |
| Platform UI             | `apps/web/src/app/platform/`, `components/platform/`                   |
| Domains SSL             | `ops/platform/sync-domains.sh`, `ops/nginx/tenant.conf.template`       |

**Naya feature banate waqt:** naya tenant table → `organizationId` + `tenancy/tenant-extension.ts` ke `TENANT_MODELS`
me naam. Raw SQL → `organization_id = ${currentOrgId()}`. Background job → `runInOrg(orgId, …)`.
