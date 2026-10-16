# NSA/EVT performance and workflow audit — 16 October 2026

## Resume here

**Implementation requested and carried out on 16 October 2026.** See the [implementation and verification report](NSA-EVT-performance-workflow-implementation-2026-10-16.md) for the current checkpoint. The findings, original test failures and diagnostic appendices below describe the audited baseline and are retained as historical evidence.

This document preserves the review, evidence, test results and proposed improvement sequence so work can resume after a computer shutdown. It is self-contained; no prior conversation, temporary browser profile, /tmp script, or agent memory is required.

- Reviewed commit: a8ed6030a9bbecfcf5dbdfccb144ee8b8675311d.
- Branch: main, tracking origin/main.
- Applications: NSA and EVT within src/program-planner/, launched through src/index.html.
- MapLibre is the priority, followed by performance and business logic across Register, Planner, Resource Calculator, Quotes, payments, Scheduler, Budget and workspace persistence.
- The user requested a review and tests, not implementation of the findings.
- No application source was changed during this audit. Do not interpret this document as evidence that the defects are fixed.
- No screenshot tests or mobile-device tests were performed or are authorized for this work.
- The independent Overtime projects are outside this audit. Do not integrate their runtime, styles, dependencies or tests.
- Do not commit or push application changes without a separate user request.

Start implementation with the MapLibre readiness defect and the accumulating Cost Library observer. Treat quote eligibility and source/snapshot clarity as the next group. Repair stale tests before using them as release gates, then perform measured rendering, state and CSS refactors in small changes.

## Findings and evidence

### F1 — High priority: MapLibre removes a successfully loaded basemap

Locations:
- src/shared/space-map/renderer.mjs:103 — isSourceLoaded.
- src/remediation-planner/js/map.js:855 — confirmProviderLoaded.
- src/remediation-planner/js/map.js:907 — provider timeout.

The adapter checks its own Three.js raster tile cache even when MapLibre owns raster loading. That cache is empty under MapLibre. A native sourcedata/idle event therefore cannot clear the controller's provider watchdog.

A desktop reproduction forced the MapLibre backend and supplied valid synthetic PNG tiles. The native MapLibre source reported loaded, but the adapter reported unloaded. The controller subsequently removed the basemap when the watchdog expired. The reproduction shortened providerTimeoutMs to 1500 ms; the production default is 12000 ms.

Observed:
~~~json
{"backend":"maplibre","nativeLoaded":true,"adapterLoaded":false}
{"afterTimeout":true}
~~~

Proposed correction: delegate readiness to the native MapLibre map when present; retain the GPU tile-cache check for GPU backends. Verify the provider remains selected and present beyond its timeout after successful loading, while real failures still enter the existing offline state.

### F2 — High priority: Cost Library MutationObservers accumulate

Locations:
- src/program-planner/js/costing-accessibility.js:16–23 — bind and observer registration.
- src/program-planner/js/costing.js:289 — catalog rendering.
- src/program-planner/js/costing.js:387 — existing accessibility decoration.

Each uos:program-ready notification calls bind and attaches another MutationObserver to the catalog body. Existing observers are not reused or disconnected. Each observer can rescan the catalog after its rows change.

An isolated desktop browser counted four catalog observer bindings after initialization and seeding; six further navigations increased the count to eight.

~~~json
{"before":4,"after":8,"destinations":["costing","register","quotes","register","costing","register"]}
~~~

Proposed correction: consolidate accessible labels and tooltips into the catalog renderer, then remove the redundant post-render decorator script if all of its behavior is covered. If an observer remains necessary, retain a single owned instance and disconnect it on teardown. Preserve complete category descriptions and action labels.

### F3 — Quote Adjustment is enabled on immutable quotes

Locations:
- src/program-planner/index.html:840 — Quote Adjustment action.
- src/program-planner/js/quote-builder.js:1048 — addLineItem.
- src/program-planner/js/quote-builder.js:1111 — saveToWorkspace.

The action remains enabled on an Issued quote. Its handler checks active payments but does not check the quote's immutable lifecycle state before modifying the editor.

A browser reproduction clicked Quote Adjustment on an Issued quote. The displayed rows increased from one to two, persisted quote lines stayed at one, and an uncaught error reported:
“Issued and resolved Quotes are a stable snapshot; create a new revision from current costs.”

