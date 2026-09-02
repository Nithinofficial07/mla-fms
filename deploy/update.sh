#!/usr/bin/env bash
# Pull the latest code and redeploy. Run from the repo root on the server:
#   ./deploy/update.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git fetch --all --prune
git checkout "${DEPLOY_BRANCH:-main}"
git pull --ff-only

echo "==> Rebuilding and restarting containers"
cd deploy
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Cleaning up old images"
docker image prune -f

echo "==> Waiting for health"
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T app curl -fsS http://localhost:4000/api/health >/dev/null 2>&1; then
    echo "OK - app is healthy"
    exit 0
  fi
  sleep 2
done
echo "!! app did not become healthy - check: docker compose -f deploy/docker-compose.prod.yml logs app"
exit 1
