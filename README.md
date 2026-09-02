# MLA File Management System

Digital management of constituency-level requests, files, documents, departments and the
ward / Gram Panchayat / village hierarchy for an MLA office.

> **Status: scaffold (broad, thin).** Every module is present and wired end-to-end
> (models → API → UI → nav), with the core flows working. Depth (advanced scanner
> image processing, OCR providers, richer reports, e2e tests, hardening) is layered
> on next. Nothing about the constituency is hard-coded — departments, wards, GPs,
> villages, categories, statuses and priorities are all managed from the Admin UI or
> bulk-imported from spreadsheets.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite + MUI v5 + MUI X DataGrid + TanStack Query + Recharts |
| Backend | Node 20 + Express + TypeScript + Mongoose 8 + Zod |
| Database | MongoDB (Atlas) |
| Auth | JWT access token (memory) + refresh token (httpOnly cookie), bcrypt hashing |
| Storage | Pluggable — local disk (dev) or S3 with presigned URLs (prod) |
| Docs | OpenAPI 3 at `/api/docs` |
| PWA | vite-plugin-pwa (offline shell + cached location options) |

## Repository layout

```
shared/    types, permission catalogue, role defaults, enums, ID formatter (used by both sides)
server/    Express API — src/{config,models,middleware,modules,routes,storage,jobs,utils,docs}, seed/, tests/
client/    React SPA — src/{api,app,components,features,hooks,layouts,routes,theme}
docs/      ARCHITECTURE, API, SECURITY, ROLES, TESTING, DEPLOYMENT
```

## Prerequisites

- **Node.js 20.x** (`nvm use` reads `.nvmrc`)
- A **MongoDB connection string** — a free MongoDB Atlas cluster is fine

## Setup

```bash
# 1. install (npm workspaces)
npm install

# 2. configure
cp .env.example .env
#   set DATABASE_URL to your Atlas URI
#   set JWT_SECRET and JWT_REFRESH_SECRET to long random strings

# 3. seed demo data (roles, super admin, 22 demo departments, sample hierarchy, demo requests)
npm run seed

# 4. run both apps (http://localhost:5173, API on :4000)
npm run dev
```

### First login

After `npm run seed` (all seeded rows are flagged `isDemo` / `DEMO`):

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@mla.local` | `Admin@12345` |
| MLA | `mla@mla.local` | `Mla@12345` |
| Department Officer | `officer@mla.local` | `Officer@12345` |
| Data Entry Operator | `operator@mla.local` | `Operator@123` |
| Viewer | `viewer@mla.local` | `Viewer@12345` |

Change these before any real use. To start from a blank DB instead of seeding, open
`/setup` for the first-run wizard (only works while there are zero users).

## Scripts (run from repo root)

| Command | Effect |
|---|---|
| `npm run dev` | shared (watch) + server (tsx watch) + client (vite) |
| `npm run build` | build shared → server (`tsc`) → client (`vite build`) |
| `npm run lint` | eslint server + client |
| `npm run typecheck` | `tsc --noEmit` both |
| `npm run test` | vitest — server (mongodb-memory-server) + client (jsdom) |
| `npm run seed` | (re)seed demo data |

## Replacing demo data with real constituency data

1. Log in as Super Admin.
2. **Departments → Import** → download the template → fill in the real 22 names → validate → import.
3. **Locations → Bulk Import** → download the template → fill wards / GPs / villages / sub-villages → validate → import.
4. **Configuration** pages → adjust request categories, workflow statuses, priorities.
5. Delete the demo rows (they show a `DEMO` chip) once real data is in.
6. **Settings** → set app name, constituency name, File ID format, SLA, upload limits.

No source changes are required for any of the above.

## What works today

Auth + refresh + RBAC · first-run wizard · all master CRUD with soft-delete · bulk Excel
import with dry-run validation + error report + downloadable templates · cascading
location picker that enforces the hierarchy · request create (desktop stepper + mobile
stepper + save-as-draft) · auto File/Request/Document IDs (configurable format) ·
duplicate detection · request list with server-side pagination/filter/search ·
request detail with Overview / Documents / Timeline / Remarks / Actions tabs ·
document upload (drag-drop / take photo) · in-app multi-page camera scanner → client PDF ·
signed-URL document preview & download · assign / forward / configurable status
transitions · append-only timeline · in-app notifications + due-date/overdue sweep job ·
dashboard with live aggregation cards + charts + recent table · reports (10 kinds) with
CSV/XLSX/PDF export respecting filters · printable file cover with QR (opaque token) ·
audit log viewer · settings · OpenAPI docs · PWA offline shell.

## Known gaps / next

OCR providers are interface-only (`OCR_PROVIDER=none`). Email/SMS providers are stubs.
Scanner does capture + rotate + reorder + PDF but not automatic edge detection /
perspective correction. Reports are tabular (no in-report charts yet). Tests cover
auth + requests + locations + RBAC on the server and the ID formatter on the client;
e2e (Playwright) is not set up yet. Backup is surfaced honestly as "not configured".

See [docs/](docs/) for architecture, security notes, the role matrix, testing and deployment.
