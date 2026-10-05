# Independent Overtime tooling

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
rtk proxy npm run test:smoke
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
failures. These findings remain open. Later remediation must add positive
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
