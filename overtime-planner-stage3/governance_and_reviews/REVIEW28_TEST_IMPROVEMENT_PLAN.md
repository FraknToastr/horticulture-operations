# Review 28 — Test Improvement Plan

1. **Completed / reviewer-authored:** supplied `scripts/review28_governance_status_robust.cjs`; independently executed PASS against reconstructed PR21_02. This optional patch makes current-status checks robust to Markdown formatting whitespace, and also checks that the Review 27 verification entry exists.
2. **Retain existing regression tests:** Review 24 archive privacy and snapshot ownership probes; Review 25 evidence consistency; Review 26 crosscheck; Review 27 current-status check. All passed on PR21_02.
3. **Gate D backlog, not a Gate C correction:** modernise scheduler and rostering harnesses using synthetic canonical-v2 workspaces; distinguish erroneous fixture expectations from actual historical-integrity defects without relaxing production invariants. Preserve failing tests until causes are established. Install/test Playwright in an appropriate browser environment and record real `file://` outcomes.
4. **Build verification:** continue comparing deterministic generated standalone SHA-256 hashes and verifying the archive manifest on every submission.

No production patch and no additional Gate C blocking test are proposed.
