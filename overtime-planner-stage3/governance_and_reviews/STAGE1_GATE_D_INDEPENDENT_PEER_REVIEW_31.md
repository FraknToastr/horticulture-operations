# Independent Review 31 — Stage 1 Gate D PR22 (latest full package)

**Review standard:** Horticulture Applications Universal Engineering, Testing & Independent Review Standard v1.1  
**Input:** `HortOps-Stage1-GateD-Full-PeerReview-PR22(2).zip`  
**Comparison baseline:** preceding `HortOps-Stage1-GateD-Full-PeerReview-PR22(1).zip`  
**Disposition:** CONDITIONAL HOLD — Stage 1 Gate D is **not independently accepted**; Stage 2 remains unauthorised.

## Executive decision
The new package closes the independently established Review 29 B1/B2 regressions and integrates the Review 30 regression probe. The submitted production sources and both standalone HTML bundles are byte-for-byte identical to the prior full PR22 candidate. The full integrated battery was independently executed: **16 PASS, 0 FAIL, 1 BLOCKED**. RG8 completed and passed all 158 frozen lifecycle assertions. RG9 could not be reproduced because the review host has neither Playwright nor playwright-core. This is an environment block, **not** a demonstrated application failure.

The developer's package claims a complete **17/17 PASS** from a separate environment. That result is developer-supplied evidence, not independently reproduced here. Two additional review-evidence weaknesses require limited test-only corrections; neither is evidence of a production-code defect.

## Package comparison and provenance
- Previous full archive and current full archive have different ZIP hashes. A content comparison finds **173 prior files and 176 current files**.
- Added: `scripts/review30_gate_d_regression.cjs`, `governance_and_reviews/REVIEW30_TEST_PATCH_VERIFICATION.md`, and `governance_and_reviews/STAGE1_GATE_D_INDEPENDENT_PEER_REVIEW_30.md`.
- Changed: eight documentation/packaging/test-support files and the SHA-256 manifest. **No production JavaScript, CSS, `index.html`, or `dist/hort_ops_offline_planner.html` content changes** compared with the preceding full PR22 archive.
- `sha256sum -c MANIFEST.sha256.txt`: all listed files OK.
- Standalone `index.html` and `dist/hort_ops_offline_planner.html` both SHA-256 `6fae7b1019698356b6a533853e76eea04ed62add01088a2f1955ed8104dfae05`.
- `scripts/verify_deletions.cjs` and `scripts/review24_package_privacy_hygiene.cjs .` pass.

## Reproduced integration evidence
`node scripts/run_all_release_gates.cjs` produced **16 PASSED, 0 FAILED, 1 BLOCKED, 17 SUITES**, with the full lifecycle suite ending in **42.94 seconds** and exit 0. Suites 1–15 pass: B1, B2, B3, C, canonical restore, Review 29 negative-domain matrix, FR-02, FR-03, RG1–RG7. Suite 16 (RG8) passes all 158 lifecycle assertions. Suite 17 (RG9) reports **MODULE_NOT_FOUND: playwright**. The aggregate runner correctly reports BLOCKED and exits nonzero.

`node scripts/review30_gate_d_regression.cjs .` passes its retained-gate, lifecycle/browser registration, and Review 29 closure checks. The privacy and governance-current-status probes pass.

## Findings

### R31-01 — Medium: Browser evidence and actual artifact target disagree
`GATE_D_CHANGE_AND_EVIDENCE_REPORT.md` states that `scripts/test_browser_smoke.cjs` verifies the compiled `dist/hort_ops_offline_planner.html`. But the script defines `fileUrl` from the root `index.html`. Both artifacts are byte-identical **in this submission**, so the discrepancy has not demonstrated different application behaviour. Nonetheless, release test evidence must precisely identify the artifact exercised. Either update the test to target `dist/hort_ops_offline_planner.html` (preferred release test), or correct the claim and add an explicit byte-identity precondition if testing root `index.html` is intentional. Maintain the `file://` protocol.

### R31-02 — Medium: Nested evidence-consistency probe falsely succeeds on timeout
`scripts/review25_evidence_claim_consistency.cjs` now allows `RUNNER_TIMEOUT` (default 300 seconds) and accepts `RUNNER_LOG`, addressing the earlier fixed-timeout issue. However, its `ETIMEDOUT` branch prints `BLOCKED` and then calls `process.exit(0)`. This is false-green behaviour when run directly or through another wrapper: absent release-runner evidence must not be reported as a passing verification. Change timeout handling to a distinct nonzero exit and retain the current strict mismatch assertion. Prefer using a completed aggregate log with demonstrable provenance to avoid rerunning a long battery inside an evidence probe.

### R31-03 — Acceptance evidence: browser smoke not independently reproduced
The package includes developer-asserted Playwright results (0 console/page errors, 17/17 pass). The current review environment does not have Playwright installed; Chromium alone is not a reproduction of the 1,300-line browser suite. A manual Chromium headless launch was also inconclusive in this environment. No application defect is inferred. Preserve executable version/browser provenance and machine-readable, independently reproducible Playwright output; repeat RG9 and the final complete runner on a Playwright-equipped review host.

### Evidence freshness — Advisory
The packaged `offline_release_gates_verified.png` is **byte-identical** to the screenshot in the preceding full PR22 package. This does not falsify the supplied current browser transcript, but the screenshot is not proof of a fresh Review 30 browser execution. Supply a run-specific screenshot or label the image historical; record the execution timestamp and bundle hash alongside it.

## Corrective handoff for Gemini (bounded scope)
1. Resolve R31-01 by aligning the browser test's `fileUrl` target with the precise distributed artifact documented by the release report. Preserve existing browser assertions and `file://` execution. Retain the current deterministic byte-identity test.
2. Resolve R31-02: change the evidence probe's timeout path to return nonzero/BLOCKED and make its log-consumption mode validate a complete parsed summary and fail on mismatched blanket PASS claims. Do not weaken assertions or silently skip browser failure. Include a test simulating the timeout and proving nonzero status.
3. Capture a reproducible RG9 transcript from an environment with Playwright and browser versions recorded; show `file://` target, zero page/console errors, actual exit code, execution date, and independently correlated screenshot. Execute the full 17-suite runner and capture its exit code and complete summary.
4. Provide an **incremental/minimal** peer-review ZIP (changed test files, factual evidence and packaging manifest only). Do not modify application production code solely for these evidence corrections. Stop after submission for independent Gate D acceptance; do not begin Stage 2.

## Formal acceptance conditions
- Reviewer-authored R31 evidence contract probe is green, or equivalent stronger tests are supplied and independently verified.
- RG9 executes successfully against the specified distribution artifact in an independently reproducible environment; its console/page-error and workflow assertions all pass.
- A complete 17-suite release battery executes and reports 17 PASS, 0 FAIL, 0 BLOCKED with a verified exit 0, and documented provenance. Existing accepted gates and architectural invariants remain unchanged.

**No new production defects independently established. Gate D formal acceptance is withheld pending the evidence items above.**