~~~json
{"quote":"Issued","addEnabled":true,"rowsBefore":1,"rowsAfter":2,"savedLines":1}
~~~

Proposed correction: use the same eligibility result for the button and handler. Allow adjustments only on an editable, unpaid Draft with a valid Project. Check before changing state, handle rejected saves, and restore editor state when persistence fails. Issued, Accepted, Declined and Superseded snapshots must remain unchanged.

### F4 — Declined quotes still permit new deposits

Locations:
- src/program-planner/js/quote-model.js:7 — payable statuses.
- src/program-planner/js/quote-model.js:407 — recordPayment.
- src/program-planner/js/quote-builder.js:881–896 — payment eligibility and guidance.

Record Payment is limited by the UI to Issued/Accepted quotes, but Record Deposit excludes Superseded and City-funded quotes without excluding Declined. The model permits payments against Draft, Issued, Accepted and Declined quotes.

A model reproduction issued and declined a customer-funded quote, then successfully recorded a new deposit:
~~~json
{"status":"Declined","payments":1}
~~~

Business decision to confirm before changing this policy: should a Declined quote accept any newly recorded receipts? Recommended default: block new receipts/deposits on Declined or Superseded quotes; retain the ability to view and reverse existing transactions. Do not remove historical payments or invent a refund workflow.

Other fixes can proceed independently of this decision.

### F5 — Map event handling and refreshes do unnecessary work

Locations:
- src/shared/space-map/renderer.mjs:210 — native event forwarding.
- src/shared/space-map/renderer.mjs:110,147,163,224 — broad invalidation and rebuilding.
- src/remediation-planner/js/map.js:470 — operational refresh.
- src/remediation-planner/js/map.js:516 — numbered location markers.
- src/remediation-planner/js/map.js:341 — measurement markers.

Measured under forced MapLibre:
~~~json
{"mousemoveEvents":20,"dragPanEnableCalls":40,"cameraUpdateCalls":20}
~~~

The native event bridge synchronizes camera state and enables/disables dragPan both before and after forwarding each event, including ordinary mouse moves.

The controller's refresh regenerates all five operational sources and rebuilds DOM pins and measurement labels. The adapter DOES compare serialized source data and skips unchanged uploads; it would be incorrect to claim every unchanged source is uploaded. The remaining costs include generating/serializing that data and replacing overlays.

GPU wheel zoom marks all sources dirty, and rebuilding disposes/recreates geometry and materials, including polygon triangulation. Camera-only changes should avoid re-triangulating static fills. Line widths/dashes still need correct screen-scale updates.

Proposed changes:
- Synchronize gesture settings on changes rather than every event.
- Coalesce pointer previews into at most one update per animation frame.
- Track separate dirty state for grid, work geometry, draft, editing vertices and locations.
- Reuse keyed pin and measurement DOM nodes.
- Separate camera/uniform updates from topology/material changes and GPU buffer uploads.
- Retain geometric alignment, dash completeness, pin order, labels and edit/draft recovery.
- Consider native MapLibre updateData for stable-ID features, with setData as a compatibility/full-replacement path. Unique feature IDs must be established first.
- Preserve the existing locally rebased Mercator and reference-layer resource budgets.

The vendored MapLibre header identifies v5.3.0, and its bundle contains updateData, setPixelRatio and maxTileCacheSize. Do not upgrade the library merely to perform this refactor.

Reference: https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/#updatedata
Official documentation requires unique feature IDs or promoteId for incremental updates.

### F6 — Backend resource settings and metrics need parity

Location: src/shared/space-map/renderer.mjs:202–212,335.

The MapLibre constructor does not explicitly inherit the GPU path's pixel ratio, canvas pixel or 128-tile cache settings. Adapter resource metrics read the adapter's own GPU objects/tiles, which are empty under MapLibre. The reproduction reported zero adapter tiles while the native raster source was loaded.

This is a gap in enforcement/observability, not a measured claim that a particular native memory limit was exceeded.

Proposed correction: apply supported native pixel-ratio/cache settings, recalculate limits on resize, and report native measurements where available. Clearly distinguish unavailable memory metrics from zero usage.

### F7 — Workspace mutations and notifications repeatedly copy whole datasets

Locations:
- src/program-planner/js/app.js:673–704 — mutation preparation and activation.
- src/program-planner/js/app.js:717–740 — change notification.
- src/program-planner/js/storage.js:114,274 — persistence copies and verification.
- src/program-planner/js/costing.js:797–824,1465–1485 — render signatures and event subscriptions.

