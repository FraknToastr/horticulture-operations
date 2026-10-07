# Independent Review 36 — Stage 1 Gate D PR22_04

**Date:** 29 September 2026  
**Review standard:** Universal Horticulture Engineering Test and Review Standard v1.1  
**Submission:** `HortOps-Stage1-GateD-PR22_04.zip`  
**Baseline:** Full PR22_01 overlaid with PR22_02, PR22_03, then PR22_04  
**Disposition:** Review 35 optional governance-test correction VERIFIED; no production changes or new blockers. Stage 2 may continue under the user's existing authorisation.

## Scope and differential

PR22_04 is a four-file incremental package:
- `scripts/review28_governance_status_robust.cjs` — changes the expected current Gate D ledger status from `AWAITING AUTHORISATION|SUBMITTED` to `ACCEPTED / CLOSED` while retaining Gate C and Review 27 provenance assertions.
- `governance_and_reviews/STAGE1_GATE_D_INDEPENDENT_PEER_REVIEW_35.md` — archives Review 35.
- `governance_and_reviews/REVIEW35_TEST_IMPROVEMENT_PLAN.md` — archives the optional test-maintenance recommendation.
- `MANIFEST.sha256.txt` — regenerated full-tree manifest.

The archived Review 35 document necessarily describes the old test failure as historical review evidence; it is not a current defect claim. No application, build, or distribution code changed in PR22_04.

## Independently reproduced checks

| Check | Result |
|---|---|
| Merged-tree SHA-256 manifest (193 lines) | PASS |
| Corrected Review 28 governance/provenance test | PASS |
| Review 27 current-status test | PASS |
| Review 34 residual-roadmap assertions | 3 PASS, 0 FAIL |
| Review 26 governance crosscheck | PASS |
| Review 33 roadmap status | 3 PASS, 0 FAIL |
| Review 31 evidence contract (explicit project-root argument) | 4 PASS, 0 FAIL |
| Review 32 evidence provenance | 4 PASS, 0 FAIL |
| Review 29 accepted-gate regressions | 2 PASS, 0 FAIL |
| Review 30 regression suite | PASS |
| Privacy-hygiene check | PASS |
| Deletion verification | PASS |
| Gate B1, Gate B2, Gate C | PASS |
| Gate B3 | 18/18 PASS |
| Persistence regression | PASS |
| `index.html` vs `dist/hort_ops_offline_planner.html` | SHA-256 equal |

Standalone bundle SHA-256: `6fae7b1019698356b6a533853e76eea04ed62add01088a2f1955ed8104dfae05`.
PR22_04 ZIP SHA-256: `c3c1e47f44dc581eb16bd4c3574d4aaa6d2ec0cb147308b3fe272da43edf3c85`.

## Test recommendation

No further PR22_04 test changes are required. For future reviews, pass the project root explicitly to `scripts/review31_release_evidence_contract.cjs` when executing it outside its originally expected directory layout. This avoids a harness-path `ENOENT` and is not a production bug. Historical governance tests should use stage-aware expectations for the current ledger instead of freezing a transitional status forever.

## Limitations and disposition

The aggregate 17-suite release runner and browser smoke were not rerun for this test/documentation-only increment. Independent browser execution remains subject to the limitations recorded in earlier reviews, and the supplied developer browser logs are not independent execution. This review does not reopen accepted Stage 1 production gates and introduces no new blocker to the user-authorised Stage 2 programme.
