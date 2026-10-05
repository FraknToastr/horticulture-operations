# Independent Review 28 — PR21_01 vs PR21_02

**Date:** 28 September 2026  
**Protocol:** Universal Horticulture Applications Testing & Review Standard v1.1  
**Scope:** Stage 1 Gate C review-delta equivalence, Review 27 editorial closure, focused regression and current release-health reconciliation.  
**Review basis:** Both user-supplied delta archives independently overlaid on `HortOps-Stage1-GateC-Full-PeerReview-PR21(1).zip`; reconstructed trees are not independently provided new full companion archives.

## Decision

**PR21_01 is content-identical to previously reviewed `HortOps-Stage1-GateC-PR21(4).zip`. PR21_02 closes the two outstanding Review 27 non-blocking status inconsistencies. Gate C acceptance remains valid for its defined scope. Gate D is awaiting explicit user authorisation, and the application is not certified release-ready.**

## Archive identity and change inventory

| Archive | SHA-256 | Entries |
| --- | --- | ---: |
| Previously reviewed `PR21(4)` | `faf4409a74816a5013473b30a8afcb161362bbdbc3598c9d42610ade23477e2d` | 29 |
| `PR21_01` | `ee76383b010bf7319eeb3f53ef9be0097e2b6fcd50cd9bcdceb4dff573bcf243` | 29 |
| `PR21_02` | `6a30a269ea7bc8896f3e43990138d262e903dfe3338775334679a0336dd376a7` | 30 |

`PR21(4)` and `PR21_01` have **identical per-entry SHA-256 hashes and the same paths**; the archives differ at the ZIP-byte level, e.g. metadata/recompression. Treat them as identical source/evidence revisions, but not byte-identical ZIPs.

Changes from `PR21_01` to `PR21_02`:
- **Modified:** `ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md`: removes outdated pending Review 26 status in its state diagram and detailed Gate C acceptance section; updates the current ledger to the `_01` version.
- **Modified:** `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`: adds a Review 27 verification entry, updates Gate D tracking ID and reconciles current Gate C evidence status.
- **Added:** `scripts/review27_current_status_consistency.cjs`.
- **Regenerated:** `MANIFEST.sha256.txt`.

**No production source, existing tests, compiled HTML, or other archive entries changed.** Both standalone entrypoints remain SHA-256 `5ec73836ea4a2502425cec531963c05bbf4d3e450bb5b8852c430f3a8cb372a8`.

## Independently reproduced verification on PR21_02 reconstructed tree

| Verification | Result |
| --- | --- |
| Archive integrity and SHA-256 manifest | PASS |
| Review 26 governance crosscheck | PASS |
| New Review 27 current-status consistency | PASS |
| Review 25 evidence consistency | PASS; accurately reports 5 pass, 3 fail, 1 blocked |
| Review 24 configured privacy-hygiene patterns | PASS; **pattern-limited, not an exhaustive PII certification** |
| Gate C dedicated suite | PASS (7/7) |
| Gates B1, B2, B3 | PASS (B3 18/18) |
| Canonical restore, corrected persistence, historical snapshot scheduler probe | PASS |
| Deletion hygiene, Review 23 focused probes | PASS |
| Reconstructed release battery | **5 PASS / 3 FAIL / 1 BLOCKED** |
| Reviewer-authored format-tolerant governance probe | PASS |

**Full battery failure detail:** Scheduler fails an archived retired-job historical-actuals assertion; rostering engine fails snapshot `startTime` preservation in Test 18a; frozen rostering lifecycle fails because the older harness does not supply an explicit current-v2 workspace; Playwright smoke is blocked because `playwright` is not installed in this review environment. These failures reproduce the existing Gate D backlog and do not, by themselves, demonstrate a new Gate C defect. The failing scheduler/rostering assertions must still be investigated during Gate D; their classification as stale fixture issues is not proof that production behaviour is correct.

## Findings and recommendations

**R28-01 — CLOSED: Prior Review 27 status inconsistencies.** The live roadmap now describes Gate C as accepted and Gate D as awaiting authorisation; the transition register contains the Review 27 verification event, and detailed Gate C evidence no longer says acceptance is pending. No further Gate C corrective cycle is warranted for these findings.

**R28-02 — LOW, NON-BLOCKING: Governance-test formatting brittleness.** The supplied Review 27 test uses exact regexes against the accidentally spaced Markdown ledger labels `**Gate C **` and `**Gate D **`. If those labels are corrected to conventional `**Gate C**` and `**Gate D**`, the test will fail despite the meaning remaining correct. A reviewer-authored format-tolerant alternative is provided separately. Recommendation: use semantic table-cell normalisation instead of exact whitespace matching and, when convenient, correct the ledger's bold formatting. This is test-maintenance advice, not a Gate C blocker.

**R28-03 — Deferred Gate D integrated release work.** Preserve FR-02 Gregorian/recurrence precision; FR-03 Adelaide-local/DST 10-hour rest; FR-07 frozen lifecycle fixtures; FR-09 ES5 reconciliation; browser smoke under `file://`; and remediation/verification of historical scheduler and rostering fixtures. No Gate D development is authorised by this review.

## Reusable reviewer test

`scripts/review28_governance_status_robust.cjs` is a standalone reviewer-authored suggestion. It verifies the authoritative roadmap ledger, current Gate C detailed sections and Review 27 provenance, while tolerating semantically irrelevant Markdown bold-marker spacing. It passed against the reconstructed PR21_02 tree. It is not silently integrated into the project and does not change production code.

## Next step

Record Review 28 as verification of the `_01` duplicate and `_02` Review 27 closure. Preserve Gate C's accepted status and await the user's explicit Gate D authorisation. Address R28-02 opportunistically in future governance-test maintenance; do not open another Gate C gate solely for it.
