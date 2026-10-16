# NSA/EVT performance and workflow implementation — 16 October 2026

Status: implemented; final verification recorded below.

Source plan: [Performance and workflow audit](NSA-EVT-performance-workflow-audit-2026-10-16.md). Baseline commit: `a8ed6030a9bbecfcf5dbdfccb144ee8b8675311d`. Work remains local on `main`, tracking `origin/main`. No Git commit or GitHub publication was requested or performed.

## Implemented findings

| Finding | Result |
| --- | --- |
| F1: false MapLibre basemap readiness | Adapter readiness delegates to the native source. Loaded raster survives the provider watchdog; actual failure still returns to the offline grid. Native pan/zoom requests fresh raster tiles. |
| F2: accumulating Cost Library observers | Removed the standalone observer script and redundant decorator. The owning catalog renderer supplies descriptions, complete category labels and action tooltips. Repeated navigation creates zero catalog observers. |
| F3: adjustment actions on immutable quotes | Shared eligibility requires an existing Project and an unpaid editable Draft. UI and handlers reject immutable/locked actions. Save failures remove the optimistic added row. Editable fields and competing financial actions are disabled during the save; existing edits are retained. |
| F4: new receipts on Declined quotes | Owner explicitly approved blocking new deposits/payments on Declined quotes. Model and UI share eligibility. Existing transactions remain visible and reversible. Customer, Mixed and City funding and all five quote statuses have focused coverage. |
| F5: map refresh/allocation churn | Native gesture settings change only when requested; ordinary mouse moves do not synchronize the camera. Draft previews coalesce by animation frame, with a final flush before pointer release/commit. Pan completion updates the grid without regenerating the other four sources. Pins reuse their location IDs; measurement labels reuse DOM/Marker objects and retain native positioning classes. Camera zoom rebuilds screen-width lines while retaining polygon fill meshes/buffers; origin rebasing still invalidates all affected geometry. |
| F6: backend budget/metric mismatch | Native MapLibre receives a 128-tile cache limit and the same pixel-ratio/canvas budget as GPU backends, including resize. Metrics report actual canvas pixels and native active/cached raster tiles. Unsupported native GPU-byte measurements return `null` rather than zero. |
| F7: repeated snapshots and Calculator work | Publication removes two redundant full-workspace copies, retaining independent event snapshots. Mutation IDs let Calculator skip paired duplicate notifications. Per-collection revision metadata replaces repeated collection serialization in its render keys. Hidden Calculator rows remain deferred; linked calendar indicators still update. Removed two redundant timed post-save refreshes. |
| F8: CSS/component debt | Resolved missing focus/action aliases through semantic shared tokens. Restricted shared hover/active rules to enabled buttons; Quote actions use the inactive secondary treatment when unavailable. Consolidated Planner disclosure definitions, introduced a shared disclosure-size token and removed four superseded Calculator action-column widths. Replaced static Quote action layout styles with classes. |
| F9: intercepted Register navigation | Repaired the owning Open Project handler and removed its capture-phase interception script. Central context routing preserves the originating Register identity, correct Project/owner and queued-save behavior. |
| F10: invisible Draft/source divergence | Drafts disclose added, changed and removed source lines through a compact expandable comparison. Saved values change only through the existing explicit Refresh action. Exclusions and custom adjustments are preserved. The read-only comparison avoids normalizing/cloning the whole workspace. |

Unused renderer counters and the discarded Calculator unit variable were also removed. Changed assets use new cache versions; the locally bundled renderer was rebuilt with the existing pinned dependencies. Tree worker/loader assets and dependencies did not need changes.

## Measured map changes

`scripts/measure_space_map.cjs` runs a synthetic desktop workload with 100 and 1,000 work polygons under native MapLibre and Three WebGL2. The controller is isolated from Project persistence callbacks. It records operation counts and DOM/mesh identity; it does not take screenshots or use operator workspaces.

The following results held at **both data sizes**:

| Operation | Audited baseline | Implemented |
| --- | ---: | ---: |
| MapLibre: pan-enable calls for 20 mouse moves | 40 | 0 |
| MapLibre: camera updates for 20 mouse moves | 20 | 0 |
| Source-update calls on pan completion | 5 | 1, grid only |
| Source-update calls for a burst of 50 drawing previews | 250 across five sources | 1, draft only |
| Existing pin DOM survives pan and same-data refresh | No | Yes |
| WebGL2 polygon fill mesh/buffer survives zoom | No | Yes |
| Map-service requests in the isolated offline workload | 0 | 0 |
| Native uploads for unchanged data on pan completion | 0 | 0 |

The last row matters: unchanged uploads were already deduplicated. The improvement removes source generation/serialization and object churn; it does not claim that 250 GPU uploads previously occurred.

Single-run elapsed times include animation-frame scheduling and are not a hardware benchmark or an FPS guarantee. The script asserts the implemented operation/identity contracts and exits unsuccessfully if they regress. Native tile-cache inspection is read-only and guarded for the pinned MapLibre version; unsupported measurements remain unknown.

