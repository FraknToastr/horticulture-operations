# NSA/EVT publication allowlist — 9 October 2026

Destination: local `overtime-stage3` → `origin/overtime-stage3`. No update to `main` or `github-replacement`.

The complete current Git tree and reachable branch history were inspected before staging. This publication adds NSA/EVT source, self-contained tests and necessary audit documentation only. No new Overtime content is included. Existing remote history and legacy Overtime evidence/logs are unchanged; those artifacts must be addressed under the transport policy before a future Overtime publication. No remote deletions or history rewrite is authorized by this update.

Customer backups, recovered workspaces, conversion reports, backup-dependent recovery tools/tests, PDFs, rosters, operator exports, screenshots, local Moasure files, caches, test outputs and unrelated legacy Overtime edits remain local. Do not use a blanket `git add .` for this publication.

## Reviewed source transport set

### Space Map, area pricing and Moasure update

Destination remains `overtime-stage3` → `origin/overtime-stage3`; `main` and
`github-replacement` are not updated. The complete current tree and reachable
history were rechecked. Existing remote Overtime history remains unchanged;
this update adds no Overtime content, evidence or operator exports.

The explicit transport allowlist for this update is:

- `docs/publication-allowlist-2026-10-09.md`
- `src/program-planner/index.html`
- `src/program-planner/js/costing-model.js`
- `src/program-planner/js/costing.js`
- `src/program-planner/js/default-rate-catalog.js`
- `src/program-planner/js/disclosure-rows.js`
- `src/program-planner/js/model.js`
- `src/program-planner/js/program-map.js`
- `src/program-planner/js/work-area-service.js`
- `src/program-planner/styles.css`
- `src/remediation-planner/js/map.js`
- `tests/browser/c6-work-type-rate-mapping.spec.js`
- `tests/browser/delete-warning-audit.spec.js`
- `tests/browser/nsa-pdf-import.spec.js`
- `tests/browser/polygon-job-promotion.spec.js`
- `tests/empty-operational-baseline.test.cjs`
- `tests/governed-remediation.test.cjs`
- `tests/nsa-pdf-import-preview.test.cjs`
- `src/program-planner/js/moasure-geometry.js`
- `src/program-planner/SPACE-MAP-MOASURE.md`
- `tests/area-pricing.test.cjs`
- `tests/moasure-geometry.test.cjs`
- `tests/helpers/area-pricing-suite.cjs`
- `tests/fixtures/moasure/north-terrace-6.csv`
- `tests/browser/area-pricing.spec.js`
- `tests/browser/map-drawing-lifecycle.spec.js`
- `tests/browser/map-reimport-focus.spec.js`
- `tests/browser/moasure-map.spec.js`
- `tests/browser/polygon-inspector-editing.spec.js`

Includes polygon drawing/focus fixes, canonical m²/ha pricing, project-linked
Moasure imports, persistent anchor controls, consistent Inspector actions and
cancellable vertex edits. The CSV under `tests/fixtures/moasure/` is a
self-contained local-coordinate test fixture; original files under
`src/MOASURE/` remain local. Customer backups, conversion reports, backup-dependent
recovery tools/tests, screenshots, generated results and unrelated Overtime
changes are excluded. No remote deletions or history rewrite are performed.

### Subsequent Quote navigation update

The subsequent Quote-only commit uses this explicit allowlist:

- `src/program-planner/index.html`
- `src/program-planner/styles.css`
- `tests/browser/quote-section-navigation.spec.js`
- `docs/publication-allowlist-2026-10-09.md`

This update removes the divider accents, fills the rail with six equal-width/full-height buttons, and increases labels to 14px. The complete tree and reachable history were rechecked; no new Overtime files, operator data or test outputs are transported. Destination remains `origin/overtime-stage3`; other branches and previously noted legacy evidence remain unchanged.

### Initial NSA/EVT update

