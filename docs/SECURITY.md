# Security notes

## Secrets

All secrets come from environment variables (`.env`, never committed). The frontend
bundle receives **no** secrets — it only ever talks to `/api`. `JWT_SECRET`,
`JWT_REFRESH_SECRET`, `DATABASE_URL`, `AWS_*` stay server-side.

## Authentication & sessions

- Passwords hashed with **bcrypt** (cost 12). Plain text is never stored or logged
  (pino redaction on `*.password`, `*.passwordHash`, `authorization`, `cookie`).
- Access token: short TTL (`JWT_ACCESS_TTL`, default 15m), sent as a Bearer header,
  held only in SPA memory.
- Refresh token: httpOnly + `SameSite=Lax` cookie, path-scoped to `/api/auth`,
  `Secure` in production (`COOKIE_SECURE=true`).
- `tokenVersion` on the user doc invalidates every refresh token on logout / password
  change / admin reset.
- Password reset tokens are random 32-byte values; only their SHA-256 hash is stored,
  with a 1-hour expiry. `forgot-password` never reveals whether an email exists.

## Authorization

- `authenticate` middleware loads a compact auth context (role + resolved permissions +
  department) per request.
- `requirePermission(...)` / `requireRole(...)` guard every mutating route.
- Data scoping (department officers) is applied in services, not just guards.

## Input handling

- Every request body / query / params validated with **Zod** before controllers run;
  failures return `400` with per-field messages.
- `express-mongo-sanitize` strips `$`/`.` keys → NoSQL-injection defence.
- User-supplied strings are escaped before use in `RegExp` (`escapeRegex`).
- `helmet` sets secure headers; CORS is locked to `FRONTEND_URL` with credentials.
- Rate limiting: global limiter on `/api`, strict limiter on `/auth/*`
  (`AUTH_RATE_LIMIT_MAX`, skips successful requests).

## File uploads

- `multer` memory storage, `MAX_FILE_SIZE` limit, max 20 files/request.
- Double gate: extension must be in `ALLOWED_FILE_TYPES` **and** MIME must be in the
  server allow-list. Stored object keys are sanitised (`[^a-zA-Z0-9._-]` → `_`).
- Documents are never served from a public bucket. The browser gets a short-lived URL
  (S3 presigned, TTL `S3_SIGNED_URL_TTL`; or a local HMAC link verified by
  `/api/documents/raw`, same TTL).
- **Malware scanning** is an integration point — add a scan step in
  `documentsService.addDocument` before `storage().put` if you run ClamAV / a cloud scanner.

## QR codes

The printable file cover embeds a QR whose payload is an **opaque signed token**
(`jwt`, purpose-scoped), not applicant data. Scanning hits `/f/:token`, which the SPA
resolves via `/api/requests/resolve/:token` **after the viewer authenticates**.

## Audit

`AuditLog` is append-only (no update, no soft-delete). Login, logout, failed login,
password events, all CRUD, document upload/download/scan/delete, assign/forward, status
change, remark, settings change and imports are recorded with actor, IP, user-agent,
before/after and request id.

## Hardening checklist before production

- [ ] Real, long random `JWT_SECRET` / `JWT_REFRESH_SECRET` (`openssl rand -hex 48`)
- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`, correct `COOKIE_DOMAIN`
- [ ] `STORAGE_PROVIDER=s3` with a **private** bucket + least-privilege IAM
- [ ] TLS terminated in front of the API; `trust proxy` already set
- [ ] Change / delete all seeded DEMO users
- [ ] MongoDB Atlas: IP allow-list, dedicated user, backups enabled
- [ ] Add malware scanning to the upload path
- [ ] Review rate-limit values for your traffic
- [ ] Run `npm run lint && npm run typecheck && npm run test && npm run build`
