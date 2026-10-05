# Review 36 — Test Improvement Plan

**Current corrective need: None.** The Review 35 optional fix is integrated and its test passes. No additional production, test, or release-runner modifications are recommended for PR22_04.

**Future maintenance:** Retain stage-aware governance assertions and invoke the Review 31 evidence contract with an explicit project root in independent overlays (`node scripts/review31_release_evidence_contract.cjs "$PWD"`). Continue to distinguish independently executed tests from developer-supplied browser logs.
