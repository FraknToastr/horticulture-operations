# Independent Review 27 — Review 26 Governance Correction Verification

**Date:** 28 September 2026  
**Subject:** `HortOps-Stage1-GateC-PR21(4).zip`  
**Method:** Manifest verification and independent execution on a reconstructed tree: previous full PR21 companion package, overlaid with the newly supplied corrective delta. No newly supplied complete companion was used.

## Decision

**Review 26's specifically identified governance corrections are VERIFIED CLOSED. Gate C's prior acceptance for its defined technical scope stands. Gate D still awaits explicit user authorisation.** This verification is not integrated Stage 1 release approval.

One further, non-blocking editorial inconsistency was detected in current-status detail sections: the roadmap §4.5 still reports Gate C as awaiting Review 26, while its executive summary and status ledger report it accepted. The transition register's "Submitted Gate Evidence" subsection likewise retains a heading and evaluation-status field indicating that Review 26 is pending despite the acceptance text and final ledger. Amend these current-status fields without rewriting genuinely historical entries.

## Independent verification

| Check | Result |
|---|---|
| 28 delta manifest entries, SHA-256 | PASS; no mismatches |
| Review 26 governance crosscheck | PASS |
| Review 25 evidence claim consistency | PASS: five pass, three fail, one blocked across nine release suites |
| Review 24 archive privacy pattern check | PASS within configured regex scope (not exhaustive PII certification) |
| Gate C tests | PASS |
| Gate B1/B2/B3 | PASS |
| Persistence regression | PASS; expected injected-error logging is not test failure |
| Canonical restore | PASS |
| Workspace-owned historical snapshot scheduler probe | PASS |
| Deletion manifest verification | PASS |
| Bundled `index.html` vs `dist/hort_ops_offline_planner.html` | IDENTICAL; both SHA-256 `5ec73836ea4a2502425cec531963c05bbf4d3e450bb5b8852c430f3a8cb372a8` |
| Production HTML vs previous corrective delta | UNCHANGED |
| Full RG1–RG9 integrated runner | 5 PASS, 3 FAIL, 1 BLOCKED; not release-ready |
| New reviewer current-status consistency check | INTENDED RED; detects the two residual current-status inconsistencies |

## Narrow corrective recommendation

1. In `ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md` §4.5 change the current Gate C "Outcome" to accepted in Review 26; ensure the review sentence distinguishes prior submission from final acceptance. Update the gate-transition Mermaid annotation if it purports to show live status.
2. In `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`, relabel the current Gate C submission evidence subsection as accepted/closed and change its independent evaluation-status line from awaiting Review 26 to accepted in Review 26. Retain the detailed chronology of Reviews 24, 25, and 26 as history.
3. Run `node scripts/review27_current_status_consistency.cjs` (reviewer-authored executable test included separately). It currently fails as designed and should pass following the two document-only corrections.
4. Do not modify production JavaScript, canonical schema, compiled standalone HTML, or Gate D test fixtures merely to correct this editorial issue. For the next reviewer, supply a minimal documentation-and-test delta with fresh manifest.

## Existing Gate D backlog (unchanged)

The release runner still fails scheduler, rostering engine, and frozen rostering lifecycle suites. Browser smoke remains blocked in the review environment by missing Playwright. The roadmap's FR-02, FR-03, FR-07, FR-09 and `file://` browser smoke obligations remain tracked under Gate D. A green Gate C does not imply release readiness. **Do not start Gate D without explicit user authorisation.**

## Review limitations

This pass independently exercised the reconstructed source tree, rather than a newly provided full companion archive. The current-status check intentionally focuses on active acceptance fields rather than revising historical review evidence. Playwright browser execution was not certified.
