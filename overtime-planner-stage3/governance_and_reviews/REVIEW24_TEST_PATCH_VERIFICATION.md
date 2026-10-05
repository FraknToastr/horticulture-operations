# Review 24 — Test Patch Verification

**Environment:** Ubuntu container; Node v22.16.0; npm 10.9.2  
**Baseline:** `HortOps-Stage1-GateC-Full-PeerReview-PR21.zip` SHA-256 `5d68badd47b80b9715d987957eebb85e908ddfebb5c97b71ef17f3e9d823b0c3`

The reviewer test patch was overlaid onto a disposable extracted copy of the submitted package. No production JavaScript, HTML, CSS or data file was modified.

| File | Type | Test IDs | SHA-256 | Command | Exit | Status | Verification |
|---|---|---|---|---|---:|---|---|
| `scripts/test_persistence.cjs` | MODIFIED | R24-T01 | `f50860bd8878a7c10212d5221b7fd7a9d886a25c0329473609693ff6ad681b6f` | `node scripts/test_persistence.cjs` | 0 | PASS | Full persistence regression suite passes after replacing two stale element-zero assertions with clean-slate array/length assertions. |
| `scripts/run_all_release_gates.cjs` | MODIFIED | R24-T04 | `d376166f303c512f402c9db70c30ebd30e77979bf7fc58a64f7a00c6e187e8bd` | `node scripts/run_all_release_gates.cjs` | 1 | PASS AS HARNESS / PRODUCT NON-GREEN | Runner reaches all 9 suites and reports 5 PASSED, 3 FAILED, 1 BLOCKED before returning non-zero. |
| `scripts/review24_package_privacy_hygiene.cjs` | NEW | R24-T03 | `87d7df765feb4fb75bc59d8d688ab9b641e64edac4235c3f8bbcfa5b633d9bb5` | `node scripts/review24_package_privacy_hygiene.cjs` | 1 | INTENDED RED | Detected 12 identity-bearing historical references across 7 packaged files without embedding the person’s name in the test. |
| `scripts/review24_workspace_snapshot_scheduler_boundary.cjs` | NEW | R24-T02 | `a321161f57df18b0b184808dc4b242b61e8dac78dceb1e62ae0009de62c58677` | `node scripts/review24_workspace_snapshot_scheduler_boundary.cjs` | 0 | PASS | Archived historical occurrence preserved via explicit workspace historicalSnapshots; authoritative time/duration/assignment assertions pass. |

## Sensitivity evidence

- **R24-T03 privacy probe:** intentionally fails on PR21 and enumerates 12 structural privacy violations. It is expected to pass only after the package is anonymised. This is the required red-on-defective-baseline sensitivity demonstration.
- **R24-T01 persistence correction:** the original suite fails with a TypeError at `test_persistence.cjs:939`; the reviewer-modified suite reaches completion and reports `ALL PERSISTENCE REGRESSION TESTS PASSED (100%)`. This demonstrates that the failure was in the stale assertion rather than the recovery implementation.
- **R24-T02 scheduler boundary:** passes without loading `initialJobs.js`, `staffRoster.js` or `historicalOccurrences.js`, demonstrating the supported workspace snapshot boundary independently of legacy seed globals.
- **R24-T04 runner:** unlike the submitted fail-fast runner, it continues after scheduler failure and exposes subsequent persistence, rostering, lifecycle and browser statuses.

## Current baseline outcomes exposed by the complete-evidence runner

`5 PASSED, 3 FAILED, 1 BLOCKED, 9 SUITES`

- Scheduler regression: FAILED — stale legacy historical fixture expectation.
- Persistence regression: PASSED with reviewer test correction.
- Rostering engine regression: FAILED — stale legacy historical fixture.
- Rostering lifecycle: FAILED — known FR-07 Test 14 fixture.
- Browser smoke: BLOCKED — Playwright dependency absent in review environment.
