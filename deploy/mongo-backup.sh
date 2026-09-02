#!/usr/bin/env bash
# Extra safety-net backup of the Atlas database to a local gzip archive,
# then (optionally) push it to S3. Atlas already keeps automated backups -
# this is belt-and-braces and gives you an off-Atlas copy.
#
# Cron (daily 02:15):
#   15 2 * * *  /opt/mla-fms/deploy/mongo-backup.sh >> /var/log/mla-backup.log 2>&1
#
# Requires: mongodump (apt-get install -y mongodb-database-tools), aws (optional).
set -euo pipefail

# Load DATABASE_URL etc.
ENV_FILE="$(dirname "$0")/.env"
[ -f "$ENV_FILE" ] && set -a && . "$ENV_FILE" && set +a

: "${DATABASE_URL:?DATABASE_URL not set}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mla-fms}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/mla_fms-${STAMP}.archive.gz"

mkdir -p "$BACKUP_DIR"
echo "==> mongodump -> $OUT"
mongodump --uri="$DATABASE_URL" --archive="$OUT" --gzip

# optional off-site copy
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "==> uploading to s3://${BACKUP_S3_BUCKET}/db/"
  aws s3 cp "$OUT" "s3://${BACKUP_S3_BUCKET}/db/" ${AWS_S3_ENDPOINT:+--endpoint-url "$AWS_S3_ENDPOINT"}
fi

echo "==> pruning local backups older than ${RETAIN_DAYS} days"
find "$BACKUP_DIR" -name 'mla_fms-*.archive.gz' -mtime "+${RETAIN_DAYS}" -delete

echo "done."
# Restore:  mongorestore --uri="$DATABASE_URL" --archive=FILE.archive.gz --gzip --drop