A mutation prepares full before/candidate copies. Activation publishes another workspace copy, and the subsequent change event copies after twice plus before. Several APIs also normalize/clone entire workspaces. Calculator signatures serialize multiple complete collections, and it subscribes to both ready and changed notifications.

These are concrete duplication points, not a measured end-user latency estimate. Some render caching already exists and must be retained.

Proposed changes:
- Establish per-collection change/revision information and indexes for repeated entity lookup.
- Avoid duplicating the same immutable after snapshot in event payloads.
- Avoid processing the same mutation twice in active modules.
- Update hidden-module state without rebuilding its DOM unnecessarily.
- Keep external snapshot APIs defensive.
- Preserve the serialized mutation queue, revision conflicts, financial transition validation, atomic persistence and verified recovery. Do not remove data-integrity checks to obtain a speed improvement.

### F8 — CSS cascade debt, missing tokens and disabled action styling

Measured main stylesheet:
- src/program-planner/styles.css: 390567 bytes, 11123 lines.
- Approximately 2043 selector rules, using a simple text-based inventory.
- 1897 !important declarations and 1249 hexadecimal colour occurrences.
- Repeated selectors include .program-cost-col-actions, .program-cost-table .program-category-pill and Planner disclosure controls.

These inventory counts are indicators of maintenance debt; they do not prove every repeated selector is redundant. Media, theme and state variants must be distinguished before removal.

Undefined tokens were found in active CSS, including --uos-focus and --uos-primary. Some usages have fallbacks; others do not. See styles.css:1363,1861,10368 and status-v5.css:8. Shared tokens currently provide --uos-info, --uos-brand and --uos-action rather than those undefined aliases.

The three recently promoted Quote actions use the primary class even while disabled. A disabled Record Payment had the same dark-green background as Save Quote, with opacity reduced to 0.44. Shared primary hover rules are also not restricted to enabled controls.

~~~json
{"action":"Record payment","disabled":true,"background":"rgb(4, 120, 87)","color":"rgb(255, 255, 255)","opacity":"0.44"}
~~~

Proposed changes:
- Consolidate shared buttons, inputs, framed rows, disclosure controls and sidebar dimensions.
- Use semantic colour, spacing, control-size and focus tokens.
- Remove superseded declarations incrementally and reduce specificity instead of adding more !important overrides.
- Restrict active/hover treatment to enabled controls and give unavailable actions their existing inactive visual treatment.
- Move static inline styling into component classes where practical.
- Preserve desktop layout, owner themes, font settings, status semantics, risk colours and accessibility.
- Do not delete selectors solely because coverage missed them during a limited workflow.

### F9 — A navigation workaround conceals a broken original handler

Locations:
- src/program-planner/js/register.js:1040–1061 — handleOpenProject.
- src/program-planner/js/register-open-project-fix.js — capture-phase interceptor.
- src/program-planner/index.html:1244 — interceptor loading.

The original handler assigns state.selectedId = uid, but uid is local to a different record-creation function. A separately loaded capture-phase handler intercepts Open Project and stops the original handler from running.

Proposed correction: repair the primary Register navigation path, preserve originating Register identity separately from Delivery Project identity, and use the existing context-aware routing API. Verify drawer behavior and queued-save ordering before removing the interception script. Do not simply delete the workaround and expose the broken path.

### F10 — Draft/source divergence is not communicated clearly

Locations:
- src/program-planner/js/quote-model.js:142–182 — saved Draft source snapshots.
- src/program-planner/js/quote-model.js:256–262 — explicit refresh.
- src/program-planner/js/costing.js:26–44 — quote view status and exclusions.

Important correction to an earlier conversational explanation: Drafts do not always automatically mirror Current Project Work. A saved Draft can retain older source values even with no quote adjustments or exclusions.

Reproduction:
1. Save a Draft from a source costing line totalling 100.
2. Change Current Project Work quantity/total to 200.
3. Save the existing Draft without refreshCosts.
4. Current Project Work remains 200 and the Draft subtotal remains 100; exclusions are empty.

~~~json
{"source":200,"quote":100,"excluded":[]}
~~~

This does not justify silently changing existing offers. Recommended workflow improvement: expose a source-changed indicator and a concise added/removed/changed-line comparison before the existing explicit Refresh action. Retain intentional exclusions, custom adjustments, historical snapshots and payment locks. Decide separately if the owner wants a different automatic Draft synchronization policy.

