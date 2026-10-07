# Independent Review 29 — Stage 1 Gate D, PR22

**Target:** `HortOps-Stage1-GateD-Full-PeerReview-PR22.zip`  
**Protocol:** Horticulture Applications Universal Engineering Test and Review Standard v1.1  
**Date:** 28 September 2026  
**Decision:** **NOT ACCEPTED — corrective submission required.** Stage 2 remains unauthorised.

## 1. Executive result

PR22's dedicated FR-02 and FR-03 tests, deletion/privacy probes, archive checksum verification, deterministic standalone bundle equivalence, and the RG1–RG8 release-runner component suites when tested individually largely pass. However, two previously accepted Gate B1/B2 suites fail on PR22 while passing on the supplied prior full PR21 package. The master RG1–RG9 runner does not include those acceptance suites. Its claimed nine green suites are therefore insufficient to demonstrate preservation of Stage 1 accepted contracts. Browser smoke could not be independently executed because Playwright is absent from the review environment; this is **blocked**, not an observed application failure. The aggregate master runner did not complete within this review's bounded execution window and therefore its 9/9 claim was not independently reproduced.

## 2. Blocking findings

### R29-01 — High: canonical-save fail-closed invariant regressed (Gate B1)

**Evidence:** `node scripts/test_gate_b1.cjs` fails at assertion 8, probe 8.2: `jobs:null` is expected to cause `saveCurrentWorkspace()` to return false, but it returns true. The same test passes on the previous full PR21 package. In PR22, `js/app.js`, `_commitCanonicalProposal()`, uses `proposalOverrides.jobs || (this.state && this.state.jobs) || []` (and analogous fallback defaults for roster, assignments, rostering and snapshots). Thus malformed present domains may be silently replaced with empty defaults; the coordinator also mutates some live-state fields before validation. This undermines accepted B1/B3 fail-closed and stage-before-commit contracts and creates possible operational data loss.

**Required correction:** Preserve null/invalid domains as invalid and fail before any mutation to live memory or persistence. Distinguish omitted overrides from explicitly supplied null/invalid values; do not use truthiness fallbacks for authoritative canonical domains. Check all equivalent fallback paths, not only `jobs`. Rerun B1, B3 and adversarial atomicity tests and add dedicated negative tests for each affected domain.

### R29-02 — High: previously accepted Gate B2 allocation workflow crashes

**Evidence:** `node scripts/test_gate_b2.cjs` fails in scenario 2.1 (repeat reduction) with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` from `js/components/staffAssignModal.js`, matching a job using `shift.jobName.toLowerCase()`. Both `test_gate_b2.cjs` and `staffAssignModal.js` are unchanged from the prior full PR21 package, where the suite passes. PR22 changed `js/app.js` and `js/utils/scheduler/engine.js`; these changes require tracing to determine why a shift reaching this accepted workflow has no `jobName`. Do not presume that the unchanged modal alone is the root cause.

**Required correction:** Trace the source of the missing `jobName` through scheduling/digest and modal allocation, restore the accepted shift contract or robustly match by stable ID as appropriate, and guard malformed display fields without masking invalid authoritative data. Verify that repeat reduction properly prunes only instruction-owned future commitments and preserves unrelated historical snapshots. Rerun full B2 and related integration/recovery suites.

### R29-03 — Medium: release gate coverage omits accepted-gate regression checks

**Evidence:** `scripts/run_all_release_gates.cjs` enumerates RG1–RG9 but does not execute `test_gate_b1.cjs` or `test_gate_b2.cjs`. PR22's evidence claims complete Stage 1 gate compliance, yet those two accepted-gate tests fail independently. This is a release-harness coverage gap, distinct from the two production regressions.

**Required correction:** Add a mandatory retained-acceptance battery (B1/B2/B3/C and canonical restore) to the integrated release gate run or a required preflight invoked by the master runner. Every suite must report PASS/FAIL/BLOCKED independently and preserve original failure output and nonzero aggregate exit on failure. Do not weaken assertions or remove accepted tests to reach green.

## 3. Verified checks and environmental limits

| Check | Independent result | Notes |
|---|---|---|
| Package manifest | PASS | `sha256sum -c MANIFEST.sha256.txt` |
| Standalone bundle equivalence | PASS | Both bundles SHA-256 `d13ec80bd139920fe47f698213dea37f96a52599fa9e4023aa7605cd5768bf72` |
| Deletion and privacy | PASS | Dedicated scripts |
| FR-02 | PASS | Dedicated nine-case suite |
| FR-03 | PASS | Dedicated five-case suite |
| Gate C, B3, R23 restore | PASS | Executed independently |
| B1 | FAIL | Probe 8.2, previously accepted contract |
| B2 | FAIL | Scenario 2.1, previously accepted contract |
| Static, scheduler, workforce, persistence, rostering engine, recovery, multi-year differential | PASS | Independently executed |
| Lifecycle | PASS | 158/158 when allowed longer than 12-second per-suite probe limit |
| Browser smoke | BLOCKED | Playwright package not installed in this review environment; no browser verdict |
| Master runner | NOT FULLY REPRODUCED | Bounded run did not complete; individual constituent results above take precedence |

**Important:** The supplied report records 9/9 passing RG suites on the developer's environment; this review does not independently certify that claim. Installed Chromium is not a substitute for the missing Playwright package. Package verification does not establish that runtime workflows are defect-free.

## 4. Corrective-only Gemini handoff

Implement only R29-01 and R29-02 production corrections and R29-03 test/release-runner inclusion. Preserve current Gate D FR-02/FR-03 behavior, offline requirements, deterministic builds, existing approved architecture and Gate C privacy status. Add focused regressions for invalid canonical domains and missing-name shift reconciliation. Deliver a minimal changed-files ZIP, evidence mapping each finding to before/after execution logs, rebuilt byte-identical standalone HTML, complete retained acceptance results, and the full release-gate battery. Reproduce all tests in an environment with Playwright before asserting RG9 PASS. Stop at Gate D corrective resubmission for independent acceptance; do not commence Stage 2.

## 5. Acceptance criteria

- Both previously accepted B1 and B2 suites pass, including their original discriminating checks, without weakened assertions.
- Dedicated newly added tests expose original bad behavior on PR22 and pass after correction.
- No mutation of live state and no storage writes on invalid input, including explicit null domains; successful valid commits remain canonical.
- All prior Gate B3/C, privacy and restore probes stay green.
- Full integrated runner covers retained acceptance checks and reports complete truthful evidence; browser smoke passes in a reproducible, dependency-equipped environment.
- Bundles remain byte-identical and manifest regenerates cleanly.
