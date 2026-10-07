# Independent Overtime tooling

## Stage 4E mixed-policy planning checks

Run `rtk proxy npm run test:stage4e`. The browser test covers fixed and rotation occurrence-count scope, protected manual assignments, visible fixed conflicts, overtime-prioritised manual substitute proposals, zero-write review/approval, atomic save, repair provenance, post-scope vacancies, stale proposals and read-only peers. Screenshots and JSON results stay ignored under `test_reports/stage4e/`.

## Stage 4D overtime-hours allocation checks

Run `rtk proxy npm run test:stage4d`. The self-contained contract and browser test covers strict append-only overtime evidence, verified zero versus unknown, saved future commitment deduplication, the overtime-only policy, legacy-score isolation, canonical safety checks, stale proposals, allocator staging, save/reload and read-only peers.

Inspection screenshots and JSON results stay ignored under `test_reports/stage4d/`; no evidence or review package is generated.

Run commands from `overtime-planner-stage3/`. This project owns its packages,
browser runtime, scripts and test outputs. It does not use NSA/EVT dependencies,
test configuration, fixtures or servers.

## Setup

Phase 3 was verified with Node 22.23.2 and npm 12.1.0. The lockfile pins
Playwright and `@playwright/test` to 1.61.1, with matching Playwright Core.
Chromium revision 1228 was installed in the child cache.

```sh
rtk proxy npm ci --ignore-scripts --cache .cache/npm
rtk proxy npm run browser:install
```

The installation command uses the child-local Playwright CLI and writes browser
runtimes to `.cache/ms-playwright/`. Browser harnesses reject missing or external
packages, external roots and missing or external browser runtimes with blocked
exit code 2. They never fall back to ancestor or global installations.
Installation may require network access; the tests do not install dependencies.

## Build and verification

```sh
rtk proxy npm run build
rtk proxy npm run test:tooling
rtk proxy npm test
rtk proxy npm run test:stage3
rtk proxy node scripts/test_browser_smoke.cjs
rtk proxy npm run test:stage3:smoke
rtk proxy npm run test:inherited
rtk proxy npm run probe:review64
```

`npm test` retains the original 24-suite regime: 17 Stage 1 suites and seven
Stage 2 suites. The six Stage 3 gates run separately. The two browser smoke
commands launch isolated Chromium contexts against the standalone file; they
do not require the host application or an HTTP server.

`test:tooling` verifies child-root subprocess binding, removal of inherited
`NODE_PATH`, unchanged retained-suite descriptors, rejection of escaped build
references before outside reads/writes, and browser dependency boundaries.
Modular source is authoritative. Builds must keep `index.html` and
`dist/hort_ops_offline_planner.html` byte-identical. Phase 3 reproduced the
inherited standalone bytes without changing application modules or styles.

`test:inherited` explicitly runs ten Review 55–63 scripts against this child.
`probe:review64` runs the two unchanged Review 64 vulnerability reproductions
from `scripts/independent-probes/review64/`. Their exit zero means the script
completed its reproduction contract; it does **not** mean the application is
safe or accepted. Phase 3 reproduced three lost writes and two injection
failures. Those were Phase 3 observations; consult `CURRENT_REVIEW_STATUS.md` for current dispositions. Later remediation must add positive
closure tests while preserving the original reproduction sources.

## Outputs and inactive tools

Probe reports go to `test_reports/phase3-probes/`; browser screenshots go to
`test_reports/browser/`. Redirected logs also belong in `test_reports/`.
Reports, screenshots, dependency directories, caches and historical archives
are ignored and remain local. No command above generates a peer-review ZIP,
results package or test-evidence package.

Historical packaging/extraction tools, including `extract_staged_crew.cjs`,
remain inactive reference material and are not operational npm commands.
Do not invoke them against their original absolute workspace paths.
Future server-based work requires a dedicated Overtime origin: a separate
folder on the NSA/EVT origin does not isolate browser storage.

See `MIGRATION_PHASE3_CHECKPOINT.md` for verified results and the phase boundary.

## Phase 4 isolated design proof

```sh
rtk proxy node scripts/test_single_writer_design.cjs
```

This proof launches child-local Chromium and a temporary loopback fixture
server, also tests offline file fixtures, and records ignored results under
`test_reports/phase4-writer-design/`. It does not load application code or user
data. It is not added to the inherited 24-suite runner and does not change
production coordination. See `R64_TOCTOU_DESIGN_DECISION.md` and
`MIGRATION_PHASE4_CHECKPOINT.md` for the 18 verified checks, limitations and
clarified clean client startup contract.

