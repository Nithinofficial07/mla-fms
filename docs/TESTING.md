# Testing

## Run

```bash
npm run test              # server + client
npm run test --workspace server
npm run test --workspace client
```

## Server (`server/tests/`)

- **Runner**: Vitest. **DB**: `mongodb-memory-server` — an in-memory MongoDB started
  once in `tests/setup.ts`; every collection is cleared before each test. No external
  Mongo needed.
- Required env is injected by `server/vitest.config.ts` (`test.env`).
- `tests/helpers.ts` — `seedCore()` (roles, statuses, priority, super admin,
  constituency), `login()`, `auth()`.

| File | Covers |
|---|---|
| `auth.test.ts` | bad credentials → 401, successful login shape, `/me` with/without token, payload validation |
| `requests.test.ts` | ID generation, draft vs submit + due date, mobile validation, **status transition graph enforcement**, timeline creation, list envelope |
| `locations.test.ts` | ward→village creation, cascading option hierarchy, **RBAC** (viewer blocked from writing masters), soft-delete hides rows / `includeInactive` reveals them |

## Client (`client/src/**/*.test.ts`)

- **Runner**: Vitest + `jsdom` + Testing Library (`src/test/setup.ts`).
- `src/lib/fileId.test.ts` — the shared ID formatter (token substitution, padding,
  unknown-token passthrough).

## Suggested next tests

- Server: documents upload validation (bad MIME/extension/size), assign/forward officer
  belongs-to-department check, duplicate detection, dashboard aggregation numbers,
  import dry-run error report.
- Client: `LoginPage` validation, `RequestCreatePage` step gating, `CascadingLocationPicker`
  clearing children on parent change, `MasterCrudPage` create/edit flow (with MSW).
- **E2E (Playwright)** for the critical flow in the master spec: admin login → create
  department/ward/GP/village → create user → create request → scan+attach → submit →
  assign officer → officer remark + status change + response upload → MLA closes →
  audit trail present.
