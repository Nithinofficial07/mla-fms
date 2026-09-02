# Deployment — MLA File Management System

Target architecture (chosen):

```
                    ┌──────────────────────────────────────┐
   Internet  ─443─▶ │  Caddy   (auto HTTPS, reverse proxy)  │
                    └───────────────┬──────────────────────┘
                                    │ :4000 (internal)
                    ┌───────────────▼──────────────────────┐
                    │  app  (Node)  — REST API + React SPA  │
                    └──────┬───────────────────┬───────────┘
                           │                   │
                 MongoDB Atlas          S3-compatible bucket
                 (managed, backups)     (private, documents)
```

One Linux server runs two containers (`app`, `caddy`). The database and file
storage are managed services. No secrets are baked into the image.

---

## 1. Prerequisites

| Thing | Notes |
|---|---|
| **Server** | Ubuntu 22.04/24.04 LTS, 2 vCPU / 2–4 GB RAM / 20 GB disk. A $6–12/mo VPS is plenty for one office. |
| **Domain** | e.g. `mlaoffice.example.in`. You control DNS. |
| **MongoDB Atlas** | Free M0 works to start; **M10+ recommended** for production (backups, no sleep). |
| **S3 bucket** | AWS S3, Cloudflare R2, Backblaze B2, or self-hosted MinIO. **Block all public access.** |
| **Email/SMS** (optional) | SMTP creds / MSG91 or Twilio. Can be added later. |

---

## 2. One-time server setup

SSH in as a sudo user, then:

```bash
# Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" && newgrp docker

# firewall: allow SSH + web only
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# get the code
sudo mkdir -p /opt/mla-fms && sudo chown "$USER" /opt/mla-fms
git clone <YOUR_REPO_URL> /opt/mla-fms
cd /opt/mla-fms
```

---

## 3. MongoDB Atlas

1. Create a project → cluster (`mla-fms`).
2. **Database Access** → add user `mla_app` with a strong password, role
   *Read and write to any database*.
3. **Network Access** → add your **server's public IP** (`curl ifconfig.me`).
   Do **not** use `0.0.0.0/0` in production.
4. **Connect → Drivers** → copy the `mongodb+srv://…` string. Put the DB name
   `mla_fms` before the `?`, and URL-encode any special characters in the
   password.
5. **Backup**: enable *Cloud Backup* with a daily snapshot + point-in-time
   recovery (M10+). This is your primary DB backup.

---

## 4. S3 bucket

### AWS — one command (CloudFormation)

`deploy/aws/s3-storage.cfn.yaml` provisions the private bucket + a
least-privilege IAM key. With the AWS CLI configured:

```bash
cd deploy/aws
BUCKET=mla-fms-documents-prod APP_ORIGIN=https://mlaoffice.example.in ./provision-s3.sh
```

It prints the four `AWS_*` lines to paste into `deploy/.env`. The stack sets:
Block Public Access (all on), default AES-256 encryption, versioning,
TLS-only bucket policy, a lifecycle rule to expire old versions after 90 days,
and a CORS rule for your app origin (needed by the in-browser PDF viewer).
`DeletionPolicy: Retain` means deleting the stack never deletes your documents.

### Manual / non-AWS (R2, B2, MinIO, Wasabi)

1. Create a **private** bucket, e.g. `mla-fms-documents-prod`.
2. **Block all public access.** The app only ever hands out short-lived
   *presigned* URLs.
3. Enable **versioning** + a lifecycle rule to expire non-current versions
   after ~90 days.
4. Create an API key scoped to that bucket:
   `PutObject`, `GetObject`, `DeleteObject`, `ListBucket`.
5. Note key + secret. For R2/B2/MinIO also set `AWS_S3_ENDPOINT` and
   `AWS_S3_FORCE_PATH_STYLE=true` in `deploy/.env`.

---

## 5. Configure

```bash
cd /opt/mla-fms/deploy
cp .env.production.example .env
nano .env
```

Fill in **every** value. Generate the two JWT secrets:

```bash
openssl rand -hex 48   # -> JWT_SECRET
openssl rand -hex 48   # -> JWT_REFRESH_SECRET  (must differ)
```

Set `DOMAIN`, `ACME_EMAIL`, `BACKEND_URL`, `FRONTEND_URL`, `COOKIE_DOMAIN` to
your domain. Set `STORAGE_PROVIDER=s3` and the bucket/keys. The app **refuses to
start** in production if a secret still looks like a placeholder.

Point DNS: an **A record** for `mlaoffice.example.in` → server IP (and `AAAA` if
you have IPv6). Wait for it to resolve (`dig +short mlaoffice.example.in`).

---

## 6. Launch

```bash
cd /opt/mla-fms/deploy
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app     # watch it boot
```

