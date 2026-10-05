#!/bin/sh
# =====================================================================
# Ek DB backup: pg_dump (custom format, compressed) → $BACKUP_DIR/crm-<UTC time>.dump
# Pehle .tmp me likhta hai, check karta hai (pg_restore --list), tab final naam — adhoora backup kabhi "ready" nahi dikhta.
# Env: PGHOST PGUSER PGPASSWORD PGDATABASE, BACKUP_DIR (default /backups), BACKUP_RETENTION_DAYS (default 14)
# =====================================================================
set -eu
DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DIR/crm-$TS.dump"

mkdir -p "$DIR"
echo "[backup] $(date -u) start → $FILE"
pg_dump --format=custom --compress=6 --no-owner --file="$FILE.tmp"
pg_restore --list "$FILE.tmp" > /dev/null # file padhne layak hai?
mv "$FILE.tmp" "$FILE"
echo "$TS $(wc -c < "$FILE") bytes" > "$DIR/.last_success" # monitoring isko dekhta hai

# Purane backups hatao (KEEP_DAYS se zyada purane)
find "$DIR" -name 'crm-*.dump' -type f -mtime +"$KEEP_DAYS" -print -delete
find "$DIR" -name 'crm-*.dump.tmp' -type f -mmin +120 -delete # crash wale adhoore
echo "[backup] done: $(du -h "$FILE" | cut -f1)"
