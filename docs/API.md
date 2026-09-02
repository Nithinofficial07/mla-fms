# API reference

Base URL: `${BACKEND_URL}/api`. Interactive docs: `GET /api/docs` (Swagger UI),
raw spec: `GET /api/openapi.json`.

All endpoints require `Authorization: Bearer <accessToken>` **except**:
`/health`, `/setup/status`, `/setup/bootstrap`, `/auth/login`, `/auth/refresh`,
`/documents/raw` (token-in-URL).

## Conventions

- **List envelope**: `{ data: T[], page, pageSize, total, totalPages }`.
- **List query**: `?page=1&pageSize=25&sort=-createdAt&search=<text>` plus per-resource
  filters. `?includeInactive=true` on master lists shows soft-deleted rows.
- **Error body**: `{ message, code, details?: { field: string[] }, requestId }`.
- **Soft delete**: `DELETE /:id` deactivates; `POST /:id/restore` reverses it.

## Endpoints

### Auth — `/auth`
| Method | Path | Notes |
|---|---|---|
| POST | `/login` | `{ usernameOrEmail, password }` → `{ accessToken, user }` + refresh cookie |
| POST | `/refresh` | uses refresh cookie → new `{ accessToken, user }` |
| POST | `/logout` | revokes refresh tokens |
| GET | `/me` | current `AuthUser` |
| POST | `/forgot-password` | `{ email }` (dev response includes `devToken`) |
| POST | `/reset-password` | `{ token, password }` |
| POST | `/change-password` | `{ currentPassword, newPassword }` |

### Setup — `/setup`
`GET /status` · `POST /bootstrap` (first Super Admin, 409 once any user exists) · `POST /complete`.

### Masters (all use the standard CRUD shape)
`/users` · `/roles` (+ `GET /roles/meta/permissions`) · `/departments` · `/constituencies` ·
`/area-types` · `/wards` · `/gram-panchayats` · `/villages` · `/sub-villages` ·
`/request-categories` · `/request-statuses` · `/priorities` · `/lookups?group=`

### Cascading location options — `/location-options`
`/area-types` · `/wards?constituencyId=` · `/gram-panchayats?constituencyId=` ·
`/villages?gramPanchayatId=|wardId=` · `/sub-villages?villageId=` — flat `{id,name,code}` lists.

### Imports — `/imports`
| Method | Path | Notes |
|---|---|---|
| GET | `/template?kind=LOCATION\|DEPARTMENT` | download xlsx template |
| POST | `/locations?dryRun=true\|false` | multipart `file`; returns `{ job, report }` |
| POST | `/departments?dryRun=true\|false` | multipart `file` |
| GET | `/jobs` | last 50 import jobs |

### Requests — `/requests`
| Method | Path | Notes |
|---|---|---|
| GET | `/` | filters: `search, statusCode, priorityId, categoryId, departmentId, wardId, gramPanchayatId, villageId, assignedOfficerId, overdue=true, from, to` |
| GET | `/:id` | fully populated detail |
| GET | `/:id/timeline` · `/:id/remarks` | history / remarks |
| GET | `/duplicates?mobile=&applicantName=&subject=&wardId=…` | possible duplicates |
| GET | `/resolve/:token` | QR token → `{ id, fileId }` |
| GET | `/:id/cover.pdf` | printable file cover with QR |
| POST | `/` | create; `{ ..., submit?: boolean }` (submit=true skips DRAFT) |
| PATCH | `/:id` | edit (DRAFT only) |
| POST | `/:id/submit` | DRAFT → SUBMITTED, sets due date |
| POST | `/:id/status` | `{ toStatusCode, remark? }` — validated against `transitionsTo` |
| POST | `/:id/assign` · `/:id/forward` | `{ departmentId, officerId?, priorityId?, dueDate?, remark? }` |
| POST | `/:id/remarks` | `{ body, kind? }` |
| DELETE | `/:id` | soft delete |

### Documents — `/documents`
| Method | Path | Notes |
|---|---|---|
| GET | `/request/:requestId` | list |
| POST | `/request/:requestId` | multipart `files[]` + `documentType`, `description?` |
| POST | `/request/:requestId/scan` | multipart `file` (generated PDF) + `pageCount` |
| POST | `/:id/versions` | multipart `file` — new version |
| GET | `/:id/url?download=1` | short-lived signed URL |
| GET | `/raw?key=&exp=&sig=&download=` | local provider only; HMAC-verified stream |
| DELETE | `/:id` | soft delete |

### Dashboard — `/dashboard`
`/stats` (live aggregation counters) · `/charts` (byDepartment/byStatus/monthly/byWard/byGramPanchayat) · `/recent`.

### Reports — `/reports`
`GET /:key?format=json|csv|xlsx|pdf&from=&to=&departmentId=&wardId=&gramPanchayatId=&villageId=&statusCode=&priorityId=`
where `key ∈ department | ward | gram-panchayat | village | status | priority | monthly | officer | pending | overdue`.
Exports respect all filters.

### Notifications — `/notifications`
`GET /` · `GET /unread-count` · `POST /:id/read` · `POST /read-all`.

### Audit — `/audit-logs`
`GET /?action=&entity=&entityId=&actorId=&from=&to=&search=` · `GET /entity/:entity/:id`.

### Settings — `/settings`
`GET /` (any authed user) · `PATCH /` (`settings.manage`) · `GET /backup-status`.
