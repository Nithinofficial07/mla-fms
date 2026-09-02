# Architecture

## Overview

```
┌────────────┐    HTTPS     ┌──────────────┐   Mongoose    ┌──────────────┐
│  React SPA │ ───────────▶ │  Express API │ ────────────▶ │  MongoDB     │
│  (Vite)    │ ◀─────────── │  (Node 20)   │ ◀──────────── │  (Atlas)     │
└────────────┘   JSON / JWT └──────┬───────┘               └──────────────┘
                                   │ StorageProvider
                                   ▼
                     ┌───────────────────────────┐
                     │ local disk  |  AWS S3      │  (private, presigned URLs)
                     └───────────────────────────┘
```

The `shared/` package is imported by both sides and is the single source of truth for
the permission catalogue, role → permission defaults, seed enums and the File/Request/
Document ID formatter.

## Backend layering

```
routes/index.ts         mounts every module router under /api
modules/<feature>/
  *.routes.ts            express.Router — validation + rbac + controller glue
  *.service.ts           business logic, no req/res
  *.validation.ts        zod schemas
middleware/              auth, rbac, validate, upload, rateLimit, error, requestContext
models/                  Mongoose schemas + plugins (soft-delete, json transform)
storage/                 StorageProvider interface + local + s3 implementations
utils/                   AppError, http helpers, jwt, password, sequence, queryFeatures,
                         audit, crudFactory, qrToken
jobs/                    in-process due-date / overdue sweep (swap for a worker in prod)
docs/                    OpenAPI spec + swagger-ui mount
seed/                    demo data (all rows flagged isDemo) + xlsx template generator
```

`utils/crudFactory.ts` generates a full REST router (list/get/create/update/soft-delete/
restore + audit) for every simple master collection, so departments, roles, area types,
wards, GPs, villages, sub-villages, categories, statuses, priorities and lookups share
one battle-tested implementation.

## Data model (collections)

`User`, `Role`, `Counter`, `Department`, `Constituency`, `AreaType`, `Ward`,
`GramPanchayat`, `Village`, `SubVillage`, `RequestCategory`, `RequestStatus`, `Priority`,
`Lookup`, `SystemSettings`, `Request`, `Document` (with embedded `versions[]`),
`RequestAssignment`, `RequestRemark`, `TimelineEvent`, `Notification`, `AuditLog`,
`LocationImportJob`.

### Key relationships

- `Request` references every master by `ObjectId` only (`priorityId`, `statusId`,
  `categoryId`, `primaryDepartmentId`, `location.{wardId,gramPanchayatId,villageId,subVillageId}`,
  `assignedOfficerId`, `createdBy`). `statusCode` is denormalised for fast filtering.
- `Village.parentType` is `GRAM_PANCHAYAT` or `WARD`; exactly one parent id is set. The
  cascading location endpoints only return children of the selected parent, enforcing the
  hierarchy at request-creation time.
- `Counter` provides atomic per-year sequences (`fileId:2026`, `requestId:2026`,
  `documentId:2026`) so concurrent creates never collide. The final string is produced by
  `formatId()` from `SystemSettings.fileIdFormat`.

### Indexes

`fileId`/`requestId` (unique), `applicant.mobile`, text index on
`subject`+`applicant.name`+`description`, `statusCode`, `priorityId`, `primaryDepartmentId`,
`location.wardId`, `location.gramPanchayatId`, `location.villageId`, `dueDate`, `createdAt`,
plus compound `{statusCode, priorityId, createdAt}`.

## Auth flow

1. `POST /api/auth/login` → verifies bcrypt hash → returns short-lived **access token**
   (JSON body, kept in memory by the SPA) + sets **refresh token** as an httpOnly,
   `SameSite=Lax` cookie scoped to `/api/auth`.
2. SPA sends `Authorization: Bearer <access>` on every call.
3. On `401`, the axios interceptor calls `POST /api/auth/refresh` once and retries.
4. `logout` / password change bump `user.tokenVersion`, invalidating all refresh tokens.

## Workflow engine

`RequestStatus` rows carry `transitionsTo: string[]` (status codes). `POST /requests/:id/status`
rejects any transition not in that list (unless the source has no transitions defined).
Every status change, assignment, forward, remark and document event appends an immutable
`TimelineEvent` and (where relevant) an `AuditLog` row and notifications.

## Storage

`storage()` returns the provider named by `STORAGE_PROVIDER`. Both implement
`put / getSignedUrl / getBuffer / delete / exists`. The browser only ever receives a
short-lived URL — an S3 presigned URL, or (local provider) an HMAC-signed link that the
`/api/documents/raw` endpoint verifies before streaming the file. No bucket is public.

## Frontend structure

- `app/AuthProvider` — session state, `can(permission)` helper, silent refresh on load.
- `routes/guards` — `ProtectedRoute`, `RequirePermission`, `PublicOnly`.
- `components/MasterCrudPage` — config-driven admin page (columns + field defs) powering
  ~10 routes.
- `components/scanner/ScannerDialog` — getUserMedia capture, multi-page, rotate/reorder,
  `jsPDF` assembly, returns a `File`.
- `hooks/useOptions` — cached dropdown data incl. cascading location options.
- `features/<domain>/` — one folder per domain, matching the backend modules.