### Low-risk cleanup candidates

src/shared/space-map/renderer.mjs contains tileGeneration, a local previous zoom value, and a GeoSource version counter with no identified consumers in the reviewed source. Confirm repository references and public/test consumers before removing them. These small removals are lower priority than rendering and observer costs.

Necessary compatibility mechanisms should remain: the local-file classic-script/Blob-worker path exists for file:// use in Edge, and the renderer recovery ladder preserves unfinished work. No replacement was established for those mechanisms in this audit.

## Proposed implementation sequence

### Stage 1 — Restore dependable basemap readiness and remove growing background work

- Fix F1 using the native backend's readiness API.
- Establish backend-aware limits and truthful metrics from F6.
- Consolidate Cost Library accessibility decoration and stop observer growth from F2.
- Add focused regression coverage: successful native raster remains beyond the watchdog; failed native raster still falls back; repeated navigation does not increase observers.
- Keep current rendering appearance and editing semantics.

### Stage 2 — Make commercial actions match lifecycle eligibility

- Fix F3 in both rendering and handlers, including rejected-save rollback.
- Preserve inactive styling for unavailable Quote actions.
- Resolve F4's Declined receipt policy with the owner before changing that rule; reuse one model/UI eligibility policy after the decision.
- Add focused tests for Draft, paid Draft, Issued, Accepted, Declined and Superseded states; include funding modes and existing transaction reversal.
- Add F10 source/snapshot visibility using the existing explicit refresh flow. Do not introduce automatic repricing without a separate decision.

### Stage 3 — Reduce map refresh and allocation costs

- Implement F5 in small changes, beginning with native event forwarding and marker reuse.
- Add source-specific invalidation and frame-coalesced previews.
- Separate camera updates from static topology changes; retain correct width and dash behavior.
- Evaluate native incremental GeoJSON updates only with stable feature identities.
- Measure update counts, object churn, allocations and request counts at comparable desktop data sizes, such as 100 and 1000 work features. Record before/after figures on the same machine/backend.
- Preserve 25% normal and selected reference fills, 25% normal white outlines, 0.5px normal outline width, and the existing distinct selected outlines.

### Stage 4 — Consolidate workflow routing, state notifications and CSS

- Repair F9 in the owning Register module before removing its interceptor.
- Reduce F7 cloning and redundant event work while preserving persistence/governance contracts.
- Consolidate F8 incrementally by component. Resolve missing tokens and duplicated button/disclosure definitions first.
- Remove confirmed unused code after replacement paths pass their focused checks.
- Treat lazy-loading further UI modules as a separate measured follow-up: the current shell declares 62 script tags and 19 stylesheet links. Do not casually defer foundational models with ordering dependencies.

### Stage 5 — Make the regression gates trustworthy

- Update stale tests to the current UI contract and version-independent URL matching.
- Keep actual assertions meaningful; do not weaken them merely to get green results.
- Replace fixed-frame timing in the flaky month-drag helper with a stable state/DOM condition.
- Run only tests relevant to each amendment, plus required integrity checks.
- Continue excluding screenshots, videos/traces that capture screenshots, and mobile-device/narrow-viewport scenarios from this work.
- Review final diffs and preserve unrelated local work.
- No GitHub publication is part of the implementation sequence unless separately requested.

## Test execution and results

### Model suite

Ran the root NSA/EVT Node suite. It includes the local untracked current-year-backup-recovery test present in this checkout.

Result: 267 named tests, 266 passed and one failed.

The failure is tests/program-runtime.test.cjs:25, expecting an obsolete renderer version URL:
- Expected: renderer.js?v=20261011-raster-resolution-v3
- Actual: renderer.js?v=20261015-tree-highlights-v1

This is a stale exact-version assertion, not evidence that lazy module loading failed.

### Desktop browser checks

Two initial groups ran 72 distinct scenarios:
- Whole-app selection: 56 scenarios, 46 passed and 10 failed.
- Map/GPU selection: 16 scenarios, 14 passed and two failed.
- Combined initial result: 60 passed, 12 failed.

The month-drag failure passed when rerun alone. The two module-load failure scenarios were rerun and still failed.

