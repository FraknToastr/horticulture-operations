# Implementation checkpoint — 12 September 2026

The guarded-status sanitation and Register lifecycle-modal work is saved in this project workspace. No implementation source or test depends on `/tmp`.

## Completed changes

- One-time, idempotent Register baseline sanitation retains NSA and Event records whose received/lodgement date is on or after `2026-07-01`, purges undated/invalid/pre-cutoff records, clears related operational artifacts, resets retained records to canonical `received`, records `Status engine` audit events, and stores a durable sanitation marker.
- New blank workspaces are marked as already sanitised, so later creation or import of pre-cutoff records remains supported and is not retrospectively purged.
- Manual NSA/Event registration and NSA PDF import establish canonical `received`; Event `dateReceived` is retained.
- Governed Lifecycle is removed from the inline Register Status History area and opened from a stable drawer-level launcher in a hidden native modal.
- Lifecycle, operator, and transition dialogs support Cancel/Close/Escape with per-dialog focus restoration; status reasons remain modal-only.
- NSA Register deletion cascades its governed status audit/recommendation records.

## Verification at pause

- `npm test`: 15/15 passing.
- Playwright functional Chromium suite: 12/12 passing.
- No screenshot tests or screenshot comparisons were used.
- Syntax checks pass for all five modified application JavaScript files.

## Principal files

- `src/program-planner/js/status-model.js`
- `src/program-planner/js/app.js`
- `src/program-planner/js/status-ui.js`
- `src/program-planner/js/register.js`
- `src/program-planner/js/data-workspace.js`
- `src/program-planner/status-v5.css`
- `tests/workspace-sanitation.test.cjs`
- `tests/browser/workspace-sanitation.spec.js`
- `tests/browser/lifecycle-regressions.spec.js`
- `tests/browser/lifecycle-modal-dismissal.spec.js`

## Follow-up UI regression fixes

- The Location module now starts in the pinned-record view. Register scope changes select the matching spatial-filter default; once the user clears that filter, the clear state remains available until the scope changes.
- Filtering out the currently selected Register record clears the selection and renders the filtered result immediately, rather than leaving stale row cards visible.
- The read-only Status History timeline is visible in Register row accordions again. Lifecycle commands remain in the modal and recorded reason narratives remain behind their reason controls.
- Added `src/program-planner/js/register-history-ui.js` and functional browser coverage in `tests/browser/location-filter.spec.js`.
- Latest verification: `npm test` 15/15; Playwright functional Chromium suite 13/13. No screenshot tests or screenshot comparisons were used.

## Empty operational baseline follow-up

- NSA and Events now apply independent one-time `empty-operational-baseline-2026-09-12` resets on first launch after this release.
- The reset destroys active operational entities, status audit/recommendation records, UI selections, user reference records, and migration/recovery payloads. It then installs only the source-controlled global Rate Catalog.
- The default catalog contains 45 unique rates from `horticulture-program-workspace-20260820-v2-repaired`: 42 active and 3 inactive, including the original zero-priced entries and provenance identifiers.
- Startup reads the raw canonical revision before resetting, allowing corrupt legacy business records to be replaced by a valid baseline instead of blocking initialization.
- New blank workspaces already carry the reset marker. Workspace adoption preserves the local marker, so compatible imports and later manually created records are not erased on reload.
- The July 2026 cutoff sanitation and schema-v2-v4 compatibility code remain present but are no longer the active startup baseline.
- Portable runtime support accepts an optional static-server root argument; `package.portable.json` and `README_RUN.txt` define a dependency-free Node 18+ launch.

### Verification after empty-baseline implementation

- `npm test`: 18/18 passed.
- Functional Chromium Playwright suite: 15/15 passed.
- NSA and EVT reset, invalid stored-state recovery, revision idempotency, post-reset persistence, import-marker preservation, Rate Catalog counts, lifecycle dialogs, status history, deletion, and Location filtering passed.
- No screenshot tests, screenshot captures, or visual snapshot comparisons were used.
- Portable package: `Horticulture-Operations-Suite-v5.0.0-portable.zip` (71 files, 1,049,400 bytes, SHA-256 `bf1382f09f7dca46e5dacd2199cf6dc108ae66c12e20d154c62d68fc9a6d18fa`).
- ZIP integrity passed. A clean `/tmp` extraction started with `npm start` and returned HTTP 200 for the launcher, NSA, Events, default Rate Catalog, and PDF worker routes.