Caddy obtains a Let's Encrypt certificate automatically on first request
(needs ports 80+443 open and DNS resolving).

Check: `curl -fsS https://mlaoffice.example.in/api/health` → `{"status":"ok",...}`

---

## 7. First-run setup (in the browser)

1. Open `https://mlaoffice.example.in`. You'll get the **Setup Wizard**.
2. Create the **Super Admin** account + constituency name. This also seeds the
   required reference data (roles, priorities, the status workflow, request
   categories, document/ID type lists). **No demo data is created.**
3. Log in as the Super Admin.
4. **Admin → Departments → Import** — upload the real 22 line departments
   (`department_template.xlsx`, download from that screen).
5. **Admin → Locations → Import** — upload wards / gram panchayats / villages /
   sub-villages (`location_template.xlsx`). Validate (dry-run) first; fix the
   error report; then import.
6. **Admin → Users** — create Admin / MLA / Department Officer / Data-Entry /
   Viewer accounts. Officers must be linked to a department.
7. **Settings** — upload the office logo, set the File-ID / Letter-No formats,
   SLA days, upload limits, notification preferences.

Everything above is data — no code changes, ever, to add Ward 25 or Department 23.

---

## 8. Updates

```bash
cd /opt/mla-fms
./deploy/update.sh        # git pull + rebuild + rolling restart + health check
```

The image is rebuilt from source; `docker compose up -d` recreates the `app`
container. Zero DB migration step — Mongoose creates indexes on boot.

---

## 9. Backups & restore

| Data | Primary backup | Extra |
|---|---|---|
| **Database** | Atlas Cloud Backup (daily + PITR) | `deploy/mongo-backup.sh` via cron → local gzip + optional S3 copy |
| **Documents** | S3 versioning + cross-region replication (optional) | — |
| **Config** (`deploy/.env`) | store in a password manager / sealed secret | — |

Enable the extra DB dump:

```bash
sudo apt-get install -y mongodb-database-tools
( crontab -l 2>/dev/null; echo '15 2 * * * /opt/mla-fms/deploy/mongo-backup.sh >> /var/log/mla-backup.log 2>&1' ) | crontab -
```

**Restore DB:** `mongorestore --uri="$DATABASE_URL" --archive=FILE.archive.gz --gzip --drop`
(or restore the Atlas snapshot from the Atlas UI).

The **Settings → Backup status** screen reports the last dump time/status once
the cron job has run; until then it honestly shows "never / not configured".

---

## 10. Operations

```bash
# logs
docker compose -f deploy/docker-compose.prod.yml logs -f app
# restart just the app
docker compose -f deploy/docker-compose.prod.yml restart app
# shell into the container
docker compose -f deploy/docker-compose.prod.yml exec app sh
# resource use
docker stats
```

- **Log rotation**: add `/etc/docker/daemon.json` → `{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"5"}}` then `sudo systemctl restart docker`.
- **Monitoring**: point an uptime check (BetterStack/UptimeRobot) at
  `https…/api/health`. Atlas has its own alerting.
- **API docs**: `https://…/api/docs` (Swagger UI). Consider restricting this at
  the Caddy layer if you don't want it public.

---

## 11. Security checklist (done / to verify)

- [x] TLS everywhere, HSTS, secure headers (Caddy + `helmet` CSP in-app)
- [x] JWT access token in memory + refresh token in **HttpOnly, Secure, SameSite=Lax** cookie scoped to `/api/auth`
- [x] bcrypt password hashing; login attempts + all sensitive actions in the **audit log**
- [x] RBAC (role + fine-grained permissions) enforced server-side on every route
- [x] Rate limiting (global + tighter on auth)
- [x] `express-mongo-sanitize` (NoSQL-injection), Zod validation on every body/query
- [x] Upload type + size limits, extension **and** MIME checks, sanitised object keys
- [x] Private bucket only; documents served via short-lived signed URLs (`S3_SIGNED_URL_TTL`, default 300 s)
- [x] No secrets in the image or the client bundle; `.env` git-ignored
- [x] Container runs as non-root (`node`), `tini` for clean shutdown
- [ ] **You**: restrict Atlas IP access list to the server IP
- [ ] **You**: rotate the S3 keys / DB password on a schedule
- [ ] **You**: keep the server patched (`unattended-upgrades`), restrict SSH to keys
- [ ] **You**: optionally gate `/api/docs` behind basic-auth in the Caddyfile

---

## 12. Alternative: managed PaaS (Render/Railway)

The same image works. Create one **Web Service** from the `Dockerfile`, set the
env vars from `.env.production.example` (skip `DOMAIN`/`ACME_EMAIL` — the
platform gives you TLS + a hostname), and set `BACKEND_URL`/`FRONTEND_URL`/
`COOKIE_DOMAIN` to that hostname. No Caddy needed.