- `docs/nsa-evt-delete-audit.md`
- `docs/publication-allowlist-2026-10-09.md`
- `src/program-planner/index.html`
- `src/program-planner/js/costing.js`
- `src/program-planner/js/data-settings.js`
- `src/program-planner/js/delete-safety.js`
- `src/program-planner/js/drawer-workspace.js`
- `src/program-planner/js/planner-presentation.js`
- `src/program-planner/js/planner.js`
- `src/program-planner/js/program-map.js`
- `src/program-planner/js/quote-builder.js`
- `src/program-planner/js/register.js`
- `src/program-planner/js/scheduler.js`
- `src/program-planner/planner-row-header.css`
- `src/program-planner/register-row-header.css`
- `src/program-planner/styles.css`
- `src/shared/js/import-targets.js`
- `tests/browser/c4-browser-acceptance.spec.js`
- `tests/browser/calculator-headers-quote-position.spec.js`
- `tests/browser/calculator-line-deletion.spec.js`
- `tests/browser/delete-warning-audit.spec.js`
- `tests/browser/draft-quoted-cost-deletion.spec.js`
- `tests/browser/drawer-viewport-floor.spec.js`
- `tests/browser/framed-table-emphasis.spec.js`
- `tests/browser/planner-current-state.spec.js`
- `tests/browser/planner-scheduler-visual-and-delete.spec.js`
- `tests/browser/planner-section-headers.spec.js`
- `tests/browser/planner-task-editor.spec.js`
- `tests/browser/register-framed-layout.spec.js`
- `tests/browser/register-row-header-regressions.spec.js`
- `tests/browser/register-shortcut-states.spec.js`
- `tests/browser/scheduler-calendar-scope.spec.js`
- `tests/delete-safety.test.cjs`
- `tests/workspace-import-signature.test.cjs`

### Space Map radial creation and approval controls

Destination: `overtime-stage3` to `origin/overtime-stage3`. Neither `main` nor `github-replacement` is updated.

The complete branch tree and reachable history were reviewed. Existing remote history contains legacy review archives, evidence files and logs; this NSA/EVT-only update leaves that history unchanged and publishes no Overtime changes. No remote deletion or history rewrite is authorized.

The reviewed transport set is:

- `docs/publication-allowlist-2026-10-09.md`
- `src/program-planner/index.html`
- `src/program-planner/styles.css`
- `src/program-planner/space-map-editor.css`
- `src/program-planner/js/program-map.js`
- `src/remediation-planner/js/map.js`
- `src/shared/assets/moasure_logo.avif`
- `tests/browser/test-helper.cjs`
- `tests/browser/space-map-editor.spec.js`
- `tests/browser/space-map-radial.spec.js`
- `tests/browser/space-map-draft-actions.spec.js`
- `tests/browser/area-pricing.spec.js`
- `tests/browser/delete-warning-audit.spec.js`
- `tests/browser/floating-draw-toolbar.spec.js`
- `tests/browser/location-filter.spec.js`
- `tests/browser/map-drawing-lifecycle.spec.js`
- `tests/browser/moasure-map.spec.js`
- `tests/browser/polygon-inspector-editing.spec.js`
- `tests/browser/polygon-job-promotion.spec.js`
- `tests/browser/register-drawer-context.spec.js`
- `tests/location-polygon-sidebar.test.cjs`

Only Space Map hunks of the shared HTML and stylesheet are included. Unrelated Quote, Register, Planner and Overtime edits, local Moasure source files, backups, reports, rosters, screenshots and test outputs remain local. The logo asset is included at its shared location; it was not previously tracked at its original local path.

Validation includes creation, pin operations, vertex edits, Moasure, pricing, job creation, drawer layout, branch angles, orb-edge connectors, both themes and narrow screens. Verification is repeated against the staged source tree before publication.

Staged-tree verification passed: 68 focused browser regressions and all 29 included unit checks. Tests ran from an isolated export of the Git index on a separate local server; the export excludes unstaged local recovery tests and operator data. Generated logs and previews remain outside the transport set.
