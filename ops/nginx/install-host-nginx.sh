#!/bin/sh
# =====================================================================
# Host nginx (systemd) install / config update — production reverse proxy.
#   sudo ./ops/nginx/install-host-nginx.sh
# Har baar safe hai: templates/default.conf.template → /etc/nginx/conf.d/crm.conf, nginx -t, reload.
# Template badla (git pull) → ye script dobara chalao.
# =====================================================================
set -eu
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$APP_DIR/.env.production"
[ "$(id -u)" = 0 ] || { echo "root chahiye (sudo)"; exit 1; }

SERVER_NAME=$(sed -n 's/^SERVER_NAME=//p' "$ENV_FILE" | tail -1)
CERTS_DIR=$(sed -n 's/^CERTS_DIR=//p' "$ENV_FILE" | tail -1)
[ -n "$SERVER_NAME" ] || { echo "SERVER_NAME missing in $ENV_FILE"; exit 1; }
case "${CERTS_DIR:-./ops/certs}" in /*) CERTS_ABS="$CERTS_DIR" ;; *) CERTS_ABS="$APP_DIR/${CERTS_DIR:-./ops/certs}" ;; esac

if ! command -v nginx > /dev/null; then
  # Install ke waqt nginx apne aap start na ho (80/443 shayad abhi kisi aur ke paas hon)
  printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod +x /usr/sbin/policy-rc.d
  apt-get update -q && DEBIAN_FRONTEND=noninteractive apt-get install -y -q nginx gettext-base || { rm -f /usr/sbin/policy-rc.d; exit 1; }
  rm -f /usr/sbin/policy-rc.d
  rm -f /etc/nginx/sites-enabled/default # Ubuntu ka welcome page — port 80 ka default CRM rahe
fi

# Certs: template /etc/nginx/certs padhta hai (nginx master root hai, $APP_DIR /root me ho to bhi chalega)
ln -sfn "$CERTS_ABS" /etc/nginx/certs
# Let's Encrypt webroot: worker (www-data) /root ke andar nahi padh sakta → /var/www/certbot
mkdir -p /var/www/certbot

export SERVER_NAME
envsubst '${SERVER_NAME}' < "$APP_DIR/ops/nginx/templates/default.conf.template" > /etc/nginx/conf.d/crm.conf
nginx -t
systemctl enable nginx > /dev/null 2>&1
if systemctl is-active --quiet nginx; then systemctl reload nginx; else echo "config ready — start: systemctl start nginx"; fi
echo "nginx: /etc/nginx/conf.d/crm.conf ($SERVER_NAME)"
