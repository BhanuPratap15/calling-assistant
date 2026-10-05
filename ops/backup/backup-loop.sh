#!/bin/sh
# docker-compose.prod.yml ki "backup" service: start ke 1 min baad pehla backup, phir har BACKUP_INTERVAL_HOURS
# Fail ho to log me ERROR aur 15 min baad dobara (backup kabhi chupchaap band na ho)
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
sleep 60
while true; do
  if sh /scripts/backup.sh; then
    sleep $((INTERVAL_HOURS * 3600))
  else
    echo "[backup] ERROR: backup failed — retry in 15 min" >&2
    sleep 900
  fi
done
