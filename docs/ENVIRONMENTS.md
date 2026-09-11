# Environments — dev vs prod

Two independent deployments on Render, from two branches of the same repo.

| | **dev** | **prod** |
|---|---|---|
| Branch | `dev` | `main` |
| Render service | `mla-fms-dev` | `mla-fms` |
| URL | `https://mla-fms-dev.onrender.com` (exact name depends on availability) | `https://mla-fms.onrender.com` |
| Database | same Atlas cluster, **different database name** (`mla_fms_dev`) | `mla_fms` (or whatever the current prod DB is named) |
| File storage | same S3 bucket, objects under the `dev/` key prefix | same bucket, no prefix |
| Email | `EMAIL_PROVIDER=none` by default — nothing goes to real department officers while testing | Brevo, live |
| `NODE_ENV` | `development` — pretty logs, auto-index, and `/api/auth/forgot-password` echoes the reset token in its JSON response so you can test the reset flow without email | `production` |
| Errors | `EXPOSE_ERRORS=true` — 5xx responses include the underlying error, useful while testing | unset — generic error only |

Data, users, uploaded documents and settings in **dev are completely separate
from prod** — creating a test request or a test officer login in dev never
touches real citizen data.

## Workflow

1. **All day-to-day work lands on `dev`.** Every commit for a new feature,
   fix, or content change (departments, officers, etc.) is pushed to the
   `dev` branch, which Render auto-deploys to `mla-fms-dev`.
2. **Nothing reaches `main` / prod automatically.** `main` only moves when
   you explicitly say so ("deploy this to prod", "push prod", "release
   this"). At that point `dev` is merged (fast-forward, since dev is always
   built on top of main) into `main` and pushed — Render's `autoDeploy: true`
   on the `mla-fms` service then redeploys prod.
3. If a prod hotfix is ever needed before dev is ready to promote wholesale,
   it's cherry-picked onto `main` directly and back-merged into `dev` so the
   branches don't drift.

## One-time setup for the second Render service

`render.yaml` describes both services, but Render's Blueprint sync reads it
from whichever branch the Blueprint resource was pointed at when it was
first created (`main`, in this project) — so simply pushing the `dev`
service's definition on the `dev` branch won't make Render create it. Create
it directly instead:

1. Render dashboard → **New** → **Web Service**.
2. Connect the same GitHub repo, but pick the **`dev`** branch (not `main`).
3. Runtime: **Docker**, Dockerfile path `./Dockerfile`, root `.` — same as
   prod. Plan: **Free** is fine for a test environment (it sleeps when idle;
   bump to Starter if that's annoying).
4. Name it `mla-fms-dev` (or anything — it's a separate service either way).
5. Health check path: `/api/health`.
6. Environment variables — copy the `mla-fms-dev` block from `render.yaml`
   for the plain values, and set these secrets by hand (never reuse prod's
   database or secrets):
   - `DATABASE_URL` — same Atlas cluster as prod, different DB name, e.g.
     `mongodb+srv://<user>:<pass>@cluster0.xxx.mongodb.net/mla_fms_dev?retryWrites=true&w=majority`
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` — freshly generated, not prod's.
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — can reuse prod's IAM
     user (it's already S3-only least-privilege); `AWS_S3_KEY_PREFIX=dev`
     keeps its objects out of prod's way in the same bucket.
   - `BACKEND_URL` / `FRONTEND_URL` — fill in after the first deploy, once
     Render assigns the `.onrender.com` URL.
7. Deploy, then open the URL → Setup Wizard → create dev's own Super Admin.
   This is a brand-new, empty database — none of prod's departments, wards,
   users or requests exist here until you add or import them separately.

After that, every push to `dev` redeploys `mla-fms-dev` automatically, same
as prod does from `main`.
