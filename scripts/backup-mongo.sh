#!/usr/bin/env sh
set -eu

backup_dir="${MEDSHIFT_BACKUP_DIR:-/opt/medshift-backups}"
retention_days="${MEDSHIFT_BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$backup_dir/medshift-$timestamp.archive.gz"

mkdir -p "$backup_dir"
container="$(docker compose -f docker-compose.prod.yml ps -q mongo)"
test -n "$container"
docker exec "$container" mongodump --archive --gzip > "$archive"
test -s "$archive"
find "$backup_dir" -type f -name 'medshift-*.archive.gz' -mtime "+$retention_days" -delete
echo "Created $archive"