## Phase 5 production writer checks

```sh
rtk proxy npm run test:writer
```

This launches child-local Chromium against the generated client and tests clean
startup, isolated storage, competing tabs, failures, handoff, exports and crash
recovery. Eighteen checks passed. Reports and downloaded test data stay under
ignored `test_reports/phase5/`. This command supplements the inherited regime;
it does not replace its 24 suites, six Stage 3 gates or immutable review probes.

The browser client uses current-only storage/envelope modules. Historical
`storage.js` and `migrationEngine.js` remain outside its source graph for
compatibility tests. Fixtures use the virtual store and explicit ownership
readiness rather than activating old browser data or fake ownership flags.
See `MIGRATION_PHASE5_CHECKPOINT.md` before beginning the next phase.

## Phase 6 colour/import security proof

Run `rtk proxy npm run test:security` for seven positive Node/browser proof groups against the generated client. It tests rejected saves/imports without changing source bytes, the asynchronous file input, ten rendered component paths with mouseover dispatch, normal RGB/RGBA round trips and recovery. Results stay under ignored `test_reports/phase6/`.

After Phase 6 the unchanged Review 64 security reproduction exits 1 because both hostile colours are rejected and neither handler appears. The unchanged raw-storage concurrency reproduction still exits 0 after reproducing three losses in compatibility paths outside the guarded client. Neither raw exit denotes release acceptance. `CURRENT_REVIEW_STATUS.md` supersedes historical stage attribution; the current checkpoint is `MIGRATION_PHASE6_CHECKPOINT.md`. No command generates packages or publishes GitHub.

## Phase 7 domain handoff proof

Run `rtk proxy npm run test:handoff` for 15 checks across three real domain edits using index/dist/modular clients. It verifies ownership transfer, denied stale commands, retained form callbacks after reacquisition, fresh absence edits and third-client cold reload. Results stay in ignored `test_reports/phase7/`. The current checkpoint is `MIGRATION_PHASE7_CHECKPOINT.md`; review commands and limits are in `REVIEW65_CANDIDATE_HANDOFF.md`. No packages or publication are generated.

## Phase 8 runtime qualification

```sh
rtk proxy npm run test:runtime
```

Six checks use the same pinned child-local Chromium and actual offline index,
distribution and modular clients. They supplement the retained regimes rather
than becoming Stage 3 contract gates. Reports stay in `test_reports/phase8/`.
They cover actual navigation/peer-save/return/reload and controlled storage/lock
denial against valid saved data. Actual back/forward-cache restoration was not
observed. `SUPPORTED_RUNTIME.md` states the qualification boundary; owner testing
and release acceptance are separate evidence/decisions.

## Forward Planner assigned-card regression

```sh
rtk proxy npm run test:planner:assignments
```

Six checks use real assignment buttons with clean synthetic User Table workforce
input. Partial/full/reloaded one-off and recurring crews retain assigned cards and
saved evidence. Reports stay in test_reports/forward-planner-assignments/. This is
a supplemental regression, not an amendment to the frozen 24-suite runner.

## Stage 4C preview checks

`npm run test:stage4c` runs the self-contained detached-model and browser preview checks. `npm run test:stage4c:model` runs the model checks alone. They use only this project's source, fixtures and installed Playwright/browser runtime. Browser results and local inspection images stay under ignored `test_reports/candidate-preview/`; no evidence package is generated. See `STAGE4C_CHECKPOINT.md` for the completed 11-model/23-browser result and full independent regression matrix.

## Per-job staffing sections checks

Run `rtk proxy npm run test:staffing-sections` for self-contained schema, canonical eligibility, preview, ordering/rotation and browser persistence/editor/peer checks. Uses the same child-local Playwright and browser runtime. Results and inspection screenshots remain local under ignored `test_reports/staffing-sections/`; no review package is generated.

## Allocator usability checks

Run `rtk proxy npm run test:allocator` for the self-contained source/model and browser allocator proofs. It covers matching/other groups, canonical blockers, pool labels/search/slicers, staged auto-add and operator shortages, existing staff/slot preservation, save/reload, read-only guards and mobile overflow. It uses only child-local source, synthetic fixtures and the established Playwright/browser runtime. Results and screenshots stay ignored under `test_reports/allocator-usability/`; no evidence/review package is generated.
