#!/usr/bin/env bash
# =============================================================================
# One-shot bootstrap for a FRESH Ubuntu 22.04/24.04 server.
# Installs Docker, sets the firewall, and drops you into the repo ready to
# configure deploy/.env and launch.
#
#   Run as a sudo-capable user (NOT root login):
#     curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/server-bootstrap.sh | bash
#   or, if the repo is already cloned:
#     bash deploy/server-bootstrap.sh
# =============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-}"          # e.g. git@github.com:you/mla-fms.git  (or https URL)
APP_DIR="${APP_DIR:-/opt/mla-fms}"
BRANCH="${BRANCH:-main}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

log "1/5  System packages"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git ufw

log "2/5  Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER" || true
docker --version
docker compose version

log "3/5  Firewall (SSH + HTTP + HTTPS only)"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose

log "4/5  Docker log rotation"
sudo mkdir -p /etc/docker
echo '{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }' | sudo tee /etc/docker/daemon.json >/dev/null
sudo systemctl restart docker

log "5/5  Fetch the application"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all --prune && git -C "$APP_DIR" checkout "$BRANCH" && git -C "$APP_DIR" pull --ff-only
elif [ -n "$REPO_URL" ]; then
  sudo mkdir -p "$APP_DIR" && sudo chown "$USER:$USER" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "REPO_URL not set and $APP_DIR is not a git repo."
  echo "Either: (a) rerun with REPO_URL=<git url>  OR  (b) copy the project to $APP_DIR yourself (rsync/scp)."
fi

cat <<EOF

-----------------------------------------------------------------------
Bootstrap done. Next:

  1) Log out and back in once (so your user picks up the 'docker' group).
  2) cd $APP_DIR/deploy
  3) cp .env.production.example .env   (skip if you already copied one)
  4) nano .env      # fill DATABASE_URL, S3 keys, DOMAIN, ACME_EMAIL, secrets
  5) Point DNS: A record  <DOMAIN> -> $(curl -fsS ifconfig.me 2>/dev/null || echo '<this server public IP>')
  6) docker compose -f docker-compose.prod.yml up -d --build
  7) curl -fsS https://<DOMAIN>/api/health
-----------------------------------------------------------------------
EOF
