# Review 31 — Test Improvement Plan

| Priority | Target | Recommended change | Acceptance criterion |
|---|---|---|---|
| P1 | `test_browser_smoke.cjs` | Test the declared `dist/hort_ops_offline_planner.html` release artifact over `file://`, or truthfully identify root index and assert pre-test byte identity. | Browser transcript shows the exact target, all existing workflows pass, zero console/page errors. |
| P1 | `review25_evidence_claim_consistency.cjs` | A timeout must be BLOCKED/nonzero rather than `process.exit(0)`; malformed, incomplete or unavailable logs must also fail closed. | Unit/integration probe demonstrates timeout, partial log and aggregate mismatch cannot return success. |
| P1 | RG9 provenance | Capture Playwright version, Chromium version, exact command, exit code, timestamp, bundle SHA-256 and run-specific screenshot. | Independent reviewer can reproduce the same browser assertions and correlate evidence with the submitted bundle. |
| P2 | Release evidence | Preserve a single completed 17-suite runner log for evidence crosschecks; don't spawn a second expensive runner inside the probe when a complete verified log is available. | One traceable aggregate log reconciles suite statuses, total, and runner process exit. |
| P2 | Browser test execution portability | Avoid assumptions about globally installed `/usr/local/lib/node_modules/playwright`; document installation or resolve from locked local dependency at build/test time only, not in the offline production artifact. | RG9 runs on a freshly provisioned review host with documented prerequisites. |

**Reviewer test artifact:** `REVIEW31_REVIEWER_TEST_PATCH.zip`, containing `scripts/review31_release_evidence_contract.cjs`. Run with `node scripts/review31_release_evidence_contract.cjs /path/to/project`. On this submission it produces two PASS and two **INTENDED RED** findings; the two failure assertions must turn green after the narrowly scoped evidence/test corrections.