Remaining failures to resolve:
- Seven C6 polygon pricing tests: their helper tries to click an inspector card while the current map mode keeps it hidden. The helper also predates the current card size cycle. Align the test interaction with Space Manager and the intended card size before concluding that pricing is broken.
- Two runtime retry tests: renderer request interception uses a glob ending at renderer.js while the runtime requests a URL with a version query. The intended failure is not being injected.
- Two tree-layer tests: expected outFields are OBJECTID or OBJECTID,risk; the detail-panel feature now requires OBJECTID,asset_id,tpz,srz,risk.
- The initially failing month conversion test used a selected DOM node that detached during repaint. Its isolated rerun passed; it remains a stability concern, not a confirmed persistent product failure.

Passed checks included the selected NSA/EVT payment/deposit/funding/reversal workflows, failed-payment retry without duplication, overpayment reversal, quote snapshots and Draft membership, Planner task editing, Register drawer context, workspace backup/recovery, map drawing, renderer loss/recovery, projection alignment, tree service outages, transfer limits, stale results and resource budgets.

This was broad coverage, not an exhaustive validation of all business/UI paths. Service behavior was mocked in resource/geometry checks; these results are not end-user hardware benchmarks or live-service performance measurements.

### Syntax and other checks

- All 66 checked first-party JavaScript modules passed node --check.
- git diff --check passed.
- No screenshots, mobile emulation or mobile-device tests were run.
- Test runs used fresh browser contexts and synthetic records. The user workspace was not used as a destructive test target.

### Reproduction commands

All shell commands must use the RTK wrapper.