## Location map interaction fix — 13 September 2026

- Fixed an infinite map-state feedback loop affecting unpinned Register records under the default Location filter.
- An explicitly cleared `workspace.map.selectedRegisterId` is now authoritative and no longer falls back to the stale global `workspace.selectedEntityId`.
- The Location module settles after its finite navigation updates; Location, No Location, filter Reset, search, cards, and map interaction remain available.
- Added a functional regression that verifies the event stream stops, the filter can be cleared/reset, unpinned records reappear on demand, pinned-only filtering still works, and search accepts input.
- Verification: `npm test` 18/18; functional Chromium Playwright 15/15. No screenshots were taken or compared.

## Location baseline correction — 13 September 2026

- User evidence showed the prior map fix still opened with a forced Location filter, badge `1`, and visible clear control. The earlier completion statement was therefore broader than the verified behavior.
- “Mapped Records” is now the unfiltered semantic baseline: pinned Registers and polygon Projects are shown without activating a Location/Polygon pill.
- Initial and Reset state now have both spatial pills unpressed, badge hidden, and clear control hidden. Unpinned records remain excluded from the baseline and are available through the explicit No Location filter.
- Independent and suite verification confirmed a stable event stream, zero initial active filters, No Location activation, Reset restoration, pinned-record display, search input, and no browser errors.
- Verification remains `npm test` 18/18 and functional Chromium Playwright 15/15, with no screenshot tests or captures.

## Register status-history, first-PDF preview and Quoted guard — 13 September 2026

- Register drawers again show the canonical Status History for NSA and EVT records. Legacy history remains readable only when canonical events are unavailable; legacy add/delete mutation controls remain hidden.
- Governed Lifecycle is no longer a standalone drawer control. A compact `Review` button in the Status History heading opens the existing governed modal with its Cancel/Close/Escape and focus-restoration behaviour intact.
- Fixed the first NSA PDF preview delta. The schema-v5 blank-workspace Rate Catalog is no longer misreported as 45 replacement conflicts; a valid first A3330 PDF import stages with zero warnings and conflicts, creates one received Register and one received status event, and retains all 45 rates.
- `Quoted` is no longer exposed as a human Register transition. Direct human or forged automatic commands fail without a revision change. Automatic progression requires the triggering highest/current issued Quote linked to the Register through its Project.
- Browser cache keys were advanced for the status history UI, status policy, and PDF import delta.
- Current verification: `npm test` 21/21 and functional Chromium Playwright 17/17. No screenshot tests or captures were used.

## Register drawer and Location context isolation — 13 September 2026

- Opening another Register row now atomically rebases the shared module context to that Register before mounting it in the new outer drawer. Stale Register, Project, location and geometry selections are cleared rather than inherited.
- The Location singleton is parked during a Register handoff and cannot remount the prior Register through a MutationObserver race or briefly reinterpret the transition as global browsing.
- In a Register drawer, Location renders exactly one full, non-collapsible card for the active NSA or EVT Register, including the zero-pin state. The Add pin control is immediately visible; Move/Remove remain conditional on an existing pin.
- Global/standalone Location browsing remains available outside a Register-mounted module.
- Module drawers now match the full module-host height instead of clipping the Location workspace, and permanently expanded cards are exempt from generic hidden-until-disclosure styling.
- Manual NSA and EVT creation seeds the new Register as the canonical Location context.
- Functional coverage includes A3330 → unpinned new Register isolation, stale lineage clearing, visible Add pin, full-height containment, NSA/EVT manual creation, permanent cards and the existing filter/flicker regression.
- Current verification: `npm test` 21/21 and functional Chromium Playwright 20/20. No screenshot tests or captures were used.
