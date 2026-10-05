#!/bin/sh
# =====================================================================
# Poora PRODUCTION stack (docker-compose.prod.yml) local Docker me chala ke check karo:
#   ./ops/smoke/prod-stack-smoke.sh            (CI har push pe yahi chalata hai)
# Self-signed certificate + test secrets — asli server ke liye docs/DEPLOYMENT.md
# =====================================================================
set -eu
cd "$(dirname "$0")/../.."
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.smoke"
fail() { echo "❌ $*"; $COMPOSE ps -a; $COMPOSE logs --tail=80; exit 1; }
ok() { echo "✅ $*"; }

# 1) Test config + self-signed cert (localhost)
sed -e 's/^SERVER_NAME=.*/SERVER_NAME=localhost/' \
    -e 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=smokepg123/' \
    -e 's/^REDIS_PASSWORD=.*/REDIS_PASSWORD=smokeredis123/' \
    -e 's/^JWT_SECRET=.*/JWT_SECRET=smoke-only-secret-0123456789abcdef0123456789/' \
    -e 's/^SEED_ADMIN_EMAIL=.*/SEED_ADMIN_EMAIL=admin@smoke.local/' \
    -e 's/^SEED_ADMIN_PASSWORD=.*/SEED_ADMIN_PASSWORD=Smoke@12345/' \
    -e 's#^CERTS_DIR=.*#CERTS_DIR=./.smoke-certs#' \
    -e 's#^BACKUP_DIR=.*#BACKUP_DIR=./.smoke-backups#' \
    .env.production.example > .env.smoke
mkdir -p .smoke-certs .smoke-backups
openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost" \
  -keyout .smoke-certs/privkey.pem -out .smoke-certs/fullchain.pem 2>/dev/null
chmod 644 .smoke-certs/*.pem

# 2) Build + start (migrate pehle, phir api → web → nginx; healthchecks ke saath)
$COMPOSE up -d --build || fail "compose up"
for i in $(seq 1 90); do
  curl -ksf https://localhost/api/health > /tmp/health.json 2>/dev/null && break
  sleep 2
done
grep -q '"database":"up"' /tmp/health.json || fail "health: database not up"
grep -q '"scheduler":"up"' /tmp/health.json || fail "health: scheduler not up"
ok "HTTPS health: $(cat /tmp/health.json)"

# 3) HTTP → HTTPS redirect, security headers, web page
code=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost/login)
[ "$code" = "301 https://localhost/login" ] || fail "http redirect: $code"
ok "HTTP → HTTPS redirect"
headers=$(curl -ksI https://localhost/login)
for h in "strict-transport-security" "content-security-policy" "x-frame-options: DENY" "x-content-type-options: nosniff"; do
  echo "$headers" | grep -qi "$h" || fail "missing header: $h"
done
echo "$headers" | grep -qi "x-powered-by" && fail "X-Powered-By leaked"
echo "$headers" | grep -qi "^HTTP/.* 200" || fail "web /login not 200"
ok "Web /login 200 + security headers"

# 4) Seed admin → login (secure cookie) → password change forced
$COMPOSE run --rm migrate npx prisma db seed > /dev/null || fail "seed"
login=$(curl -ks -c /tmp/smoke.cookies -H 'Content-Type: application/json' \
  -d '{"email":"admin@smoke.local","password":"Smoke@12345"}' https://localhost/api/auth/login)
echo "$login" | grep -q '"mustChangePassword":true' || fail "login: $login"
grep -q 'access_token' /tmp/smoke.cookies || fail "no login cookie"
code=$(curl -ks -o /dev/null -w '%{http_code}' -b /tmp/smoke.cookies https://localhost/api/customers)
[ "$code" = "403" ] || fail "must-change-password not enforced ($code)"
code=$(curl -ks -o /dev/null -w '%{http_code}' -b /tmp/smoke.cookies -c /tmp/smoke.cookies -H 'Content-Type: application/json' \
  -d '{"currentPassword":"Smoke@12345","newPassword":"Changed@12345"}' https://localhost/api/auth/change-password)
[ "$code" = "200" ] || fail "change password ($code)"
code=$(curl -ks -o /dev/null -w '%{http_code}' -b /tmp/smoke.cookies https://localhost/api/customers)
[ "$code" = "200" ] || fail "after password change ($code)"
ok "Login (secure cookie) + forced password change"

# 5) Nginx login rate limit (20/min + burst) → 429
codes=""
for i in $(seq 1 45); do
  codes="$codes $(curl -ks -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
    -d '{"email":"nobody@smoke.local","password":"x"}' https://localhost/api/auth/login)"
done
echo "$codes" | grep -q 429 || fail "no 429 from login rate limit: $codes"
ok "Login rate limit → 429"

# 6) Backup ek baar chala ke file check
$COMPOSE exec -T backup sh /scripts/backup.sh > /dev/null || fail "backup"
ls .smoke-backups/crm-*.dump > /dev/null 2>&1 || fail "no backup file"
ok "Backup: $(ls .smoke-backups/crm-*.dump | head -1)"

# 7) JSON logs (production)
$COMPOSE logs api 2>/dev/null | grep -q '"level":"log"' || fail "api logs not JSON"
ok "API logs are JSON"

docker image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep calling-crm || true
if [ "${KEEP_STACK:-}" != "1" ]; then
  $COMPOSE down -v > /dev/null
  rm -rf .smoke-certs .smoke-backups .env.smoke
fi
echo "🎉 Production stack smoke test passed"
