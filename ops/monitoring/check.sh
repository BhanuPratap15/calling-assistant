#!/bin/sh
# =====================================================================
# Server ka chhota "watchman" — host ke cron se har 5 min:
#   */5 * * * * cd /opt/calling-crm && ./ops/monitoring/check.sh >> /var/log/crm-check.log 2>&1
# Check: API health (DB + scheduler up) + aakhri backup kitna purana. Problem → ALERT_WEBHOOK_URL pe POST
# (Slack / Google Chat / Teams incoming webhook — JSON {"text": "..."}). Exit code 1 = kuch galat.
# Env (ya .env.production se): HEALTH_URL, BACKUP_DIR, BACKUP_MAX_AGE_HOURS (26), ALERT_WEBHOOK_URL
# =====================================================================
set -u
[ -f ./.env.production ] && . ./.env.production
HEALTH_URL="${HEALTH_URL:-https://${SERVER_NAME:-localhost}/api/health}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
MAX_AGE_H="${BACKUP_MAX_AGE_HOURS:-26}"
problems=""

body="$(curl -fsS -m 10 "$HEALTH_URL" 2>&1)" || problems="$problems API down ($HEALTH_URL): $body;"
case "$body" in *'"database":"up"'*) ;; *) problems="$problems database not up;" ;; esac
case "$body" in *'"scheduler":"up"'*) ;; *) problems="$problems scheduler (Redis) not up — follow-up reminders band;" ;; esac

if [ -f "$BACKUP_DIR/.last_success" ]; then
  age_h=$(( ( $(date +%s) - $(date -r "$BACKUP_DIR/.last_success" +%s) ) / 3600 ))
  [ "$age_h" -gt "$MAX_AGE_H" ] && problems="$problems last backup ${age_h}h old;"
else
  problems="$problems no backup yet ($BACKUP_DIR/.last_success missing);"
fi

if [ -n "$problems" ]; then
  msg="⚠ Calling CRM ($(hostname)): $problems"
  echo "$(date -u) $msg"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -fsS -m 10 -H 'Content-Type: application/json' \
      -d "{\"text\": \"$(printf '%s' "$msg" | sed 's/"/\\"/g')\"}" "$ALERT_WEBHOOK_URL" >/dev/null \
      || echo "$(date -u) alert webhook failed"
  fi
  exit 1
fi
echo "$(date -u) OK"
