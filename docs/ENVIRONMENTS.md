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

## CI/CD (GitHub Actions)

Two workflows in `.github/workflows/`:

### `ci.yml` — runs automatically

On every push or pull request to `dev` or `main`:
- `npm run typecheck` (shared + server + client)
- `npm run test` (server + client, in-memory Mongo — no external DB needed)
- `npm run build` (production build, same as the Dockerfile's build stage)
- `docker build` of the actual `Dockerfile` Render deploys from — this is
  what would have caught the very first Render crash this project hit
  (a dependency that only broke once `npm prune --omit=dev` ran).

This is a check, not a deploy. Render does the actual deploying, per-branch,
on its own (`autoDeploy: true` on both services) — CI just has to be green
before you'd want to promote (see below).

### `promote-to-prod.yml` — runs only when you click it

**This never runs on a push.** It's `workflow_dispatch`-only: GitHub →
**Actions** tab → **Promote dev to production** → **Run workflow** → type
`PROMOTE` (all caps) in the confirm box → **Run workflow**. That is the "push
prod" trigger — nothing else pushes to `main`.

What it does, in order, aborting if any step fails:
1. Checks out `main`, fetches `dev`, and fast-forwards `main` onto `dev`
   **locally, not yet pushed**. If the branches have diverged (a direct hot
   fix was made on `main` without being merged back into `dev`) this step
   fails on purpose — decide by hand how to reconcile rather than have the
   workflow guess.
2. Re-runs typecheck, test, and build against that exact merged commit —
   so a broken `dev` can never be promoted, even accidentally.
3. Only then pushes `main`. Render's `mla-fms` service picks up the new
   commit and redeploys automatically within seconds.

To get a second confirmation gate (someone else has to approve the run
before it executes, not just start it), add required reviewers once:
GitHub repo → **Settings → Environments → New environment** → name it
exactly `production` → **Required reviewers** → add yourself/whoever should
approve. The workflow already targets an environment named `production`; if
it doesn't exist yet, the run just proceeds without that extra gate.

One-time repo setting this depends on: **Settings → Actions → General →
Workflow permissions → Read and write permissions** (needed so the workflow
can `git push` to `main` with the built-in token).

Until the first promotion happens, these workflow files only exist on
`dev`, so `ci.yml` won't yet run on pushes to `main` — that fixes itself
automatically the first time `promote-to-prod.yml` fast-forwards `main` to
`dev`, since the workflow files come along with everything else.