Model suite:
~~~sh
rtk proxy node --test tests/*.test.cjs
~~~

Whole-app desktop selection:
~~~sh
rtk proxy node node_modules/@playwright/test/cli.js test \
  tests/browser/client-demo-fixes.spec.js \
  tests/browser/map-drawing-lifecycle.spec.js \
  tests/browser/map-reimport-focus.spec.js \
  tests/browser/program-runtime.spec.js \
  tests/browser/calculator-render-scope.spec.js \
  tests/browser/cost-library-legacy-grouping.spec.js \
  tests/browser/quote-payment-funding-workflow.spec.js \
  tests/browser/scheduler-multi-day.spec.js \
  tests/browser/planner-task-editor.spec.js \
  tests/browser/workspace-backup-recovery.spec.js \
  tests/browser/status-ui.spec.js \
  tests/browser/c6-work-type-rate-mapping.spec.js \
  tests/browser/register-drawer-context.spec.js \
  --workers=2 --reporter=line --trace=off
~~~

Map/GPU selection; the excluded tests explicitly call screenshot methods:
~~~sh
rtk proxy node node_modules/@playwright/test/cli.js test \
  tests/browser/space-map-gpu.spec.js \
  --grep-invert 'local-file entry|local launcher' \
  --workers=1 --reporter=line --trace=off
~~~

Month-drag diagnostic rerun:
~~~sh
rtk proxy node node_modules/@playwright/test/cli.js test \
  tests/browser/scheduler-multi-day.spec.js \
  --grep 'Month timed extension' \
  --workers=1 --reporter=line --trace=off
~~~

Runtime retry diagnostic rerun:
~~~sh
rtk proxy node node_modules/@playwright/test/cli.js test \
  tests/browser/program-runtime.spec.js \
  --grep 'failed local' \
  --workers=1 --reporter=line --trace=off
~~~

Playwright is installed and callable locally at version 1.62.0. The project config deletes PLAYWRIGHT_BROWSERS_PATH so it uses the project's installed browser runtime. A standalone diagnostic initially inherited /usr/share/playwright, which lacked that browser revision. Standalone scripts must likewise delete that environment override before requiring/launching Playwright. No package installation is needed to repeat the established checks.

For multiple sequential diagnostic runs, a separately managed static server avoids one Playwright run shutting down a server reused by another:
~~~sh
rtk proxy env PORT=4199 node src/scripts/static-server.cjs
~~~
Stop only the server process you started. The audit's server was stopped at completion.

## Compatibility and local-work safeguards

- Remain on main; do not create branches.
- Preserve schemas, canonical IDs, quote history, payment evidence and financial governance.
- Keep NSA/EVT and Overtime independent.
- Existing unrelated modified file: Offline/H2 Evidence/h2-cost-library-after.png.
- Existing untracked files include Overtime research/rosters, older projects, workspace conversion inputs/results, governance archives, local-coordinate tooling, Windows Zone.Identifier files and current-year backup tests.
- Those items were not staged, deleted or modified by this audit. Do not include them automatically in a future publication.
- Build generated map bundles only when their source changes, using scripts/build_space_map.cjs. Review generated diffs and transport requirements before publishing.
- Saving this document is not a Git commit or GitHub push.

## Captured diagnostic material

The following appendices preserve the actual session results and diagnostic code that otherwise existed only in agent memory. Scripts are provided as audit reproductions, not production changes or permanent regression tests. They intentionally demonstrate current behavior; their expected outcomes must change when defects are fixed.


### A. Captured results

Model-test summary and recorded failure:

~~~json
{
  "status": 1,
  "summary": [
    "# tests 267",
    "# pass 266",
    "# fail 1",
    "# duration_ms 2419.391161"
  ],
  "failures": [
    "not ok 186 - local libraries load only on demand and concurrent calls share a request\n  ---\n  duration_ms: 2.840591\n  type: 'test'\n  location: '/home/n0rt/headroom-projects/Hort Ops 23 September/tests/program-runtime.test.cjs:19:1'\n  failureType: 'testCodeFailure'\n  error: |-\n    Expected values to be strictly equal:\n    + actual - expected\n    \n    + 'http://localhost/src/shared/vendor/space-map/renderer.js?v=20261015-tree-highlights-v1'\n    - 'http://localhost/src/shared/vendor/space-map/renderer.js?v=20261011-raster-resolution-v3'\n    \n  code: 'ERR_ASSERTION'\n  name: 'AssertionError'\n  expected: 'http://localhost/src/shared/vendor/space-map/renderer.js?v=20261011-raster-resolution-v3'\n  actual: 'http://localhost/src/shared/vendor/space-map/renderer.js?v=20261015-tree-highlights-v1'\n  operator: 'strictEqual'\n  stack: |-\n    TestContext.<anonymous> (/home/n0rt/headroom-projects/Hort Ops 23 September/tests/program-runtime.test.cjs:25:10)\n    Test.runInAsyncScope (node:async_hooks:214:14)\n    Test.run (node:internal/test_runner/test:1047:25)\n    Test.start (node:internal/test_runner/test:944:17)\n    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)\n  ..."
  ],
  "stderr": ""
}
~~~

MapLibre readiness, event-call counts and resource metrics:

~~~json
{"map":{"backend":"maplibre","nativeLoaded":true,"adapterLoaded":false,"doubleClick":{"adapterBlocked":false,"nativeEnabled":true},"mousemove20":{"enables":40,"updates":20},"metrics":{"backend":"maplibre","referenceGpuBytes":0,"tiles":0,"canvasPixels":957609,"pixelRatio":1,"referenceLayers":[]}}}
{"afterTimeout":true}
~~~

The final `afterTimeout: true` means the basemap source was removed despite the native source having loaded successfully. The diagnostic deliberately shortens the provider timeout to 1.5 seconds; the application default is 12 seconds. Event-call counts describe this instrumented synthetic sample, not a hardware benchmark.

Quote snapshot and Declined-deposit model reproductions:

~~~json
{"draft":{"source":200,"quote":100,"excluded":[]}}
{"declined":{"status":"Declined","payments":1}}
~~~

Issued-quote adjustment UI reproduction:

~~~json
{"issued":{"quote":"Issued","addEnabled":true,"rows":1}}
{"afterClick":{"rows":2,"saved":1},"errors":["Issued and resolved Quotes are a stable snapshot; create a new revision from current costs."]}
~~~

The issued-quote UI added a visible second row while the saved quote retained one row. The recorded exception is the model's protection against editing an immutable snapshot. The fix should prevent the invalid UI mutation before it occurs.

Catalog accessibility observer instrumentation counted four observers before repeated navigation and eight after six navigations in a workspace with a Project. Instrumentation wrapped native `MutationObserver.observe` before page load and counted observations of `[data-costing-catalog-body]`. An earlier empty-workspace probe could not exercise the guarded navigation and is not the basis for this finding.

| Stylesheet | Bytes | Lines | `!important` | Hex colour occurrences | Approximate rules |
| --- | ---: | ---: | ---: | ---: | ---: |
| `src/program-planner/styles.css` | 390567 | 11123 | 1897 | 1249 | 2043 |
| `src/program-planner/space-map-editor.css` | 25068 | 350 | 1 | 46 | 208 |
| `src/program-planner/client-demo-fixes.css` | 3755 | 33 | 0 | 5 | 27 |
| `src/program-planner/scheduler-week.css` | 16504 | 151 | 37 | 53 | 118 |
| `src/shared/css/components.css` | 17645 | 185 | 0 | 6 | 141 |
| `src/shared/css/themes.css` | 4214 | 92 | 0 | 128 | 6 |
| `src/shared/css/tokens.css` | 3311 | 114 | 0 | 23 | 4 |

CSS counts are textual inventory estimates, not a parsed cascade analysis or proof that repeated selectors can be deleted safely. Hex colour occurrences include repeated values.

### B. Reproduce MapLibre readiness and event-call behavior

Run from the repository root with the existing Node dependencies and browser runtime. Start the local static server in a separate terminal using the command in the tool/runtime section. Save this code as a temporary `.cjs` file in the repository root, then execute it with `rtk proxy node <filename>.cjs`. Its relative imports require that location. The synthetic workspace exists only in the isolated browser context; it does not use an operator workspace export.

The browser uses a desktop viewport and synthetic PNG raster tiles. This diagnostic does not take screenshots or run mobile-device checks. Stop the server you started when finished.

~~~js
delete process.env.PLAYWRIGHT_BROWSERS_PATH;const {chromium}=require("@playwright/test");const {suppressBackupModalForFunctionalTest}=require("./tests/browser/test-helper.cjs");(async()=>{const b=await chromium.launch({headless:true,args:["--no-sandbox","--use-angle=swiftshader"]});try{const page=await b.newPage({viewport:{width:1600,height:1000}});await suppressBackupModalForFunctionalTest(page);await page.addInitScript(()=>window.UOS_SPACE_MAP_BACKEND="maplibre");await page.goto("http://127.0.0.1:4199/src/program-planner/nsa.html");const f=page.frames().find(x=>x!==page.mainFrame());await f.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==="ready");await f.evaluate(async()=>{UOS_REMEDIATION_MAP_CONFIG.defaultProvider="offline";UOS_REMEDIATION_MAP_CONFIG.providerTimeoutMs=1500;await UOS.ProgramApp.updateWorkspace(w=>{w.entities.applications.push({id:"NSA-APP-AUDIT",owner:"NSA",title:"Audit test",status:"received",dateReceived:"2026-10-16"});const p=UOS.ProgramModel.promoteRegisterRecord(w,"NSA-APP-AUDIT");w=p.workspace;w.workspace.selectedProjectId=p.project.id;w.workspace.selectedEntityId="NSA-APP-AUDIT";return w;});await UOS.ProgramApp.navigateWithContext("quotes","NSA-APP-AUDIT");});console.log(JSON.stringify({buttons:await f.evaluate(()=>[...document.querySelectorAll("[data-quote-save],[data-add-line],[data-deposit-record],[data-payment-record]")].map(e=>({action:e.textContent.trim(),disabled:e.disabled,background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,opacity:getComputedStyle(e).opacity})))}));await f.evaluate(()=>UOS.ProgramApp.navigate("map"));await f.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());const png=await f.evaluate(()=>{const c=document.createElement("canvas");c.width=c.height=2;c.getContext("2d").fillRect(0,0,2,2);return c.toDataURL().split(",")[1]});await page.route("https://audit-tiles.test/**",r=>r.fulfill({body:Buffer.from(png,"base64"),contentType:"image/png"}));await f.evaluate(()=>{const c=UOS.ProgramMapController.getMapController();UOS_REMEDIATION_MAP_CONFIG.providers.push({id:"audit",tileSize:256,tiles:["https://audit-tiles.test/{z}/{x}/{y}.png"]});c.setProvider("audit");});await f.waitForFunction(()=>UOS.ProgramMapController.getMapController().getRendererAdapter().legacy?.isSourceLoaded("uos-basemap"));console.log(JSON.stringify({map:await f.evaluate(()=>{const a=UOS.ProgramMapController.getMapController().getRendererAdapter();let enables=0,updates=0;const en=a.legacy.dragPan.enable.bind(a.legacy.dragPan);const up=a.updateCamera.bind(a);a.legacy.dragPan.enable=()=>{enables++;return en()};a.updateCamera=()=>{updates++;return up()};for(let i=0;i<20;i++)a.legacy.fire("mousemove",{point:{x:10,y:10},lngLat:a.legacy.getCenter()});return {backend:a.backend,nativeLoaded:a.legacy.isSourceLoaded("uos-basemap"),adapterLoaded:a.isSourceLoaded("uos-basemap"),doubleClick:{adapterBlocked:!!a.noDoubleClick,nativeEnabled:a.legacy.doubleClickZoom.isEnabled()},mousemove20:{enables,updates},metrics:a.getResourceMetrics()};})}));await f.waitForFunction(()=>!UOS.ProgramMapController.getMapController().getRendererAdapter().getSource("uos-basemap"));console.log(JSON.stringify({afterTimeout:await f.evaluate(()=>UOS.ProgramMapController.getMapController().getRendererAdapter().getSource("uos-basemap")===undefined)}));}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1})
~~~

### C. Reproduce quote snapshot and Declined-deposit behavior

Run from the repository root using Node. This model diagnostic requires no browser, server, operator data or external service. Save as a temporary `.cjs` file in the repository root and run with `rtk proxy node <filename>.cjs`. It creates an isolated VM context and a synthetic workspace, and writes no workspace file.

~~~js
try{const fs=require("fs"),vm=require("vm"),ctx={console,structuredClone,URLSearchParams,crypto:require("node:crypto").webcrypto};ctx.window=ctx;ctx.UOS={ProgramAppConfig:{current:()=>({appId:"uos.horticulture.nsa",owner:"NSA",workspaceKind:"NSA"})}};vm.createContext(ctx);for(const file of ["status.js","default-rate-catalog.js","model.js","funding-model.js","quote-model.js"])vm.runInContext(fs.readFileSync("src/program-planner/js/"+file,"utf8"),ctx);const U=ctx.UOS,Q=U.ProgramQuotes;let w=U.ProgramModel.blank();w.entities.applications.push({id:"NSA-APP-AUDIT",owner:"NSA",type:"application",title:"Audit",status:"received",dateReceived:"2026-10-16"});w.entities.projects.push({id:"NSA-PROJ-AUDIT",owner:"NSA",type:"project",applicationId:"NSA-APP-AUDIT"});w.entities.costingLines.push({id:"NSA-COST-AUDIT",owner:"NSA",type:"costingLine",projectId:"NSA-PROJ-AUDIT",kind:"Material",description:"Audit line",quantity:1,unit:"item",unitRate:100,estimatedTotal:100});w=Q.saveDraft(w,{projectId:"NSA-PROJ-AUDIT",quoteDate:"2026-10-16",fundingMode:"customer"});const id=w.entities.quotes[0].id;w.entities.costingLines[0].quantity=2;w.entities.costingLines[0].estimatedTotal=200;w=Q.saveDraft(w,{id,projectId:"NSA-PROJ-AUDIT"});console.log(JSON.stringify({draft:{source:w.entities.costingLines[0].estimatedTotal,quote:w.entities.quotes[0].subtotal,excluded:w.entities.quotes[0].excludedCostingLineIds}}));w=Q.refreshDraftFromCurrentCosts(w,id,{confirmed:true});w=Q.issue(w,id);w=Q.decline(w,id);w=Q.recordPayment(w,{quoteId:id,amount:10,paymentDate:"2026-10-16",method:"Paid with Deposit",reference:"AUDIT"});console.log(JSON.stringify({declined:{status:w.entities.quotes[0].status,payments:w.entities.payments.length}}));}catch(e){console.log(JSON.stringify({error:e.message,stack:e.stack.split("\n").slice(0,3)}));}
~~~

### D. Shutdown and resume checklist

1. This Markdown file is the durable handoff. Its findings, decisions, test outcomes and diagnostic source are included directly; no agent memory or `/tmp` artifact is required to understand or resume the work.
2. Reopen this repository, read this document and the current `AGENTS.md`, and inspect the branch and working tree before editing. Line numbers and behavior describe the audited commit and must be checked against any later changes.
3. Implementation is now recorded in the linked implementation report. Use that report for the current source/test checkpoint; the original audit findings and reproductions above remain baseline evidence.
4. Do not repeat the full audit suite simply to resume. Run regressions that check the next fix and other checks justified by the amended code. Preserve the prohibition on screenshot and mobile-device tests.
5. The owner approved blocking new Declined-quote receipts on 16 October 2026. That policy is implemented; preserve viewing/reversal of existing transactions.
6. The plan, implementation, tests and report are local. They have not been staged, Git-committed or pushed as part of this work.
