#!/bin/sh
# =====================================================================
# White-label domains → SSL certificate + nginx server block. Platform panel me domain add
# karo, ye script (cron, har minute) baaki kaam karti hai:
#
#   1. API se saare client domains (hostname + status)
#   2. DNS is server pe nahi → status PENDING ("DNS not pointing here yet")
#   3. Certificate nahi → certbot (webroot, /var/www/certbot) → tenant-<host>.conf → nginx reload
#   4. Result API ko (ACTIVE / FAILED) → panel me dikhta hai
#   5. Panel se hata diya gaya domain → uska nginx conf hatao (certificate rehta hai)
#
# FAILED domains dobara tabhi try hote hain jab panel me "Retry SSL" dabao (Let's Encrypt limits).
#
# Setup (ek baar, root):
#   .env.production me PLATFORM_SYNC_TOKEN (32+ random) + PLATFORM_SERVER_IP + LETSENCRYPT_EMAIL
#   crontab -e →  * * * * * /root/calling-assistant/ops/platform/sync-domains.sh >> /var/log/crm-domains.log 2>&1
# =====================================================================
set -u
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$APP_DIR/.env.production"
API="${SYNC_API:-http://127.0.0.1:4000/api/platform/domain-sync}"
LOCK=/tmp/crm-sync-domains.lock

env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
TOKEN=$(env_value PLATFORM_SYNC_TOKEN)
SERVER_NAME=$(env_value SERVER_NAME)
SERVER_IPS=$(env_value PLATFORM_SERVER_IP | tr ',' ' ')
EMAIL=$(env_value LETSENCRYPT_EMAIL)
[ -n "$TOKEN" ] || { echo "PLATFORM_SYNC_TOKEN missing in $ENV_FILE"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "root chahiye (certbot + nginx)"; exit 1; }

# Ek waqt ek hi run (certbot dheema ho sakta hai)
if ! mkdir "$LOCK" 2>/dev/null; then exit 0; fi
trap 'rmdir "$LOCK"' EXIT

report() { # host status error
  body=$(printf '{"hostname":"%s","status":"%s","error":"%s"}' "$1" "$2" "$(printf '%s' "$3" | tr '"\n\\' "'  " | cut -c1-900)")
  curl -fsS -X POST "$API/report" -H "X-Sync-Token: $TOKEN" -H 'Content-Type: application/json' -d "$body" > /dev/null \
    || echo "report failed for $1"
}

points_here() { # host → 0 agar DNS kisi server IP pe
  [ -z "$SERVER_IPS" ] && return 0 # IP config nahi → check skip
  resolved=$(getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u)
  for ip in $SERVER_IPS; do
    echo "$resolved" | grep -qx "$ip" && return 0
  done
  return 1
}

LIST=$(curl -fsS "$API/domains" -H "X-Sync-Token: $TOKEN") || { echo "$(date -Is) API unreachable"; exit 1; }
CHANGED=0

echo "$LIST" | while read -r HOST STATUS; do
  [ -n "$HOST" ] || continue
  CONF="/etc/nginx/conf.d/tenant-$HOST.conf"
  CERT="/etc/letsencrypt/live/$HOST/fullchain.pem"

  # Main domain (SERVER_NAME) ka block pehle se crm.conf me hai
  if [ "$HOST" = "$SERVER_NAME" ]; then
    [ "$STATUS" = ACTIVE ] || report "$HOST" ACTIVE ""
    continue
  fi

  if [ -f "$CERT" ] && [ -f "$CONF" ]; then
    [ "$STATUS" = ACTIVE ] || report "$HOST" ACTIVE ""
    continue
  fi
  [ "$STATUS" = FAILED ] && continue # panel se "Retry SSL" ka wait

  if ! points_here "$HOST"; then
    report "$HOST" PENDING "DNS not pointing to this server yet (expected: $SERVER_IPS)"
    continue
  fi

  if [ ! -f "$CERT" ]; then
    echo "$(date -Is) issuing certificate for $HOST"
    if [ -n "$EMAIL" ]; then CONTACT="-m $EMAIL"; else CONTACT="--register-unsafely-without-email"; fi
    # shellcheck disable=SC2086 # CONTACT = 1-2 words, jaan-bujh ke split
    OUT=$(certbot certonly --webroot -w /var/www/certbot -d "$HOST" --non-interactive --agree-tos $CONTACT 2>&1)
    if [ ! -f "$CERT" ]; then
      echo "$OUT" | tail -5
      report "$HOST" FAILED "$(echo "$OUT" | grep -iE 'detail|error|problem' | tail -3)"
      continue
    fi
  fi

  TENANT_HOST="$HOST" envsubst '${TENANT_HOST}' < "$APP_DIR/ops/nginx/tenant.conf.template" > "$CONF"
  if nginx -t 2> /dev/null; then
    systemctl reload nginx
    report "$HOST" ACTIVE ""
    echo "$(date -Is) $HOST live"
  else
    rm -f "$CONF"
    report "$HOST" FAILED "nginx config test failed"
  fi
done

# Panel se hataye gaye domains ke conf files
for CONF in /etc/nginx/conf.d/tenant-*.conf; do
  [ -f "$CONF" ] || continue
  HOST=$(basename "$CONF" .conf | sed 's/^tenant-//')
  if ! echo "$LIST" | awk '{print $1}' | grep -qx "$HOST"; then
    rm -f "$CONF"
    CHANGED=1
    echo "$(date -Is) removed $HOST"
  fi
done
[ "$CHANGED" = 1 ] && nginx -t && systemctl reload nginx
exit 0
