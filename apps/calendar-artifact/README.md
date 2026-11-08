# MLA Office Calendar (Claude artifact)

Standalone calendar for the Davanagere South MLA office. Published as a Claude
artifact: https://claude.ai/artifact/K3PqppEspCaBeDPYBMxL2q
(slug `921a0f67-e565-4c4b-9041-869744496cee`).

- `client/` - React + MUI app (same theme as the mla-fms office app).
  `npm run build` produces ONE file, `client/dist/index.html`, which is what is
  published to the artifact.
- `shared/src/calendar.ts` - event types / colour code and the repeat-rule
  maths. Identical to `shared/src/calendar.ts` in the main mla-fms app.

## Data
Events live in the artifact's own database, collection `events`, one document
per event:

    title, description, type, status, start, end (ISO), allDay,
    recurrence, recurrenceUntil, venue, area, organizer, contactName,
    contactPhone, attendees[], createdBy, createdAt, updatedBy, updatedAt

Default access rules: everyone the artifact is shared with can view;
Contributors and above can add/edit/delete.

## Integrating into the main app later
The main app already has the same calendar module (Calendar menu) with the same
types and field names (except `area` -> `wardId`/`gramPanchayatId`). To move
over: export the artifact's events (Claude can read them with the artifact
database tools, or use Export -> .ics) and import them into the main app's
`CalendarEvent` collection, then point people to the main app's Calendar page.

## Commands
    npm install
    npm run test        # unit tests (repeats, layout, exports)
    npm run build       # -> client/dist/index.html
