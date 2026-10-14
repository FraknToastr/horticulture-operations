# NSA/EVT readiness snapshot

Open [the standalone interactive report](nsa-demo-readiness-report.html) in a
browser, or read [the Markdown report](nsa-demo-readiness-report.md).
The HTML contains its own styles, scripts, results and evidence image and works
offline. The structured summary is in [readiness-data.json](readiness-data.json).

These are verification snapshots taken before this publication. Statements
about the public build being unchanged describe the time of testing. Publishing
the fixes does not certify a later deployed build or replace the outstanding
headed demonstration rehearsal. Original public-build failures remain recorded;
local correction results are shown separately.

## Included demonstration files

- Latest converted and area-pricing-repaired workspace:
  [nsa-workspace-2026-27-area-pricing-v5.json](../../src/sample/nsa-workspace-2026-27-area-pricing-v5.json).
  Import it through the NSA Settings workspace import. It contains 12
  applications, 2 projects, 50 tasks and 54 rate items. This is the converted
  source dataset, not a test-mutated workspace.
- Conversion provenance:
  [area-pricing report](../../src/sample/nsa-workspace-2026-27-area-pricing-report.json).
- Moasure example:
  [North Terrace 6.csv](../../src/MOASURE/North%20Terrace%206.csv).
  The browser-test copy is [north-terrace-6.csv](../../tests/fixtures/moasure/north-terrace-6.csv).

Use an isolated demonstration profile when importing or demonstrating permanent
deletion. The report's Windows profile paths and raw evidence links refer to the
original operator's local test environment, not files supplied by this repository.
Raw browser profiles, recovery exports, logs and screenshots are not included.

## Focused verification

The test sources are in [tests/readiness](../../tests/readiness/README.md).
Run Playwright with a dedicated output directory; its default output cleanup
must not remove unrelated readiness results.

The report verifier accepts this directory as the report source when the local
test-results copy is absent. Regeneration scripts consume locally generated
test results; published snapshots do not require regeneration to view.
