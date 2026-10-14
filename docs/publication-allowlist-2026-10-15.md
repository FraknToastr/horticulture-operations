# Publication allowlist — 15 October 2026

This update preserves origin/main, including its existing launcher-title edit.
It publishes the completed NSA/EVT workspace revision and Quote interaction
corrections. Overtime is unchanged.

## New or modified transport files

- src/program-planner/js/app.js
- src/program-planner/js/card-visibility.js
- src/program-planner/js/quote-builder.js
- src/program-planner/js/register.js
- src/program-planner/js/status-ui.js
- src/sample/nsa-workspace-2026-27-area-pricing-v5.json
- src/sample/nsa-workspace-2026-27-area-pricing-report.json
- tests/browser/quote-first-interaction.spec.js
- tests/readiness/: test/verification scripts, runner, report template and README only.
- docs/readiness/: standalone HTML report, Markdown counterpart, structured
  report summary and README only.
- This publication allowlist.

Already tracked and retained: src/MOASURE/North Terrace 6.csv and
tests/fixtures/moasure/north-terrace-6.csv.

## Exclusions and review

Exclude the unrelated modified H2 screenshot, Overtime research and roster
directories, older converted workspaces, original operator exports, conversion
scratch tools, review ZIPs, Windows metadata streams, raw test results and
browser profiles.

Review the complete proposed Git tree and Overtime path history before pushing.
Existing Overtime source, governance/change reports and test scripts are retained;
this update introduces no Overtime files or historical archives and does not
rewrite existing history. The included readiness report is a pre-publication
verification snapshot, not proof of a subsequent deployment.
