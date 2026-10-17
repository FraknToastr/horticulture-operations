# Stage 1 checkpoint — complete, stopped

Stage 1 aligned obsolete browser tests and added a guarded desktop release
selection. Application runtime code was not changed. Work is on `main`, tracking
`origin/main`, based on commit `8545d675921297349123e9828e62035981d34889` plus the
existing local edits. Nothing was committed or pushed.

## Changes

- MetroMap tests use manual key entry and assert the absence of Paste. Credential
  exclusion from exports, storage failure handling, activation labels and the
  unfinished drawing/camera/controller preservation checks remain covered.
- NSA/EVT inspector tests now explicitly verify full → summary → minimal → full.
  Summary retains three rows and six tools; minimal retains the summary header and
  Job Type value. The drawer is hidden at both collapsed levels. Vertex controls
  are used only after reopening full. Undo, card identity and saved-geometry
  protection checks remain in place.
- Budget lifecycle verification ends at desktop size. Its narrow-layout assertion
  is retained in a separate mobile test file, which was syntax-checked but not run.
- `test:release:desktop` uses reviewed file/title selections. It disables and
  guards against screenshots, mobile/touch, video, traces and persistent profiles.
  It rejects an occupied server port rather than reuse an unknown server.

## Verification

Target: local HTTP, desktop Chromium, Node v22.23.2, Playwright 1.62.0,
Google Chrome for Testing 151.0.7922.34. Disposable browser contexts and synthetic
data were used; no operator profile was opened.

| Check | Result |
| --- | --- |
| Desktop Budget workflows, including approval, persistence, closure and reopen | 7 passed |
| MetroMap manual input, export/draft safety, storage failure and NSA/EVT labels | 4 passed |
| NSA/EVT inspector collapse cycle, vertex edits and Undo | 2 passed |
| Desktop guard and mixed-file selection unit checks | 2 passed |
| Desktop selection inspection | 43 model files; 136 browser cases listed, not all executed |
| Separate mobile Budget file | Syntax check passed; execution excluded |
| Protected source and original audit | 210 file hashes unchanged |
| Excluded media attachments | 0 |
| `git diff --check` | Passed |

Exact verification commands, from the repository root:

```sh
rtk proxy node --test tests/desktop-release-policy.test.cjs
rtk proxy node scripts/run_desktop_release_gates.cjs --list
rtk proxy env PLAYWRIGHT_JSON_OUTPUT_FILE=docs/remediation/nsa-evt-release-2026-10-17/stage-1-browser-results.json node scripts/run_desktop_release_gates.cjs --batch metromap --batch inspector --batch budget
rtk proxy env PLAYWRIGHT_JSON_OUTPUT_FILE=docs/remediation/nsa-evt-release-2026-10-17/stage-1-inspector-results.json node scripts/run_desktop_release_gates.cjs --batch inspector
rtk proxy node --check tests/browser/budget-mobile-layout.spec.js
rtk proxy git diff --check
```

The first browser run passed Budget and MetroMap, then stopped on a strict-selector
error in a newly added inspector assertion: `header` matched both the summary and
vertices headers. The assertion was corrected to target the summary header; the
hidden-label assertion also checks all labels without a multi-element ambiguity.
Only the two inspector cases were rerun; both passed. The first attempt is retained
in the evidence, with its failure and unrun EVT case, rather than overwritten.

Machine-readable details:

- [Latest results and source hashes](stage-1-results.json)
- [Exact desktop selection](stage-1-selection.json)
- [First browser attempt](stage-1-browser-results.json)
- [Final inspector run](stage-1-inspector-results.json)
- [Guard unit test output](stage-1-policy-tests.tap)
- [Preservation verification](stage-1-preservation-results.json)

## Gate limits and remaining work

The focused owner regressions and desktop Budget checks pass. This is not a new
production release certification: the original audit remains **UNVERIFIED** and
immutable. Unrelated passing suites were not rerun. Mobile, screenshots, touch,
video, traces, published GitHub Pages and Edge `file://` were not tested.

Stages 2–5 remain open: canonical receipt eligibility, the 57 workspace warnings,
vendored dependency assessment, then governance/reversal attribution and bounded
CSS cleanup with final Markdown and interactive HTML reports.

**Stop here for quota management. Next stage: Stage 2, canonical receipt eligibility.**
The [accepted plan](README.md) preserves the agreed scope and decisions.