To repeat intentionally, start the repository's static server on port 4199, then run:

~~~sh
rtk proxy node scripts/measure_space_map.cjs --baseline a8ed6030a9bbecfcf5dbdfccb144ee8b8675311d
rtk proxy node scripts/measure_space_map.cjs
~~~

The optional baseline loads source directly from that Git commit into isolated browser contexts. Normal current-worktree verification does not require a historical commit. Browser runtime and project dependencies must be installed. No additional packages were needed for this implementation.

## Verification

- Final NSA/EVT model/integrity suite: **273 passed, zero failed** using `rtk proxy npm test`.
- Initial focused desktop group: **50 passed**, including native watchdog/failure, drawing/Undo/recovery, Moasure placement/rotation, tree thresholds/holes/budgets/outages/stale results, projection/resize/raster alignment, Calculator rendering, quote deposits/payments/reversals, Register context, module retry and Scheduler date movement.
- Supplemental desktop group: **42 passed and two funding-interaction tests initially failed**. Investigation proved the raw mouse click was hitting the underlying Register while its drawer still clipped the radio. A DOM hit-target readiness check repaired the test; **both NSA/EVT cases then passed**, retaining scroll/focus assertions. No funding behavior change was required.
- New direct Register Open Project/return tests: **2 passed**, with exact Project/Register/owner checks and byte-identical entity collections.
- Pooled measurement-label tests: **2 passed**, including native MapLibre and Three WebGL2 DOM identity/positioning-class checks.
- Targeted adjustment/failure/deposit rerun after review: **7 passed**, including default Customer funding and delayed-save rollback.
- Final delayed-save check after adding the operational-amount guard: **1 passed**, including the disabled field and restored controls.
- Current-worktree measured workloads: **4 passed** (two backends, two data sizes). The audited baseline was measured using the same isolated workload.
- Final source checks: **20 JavaScript files passed syntax validation**; the generated renderer bundle matches its current source; **git diff --check passed**.

Counts describe individual runs and overlap; they should not be added together as a distinct-test total.

### Constraint deviation and correction

One supplemental legacy test file was mistakenly selected before its incidental screenshot calls and 390px viewport loop were inspected. That run included four screenshot-producing cases and a narrow-viewport scenario, contrary to the requested test boundaries. The mistake was reported during implementation. Screenshot calls were removed without removing their DOM assertions; the narrow-viewport cases were excluded from subsequent verification. Images were not used to assess the implementation.

All newly added audit tests and the benchmark use desktop contexts, with no screenshot, video or trace capture. Subsequent focused checks followed those constraints.

### Repaired regression gates

- Runtime unit tests check the correct local renderer path and a nonempty cache version rather than an obsolete exact version string.
- Browser module failure injection matches versioned renderer URLs and verifies a genuine retry.
- Tree request tests require the current authoritative detail fields, including asset ID, TPZ, SRZ and risk.
- C6 polygon pricing helpers enter Space Manager and expand the card to its full state before interacting.
- Scheduler month-drag helpers reacquire current DOM and reveal the selected job through its calendar container.
- Funding scroll/focus tests wait for an exposed radio hit target before raw pointer clicks.
- The publication contract test covers mutation metadata and verifies that event consumers cannot modify live application state.

## Preserved contracts and deliberate limits

No schema changes, automatic Draft repricing, quote-history rewriting, operator workspace mutation, branch creation or Overtime integration was performed. The local-file/classic-script/Blob-worker path and renderer recovery ladder remain in place. Reference fills remain 25%, normal white borders remain 25% at 0.5px, and selected outlines retain their contrasting treatment.

MapLibre `updateData` remains a follow-up: operational features do not yet have the stable top-level feature IDs needed to adopt it safely. Whole-UI lazy loading also remains the separate follow-up specified in the plan; foundational script ordering was preserved.

CSS consolidation was intentionally limited to proven component duplication. The main stylesheet still has substantial cascade debt: it decreased from 390,567 to 389,596 bytes and from 1,897 to 1,894 `!important` declarations. These counts are maintenance indicators, not a claim that every remaining declaration is unnecessary. A blanket rewrite or coverage-based deletion was not undertaken.

No native peak-GPU-memory figure or live ArcGIS/MetroMap latency guarantee is asserted. Relevant service behavior was mocked for deterministic regressions, and the operation benchmark used the offline grid.

## Local-work and resume notes

The existing modified `Offline/H2 Evidence/h2-cost-library-after.png`, untracked Overtime research/rosters, converted workspace files, Moasure tooling, archives and Windows metadata were preserved. They are outside this implementation.

Review `git diff` on `main` and this report when resuming. Source changes, focused tests, the benchmark and this report live in the repository; temporary diagnostic files are not required. Publication still requires an explicit user request.
