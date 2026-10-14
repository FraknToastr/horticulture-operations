# Explicit NSA readiness audit

These scripts test the published NSA app in **new, isolated browser contexts**.
They never attach to an existing working browser profile. `faults-and-restart.cjs`
also creates a uniquely named temporary Edge profile containing the original
converted dataset. Dangerzone is destructive only inside disposable test contexts.

The private input file is deliberately not bundled or published:
`src/sample/nsa-workspace-2026-27-area-pricing-v5.json`.
Do not substitute a different file without updating the baseline and test oracle.

Use the repository's existing Playwright package. Linux execution:

```sh
rtk proxy node tests/readiness/workspace-readiness.cjs
```

Windows Edge execution from WSL uses `run-edge.ps1`. It copies only NSA source,
fixtures and the existing Playwright packages into a dedicated Windows temporary
directory. The installed VS Code Electron Node runtime runs the tests on Windows;
no global installation or working browser profile is required. The optional
`-Suite`, `-Output` and `-Only` parameters select a script, result subdirectory and
comma-separated scenario IDs. Default suite: `workspace-readiness`.

Other suites: `demo-rehearsal`, `faults-and-restart`, `live-and-quota`, `verify-report`.
The connected financial rehearsal should run as a complete sequence. Targeted
reruns must include their setup scenarios; a missing prerequisite is a harness
limitation, not an application failure.

`build-report.cjs` generates Markdown, standalone HTML and a shared JSON result
model from the completed evidence directories. Its explicit result selection
records the final valid run of each scenario; it does not silently turn failures
into passes. The raw earlier attempts remain local for audit. The report records
the first-use revision defect even though later checks use its reload workaround.

All reports, backups, screenshots, private data and raw logs are under the existing
Git-ignored `test-results/nsa-demo-readiness/` directory. Never publish them without
review. The final reports do not embed client workspace payloads or backup contents.

These scripts are outside the normal `tests/browser` discovery directory and
are not part of routine test runs. They do not change application source or publish
to GitHub. An explicit separate publication request is required for a later fix.
# Focused navigation revision correction

## Quote interaction correction

Run the browser specs `quote-first-interaction.spec.js` and
`quote-payment-funding-workflow.spec.js` with
`--output=test-results/quote-focused`. The first-click test uses physical
pointer gestures, including a Quote redraw between down and up, and checks
scroll position, reason validation, focus and recovery after reload.

The Windows runner accepts `-Suite quote-file-edge -Output quote-file-edge`.
It refreshes the isolated source copy and tests NSA and EVT through file URLs.
It never opens the user's working browser profile.

`record-quote-correction.cjs` appends the successful focused results to both
readiness reports while retaining the original public-build baseline.

Run `node tests/readiness/navigation-revision-fix.cjs` for the five focused
local-source scenarios. The Windows runner accepts
`-Suite navigation-revision-fix -Output local-fix-edge` and refreshes its
source copy before serving it. NSA uses the local latest converted dataset;
EVT uses an explicitly exported synthetic EVT fixture.

For Playwright regressions, always supply an isolated output directory, e.g.
`--output=test-results/focused-revision-regressions`. The default Playwright
output cleanup otherwise removes the readiness evidence directory.

`node tests/readiness/record-local-correction.cjs` adds correction evidence
to preserved baseline reports without rerunning unrelated suites or replacing
the published baseline outcomes.
