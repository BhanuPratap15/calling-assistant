#!/bin/sh
# Certbot "deploy hook": naya / renew hua certificate → ops/certs me copy → Nginx reload.
# certbot ise RENEWED_LINEAGE env ke saath chalata hai (/etc/letsencrypt/live/<domain>).
# docs/DEPLOYMENT.md step 5.
set -eu
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${RENEWED_LINEAGE:?run via certbot --deploy-hook}"
cp -L "$SRC/fullchain.pem" "$SRC/privkey.pem" "$APP_DIR/ops/certs/"
chmod 644 "$APP_DIR/ops/certs/fullchain.pem"
chmod 640 "$APP_DIR/ops/certs/privkey.pem"
# Stack chal raha ho to Nginx naya cert padh le (downtime nahi)
if systemctl is-active --quiet nginx 2>/dev/null; then nginx -t && systemctl reload nginx; fi
echo "certificate installed from $SRC"
