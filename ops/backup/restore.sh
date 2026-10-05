#!/bin/sh
# =====================================================================
# Backup se DB wapas lao (SERVER pe, repo folder se chalao):
#   ./ops/backup/restore.sh backups/crm-20261005T020000Z.dump
# ⚠ Current DB ka data us backup se REPLACE ho jaayega. Pehle API band hoti hai (koi naya data na likhe).
# =====================================================================
set -eu
FILE="${1:-}"
[ -f "$FILE" ] || { echo "Usage: $0 <backup.dump>"; exit 1; }
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
. ./.env.production

echo "⚠  $POSTGRES_DB database '$FILE' se REPLACE hoga. Type 'restore' to continue:"
read -r answer
[ "$answer" = "restore" ] || { echo "Cancelled"; exit 1; }

$COMPOSE stop api web # restore ke dauraan koi likhe nahi
$COMPOSE exec -T postgres pg_restore --clean --if-exists --no-owner \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$FILE"
$COMPOSE run --rm migrate # backup purane version ka ho to naye migrations lagao
$COMPOSE start api web
echo "✔ Restored from $FILE"
