# Independent Review 25 — Stage 1 Gate C Corrective Resubmission

**Reviewed:** `HortOps-Stage1-GateC-Full-PeerReview-PR21(1).zip`  
**Date:** 28 September 2026  
**Protocol:** Universal Horticulture Applications Review Protocol v1.1  
**Archive SHA-256:** `ecee0dcabd08dd73de2e8a91a03a2fa1483589f7f9ed956d1e8da01756fe762f`

## Decision

**Gate C: NOT YET ACCEPTED — one narrowly bounded evidence correction remains.** The earlier privacy blocker and stale persistence assertions are closed in this submission. No new Gate C production defect was demonstrated. The release-gate aggregate failures are separately tracked as Gate D work, but the current full-review briefing still makes a blanket green claim contradicted by the current aggregate output.

Do not authorise Gate D until the evidence wording is corrected and independently rechecked. No production-code changes are requested by this review.

## Reproduced checks

| Check | Result | Observation |
|---|---|---|
| Full archive manifest | PASS | SHA-256 checks verified all listed entries. |
| Deletion hygiene | PASS | Three quarantined files absent. |
| Review 23 focused probes | PASS | 0 gaps. |
| Gate C acceptance | PASS | Dedicated Gate C suite green. |
| B1, B2, B3 gates | PASS | All three green; B3 18/18. |
| Canonical restore | PASS | Review 23 restore checks green. |
| Persistence regression | PASS | Review 24 assertion corrections integrated. |
| Workspace-owned snapshot boundary | PASS | Review 24 reviewer test green. |
| Package-wide privacy probe | PASS | No *pattern-matched* identifying references detected. |
| Static release check | PASS | 45 JS files syntax checked. |
| Standalone rebuild | PASS | Both rebuilt artifacts share SHA-256 `5ec73836ea4a2502425cec531963c05bbf4d3e450bb5b8852c430f3a8cb372a8`. |
| Full release runner | NOT GREEN | 5 passed, 3 failed, 1 blocked; correctly completes all nine suites. |

**Limits:** Privacy probe scans selected text extensions for two known structural patterns, not all possible PII; PASS demonstrates closure of the specific Review 24 leakage, not a comprehensive privacy guarantee. Browser smoke cannot be assessed in this environment because Playwright is missing. The submitted product's actual browser usability is therefore unverified here.

## Remaining finding — R25-F01 (Gate C evidence consistency)

**Severity:** Gate C acceptance blocker (documentation-only, low implementation risk).  
**Location:** `00_CHATGPT_FULL_PEER_REVIEW_BRIEFING.md`, section 2, R23-REG row.  
**Observed:** It says `Entire test suite 100% PASS` in a table claiming all earlier Review 23 requirements are resolved in this package. The current master runner actually reports **5 PASSED / 3 FAILED / 1 BLOCKED**. Other sections in the updated Gate C evidence report distinguish these categories correctly, but this contradictory briefing claim survives the correction.  
**Required fix:** Replace the blanket claim with the actual current status: the dedicated Gate C and preceding B1/B2/B3 suites pass; full release validation has three legacy/test-fixture failures and one environment-blocked browser test, all tracked for Gate D subject to defect triage. If the briefing reports historical claims, label them explicitly as superseded historical claims and supply current state alongside them. Check other handoff or roadmap sections for any equivalent current-status claim.  
**Required regression:** Run the supplied reviewer test `review25_evidence_claim_consistency.cjs` after adding it under `scripts/`; it should pass once evidence is consistent with the full current runner output.

The reviewer-authored test was executed on this package and returned **INTENDED RED** with the exact discrepancy; it is not a product test failure.

## Deferred tests and scope discipline

The same three aggregate failures seen in Review 24 remain: `test_scheduler.cjs` (retired-job historical assertion), `test_rostering_engine.cjs` (legacy historical fixture expectation), and `test_rostering_lifecycle.cjs` (Test 14 requires explicit current-v2 workspace). These are *not newly demonstrated Gate C runtime failures*; investigate and modernise their fixtures under existing Gate D planning, and promote any genuine production defect if subsequently demonstrated. Browser smoke is BLOCKED by missing Playwright in the review container. FR-02, FR-03, FR-07, FR-09 and browser release smoke retain their previously assigned Gate D ownership; Gate D remains unauthorised.

## Test-improvement plan

1. **Now, Gate C:** Integrate `scripts/review25_evidence_claim_consistency.cjs` into the evidence verification runbook. It executes the aggregate runner and rejects unsupported blanket green claims. Keep the original release runner's complete-evidence behaviour.
2. **Gate D:** Replace legacy seed-dependent scheduler and rostering fixtures with synthetic canonical-v2 workspace snapshots. Preserve historical immutable-commitment assertions, rather than removing failing checks.
3. **Gate D:** Make Playwright an explicit test prerequisite and run smoke against the final rebuilt `file://` artifact; record a genuine runtime failure distinctly from unavailable tooling.
4. **Future privacy hardening:** Expand scanning beyond the two known patterns, with synthetic leak fixtures and clear handling for intentionally public contact details and historical quoted reports. Never claim total PII absence based only on a narrow regular-expression scan.

## Bounded Gemini corrective prompt

Update only the inaccurate current-status sentence and directly related governance/evidence references in the Review 25 full submission. State the current aggregate results precisely, retaining prior accepted Gate statuses. Add and execute the reviewer evidence-consistency test; keep production source and standalone bundles unchanged. Regenerate the full package's manifest and affected checksums. Supply a minimal corrective delta and truthful command outputs. Stop pending independent Gate C recheck. Do not start Gate D or unrelated work.

## Reviewer test-patch manifest

`REVIEW25_REVIEWER_TEST_PATCH.zip` contains `scripts/review25_evidence_claim_consistency.cjs` and a README. This is a diagnostic test-only patch and has not been applied to production source.
