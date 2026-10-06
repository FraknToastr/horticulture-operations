# Header layout correction — 6 October 2026

Owner resumed a bounded presentation correction after the programme controls stretched the emerald navigation header and rendered low-contrast labels.

## Changed

- Removed calendar-year and programme controls from the global action-button cluster.
- Restored a compact emerald navigation/branding/action strip using the existing design vocabulary.
- Placed period selection in a separate light-coloured context bar with readable inline labels, fixed-size date controls and bounded year-selector width.
- Added deliberate responsive rows below 1500px and compact wrapping below 760px. Persistence health remains visible at narrow widths.
- Rebuilt the active standalone `index.html` and distribution output through the normal build.
- No recurrence, allocation, storage or writer-session semantics changed.

## Verified

- `node scripts/test_header_layout.cjs`: PASS at 2048, 1440, 1280, 768 and 390px. Desktop navigation height remains below 80px, dates stay on one line at 2048px, no controls overflow, and programme/year-view actions work.
- Visually inspected real Chromium screenshots at 2048, 1280 and 390px.
- `node scripts/test_recurrence_programme.cjs`: PASS against the final rebuilt app.
- `git diff --check`: PASS.

This is a header-only checkpoint, not a new full-release clearance. The three retained-suite failures documented in `recurrence-programme-checkpoint.md` remain unresolved. No GitHub publication or operator workspace change was performed. Stop here pending further owner direction.
