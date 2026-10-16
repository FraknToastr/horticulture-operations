# EVT Register dates, identity and status guidance

Implemented locally on 16 October 2026. No commit or publication was requested.

## User workflow

- EVT Delivery Details now contains Event Bump-in and Event Bump-out. Either date may be blank; both may be the same day. Bump-out cannot precede bump-in. Invalid edits show an inline message and do not replace the saved dates.
- Each saved date appears as a separate all-day calendar reference in Scheduler Week and Month views. This event and All events scopes include these entries, even without a delivery Project. Select an entry to return to its Register record and edit the date there.
- References have no drag handles, crew assignment, costs, operational job counts, conflict warnings or status effects. Clearing a date removes its reference. Calendar entries are derived from saved dates, so reloads and imports cannot create duplicate persisted jobs.
- EVT shows a read-only Event ID and an optional editable Council Event Number. The Council number is initially blank when migrating legacy records.
- Register's Status guide button explains the current module's complete application-level status vocabulary, including Cancelled and Review required, with its existing transition rules. It does not change the status engine.

## Data compatibility

- Event record `id` remains the relationship key. No Projects, geometry, jobs, quotes or audit records are rekeyed.
- The new `eventAuditId` preserves a unique legacy reference where available; missing, duplicate or conflicting references fall back to the stable record ID. Versioned `eventIdentityMigration` metadata retains original references and the assignment decision. Assigned Event IDs are immutable.
- Later imports are checked against legacy references retained by already migrated Events. Nested legacy work objects are preserved, never converted to identifier strings.
- `councilEventNumber`, `bumpInDate` and `bumpOutDate` are EVT-only editable fields. Dates are ISO date-only values. JSON and workspace bundle transport retains the new fields and identity metadata.
- New budget postings capture Event ID rather than Council Event Number. Existing historical postings remain unchanged.
- NSA's fields, receipt identifiers and calendar behaviour remain unchanged, apart from its new application status guide. Overtime is untouched.

## Verification

Focused model checks cover identity migration, duplicate and later imports, immutable IDs, valid dates, date order and clearing, transport, status definitions, calendar dates and budget audit references. Desktop browser checks cover Register editing, read-only IDs, inline errors, no-Project navigation, Week/Month scope, reload, source navigation, operational-job coexistence, NSA isolation, status-guide keyboard access and existing shortcuts.

No screenshot or mobile-device tests were run. An existing drawer-position test asserted before its animation finished; it now waits for the same one-pixel alignment requirement before asserting. Focused checks passed after that correction.
