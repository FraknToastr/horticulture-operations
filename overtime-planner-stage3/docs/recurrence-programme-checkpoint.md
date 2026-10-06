# Recurrence and cross-year programme checkpoint — 6 October 2026

Implementation phase complete in the independent Stage 3 application. The active standalone `index.html` has been rebuilt from `index.modular.html` and its local modules. No GitHub update, branch change, workspace wipe or operator-data migration was performed.

## Delivered

- One canonical recurrence engine shared by validation, editor preview, scheduling and rostering.
- A cadence selector available in every editor mode; Multiple Days is no longer a one-way choice.
- Explicit annual dates (month/day or nth/last Saturday/Sunday), with no hidden February default. Ineligible dates and February 29 in non-leap years are skipped, not moved.
- Annual seasonal series with inclusive month/day boundaries, cross-year seasons, a week-phase anchor, selected operating days and an optional occurrence limit per season.
- Inclusive-date and occurrence-count end conditions. Counts apply to individual staffable dates; January does not reset a continuous series.
- Strict operating dates: weekends and recognised Friday/Monday public holidays. Ordinary Fridays/Mondays and Tuesday–Thursday dates cannot become live operational shifts. Historical snapshot records remain retained.
- Programme start/end controls in the application header. Forward Planner and Overtime Calendar show the continuous horizon rather than separating December and January. Calendar-year mode remains available.
- Date-based weekend identity, deduplicated cross-year shifts and preserved programme settings when allocations are committed.
- New recurrence fields included in job CSV exports, cache signatures, scheduling-change guards and workspace validation.
- Writer-session protection and the existing canonical commit/rollback path for programme changes.
- Existing Job Reset actions, typed confirmation and CSV dropzone preserved.

The editor uses the existing application's layout, colours and controls; it has explicit accessible field names.

## Verification on the final rebuilt app

- `node scripts/test_recurrence_programme.cjs`: PASS. Checks canonical dates, explicit annual rules, holiday restrictions, seasonal/count continuity, visible editor interactions, November 2026–February 2027 programme controls, Sunday New Year weekend identity, fixed allocations spanning January, reload persistence, validation/storage failures and released-writer rejection. Failed saves preserve workspace domains and exact stored bytes; transient storage-error indicators may update.
- `node scripts/test_job_reset.cjs`: PASS. Both scopes, typed-confirmation gating, retained history, unrelated jobs and failure/writer safeguards.
- `node scripts/test_import_dropzone.cjs`: PASS.
- `node scripts/test_static_release.cjs`: PASS. All 82 JavaScript files parse; no undeclared helper identifiers.
- Final `npm test`: **21/24 suites passed; release result FAILED**. All seven Stage 2 acceptance suites passed. Scheduler, strict Gregorian-date validation, rostering lifecycle and retained browser smoke passed.

The remaining retained-suite failures must be resolved before a full release clearance:

1. `test_persistence.cjs` expects a subsequent save of an ordinary Friday one-off (`2026-07-10`) to succeed.
2. `test_rostering_engine.cjs` expects ordinary Friday `2027-12-31` to materialise for its NYE boundary/cache fixtures.
3. `test_multi_year_differential.cjs` expects generated 2025 occurrences from jobs whose explicit starts are in 2026.

Those expectations conflict with the new operating-date/start-boundary contract. They are not waived or silently skipped. A follow-on verification phase needs eligible, coherent replacement fixtures while retaining their persistence, cross-year rest, cache-invalidation and multi-year assertions.

## Operator entry points

In Job Registry, open Add/Edit Job and use **Frequency Cadence**:

- **Annual date** for one explicit annual date rule.
- **Annual seasonal series** for a season repeated yearly, including November–February.
- **Multiple days / public holidays** for selected weekly operating dates or a consecutive eligible run.

Set **Programme starts** and **Programme ends** in the header, then select **View programme**. For the primary acceptance scenario use `2026-11-01` through `2027-02-28`.

Stop at this checkpoint as required by repository governance. This is not a claim of complete release clearance.
