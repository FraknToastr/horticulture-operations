# NSA/EVT funding and interface refinements — 18 October 2026

Completed locally after Stage 5. This follow-up does not regenerate or alter the
historical Stage 5 report/evidence. No commit or push was performed.

## Changes

- New NSA Quotes default to **Council** (`city`); new EVT Quotes remain
  **Customer**. The model and editor share the owner-aware default. Explicit
  saved choices and legacy unselected Quotes are preserved. Customer-specific
  receipt fixtures now choose Customer explicitly rather than relying on an
  implicit NSA default. Financial eligibility and immutable history protections
  remain unchanged.
- Both rendering paths use the same compact navigation control: 28px desktop
  buttons, 16px outline SVG magnifying-glass icons and a Home button. The group
  sits 10px inside the map's top-right corner. Home uses the existing sidebar
  Home behavior (configured default centre and zoom), with keyboard support.
  Coarse pointers retain 44px targets. No renderer/vendor bundle or dependency
  was replaced.
- Main-header app and active-module titles are now 26px within the existing 32px
  accent/line height. Tests measure actual glyph ascent/descent, including
  descenders, using both the standard font and OpenDyslexic.
- Status Guide/lifecycle dialog frames use the same bounded height as their
  outer dialog, leaving the inner content as the sole scrolling region. The EVT
  guide's header, footer, close controls and focus return remain accessible.
- Affected stylesheet/script version URLs were updated in the shared app page.

## Verification

**121 focused model checks passed** across the directly affected funding and
consumer selections. [Model evidence](model-results.json) records exact commands,
counts and earlier fixture corrections; successful tests were not repeated just
to capture raw output.

**16 distinct desktop browser checks passed**: 14 header/guide/funding/first-click
cases in the retained main run, then two map cases on forced Three WebGL2 and
native MapLibre. The map-only rerun checked size/inset, SVG controls, zoom changes,
keyboard Home and unchanged spatial records. The main run exposed the global
44px minimum width; the map-specific minimum is now 28px on desktop. Only those
two map cases were rerun after that amendment.

The initial header test needed a selected synthetic Register/Project before
normal Planner navigation. Its corrected setup uses the normal application
workflow. Earlier results are retained, rather than represented as first-pass
success. A new test's arrow-function syntax was corrected during discovery,
before any application test execution.

No screenshots, mobile/device, touch, video or trace tests were run. Source
syntax and whitespace checks passed. The desktop configuration retains the
runtime guard, one worker, no retries and a fresh loopback server.

```sh
rtk proxy node node_modules/@playwright/test/cli.js test --config=docs/ui-refinements-2026-10-18/playwright.config.cjs
rtk proxy env PLAYWRIGHT_JSON_OUTPUT_FILE=docs/ui-refinements-2026-10-18/map-browser-results.json node node_modules/@playwright/test/cli.js test --config=docs/ui-refinements-2026-10-18/playwright.config.cjs map-navigation-refinements.spec.js
rtk proxy node docs/ui-refinements-2026-10-18/record-results.cjs
rtk proxy git diff --check
```

See [structured results](results.json), [main run](browser-attempt-2.json) and
[map-only results](map-browser-results.json). This is local desktop verification,
not certification of a subsequent GitHub Pages deployment. Overtime, original
sample workspaces, shipped vendor files and unrelated local edits are preserved.
