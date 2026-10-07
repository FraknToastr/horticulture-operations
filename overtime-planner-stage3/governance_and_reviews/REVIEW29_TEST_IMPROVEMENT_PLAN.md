# Review 29 — Test improvement plan

1. **P0 — Retained-acceptance integration:** Make B1/B2/B3/C and canonical-restore suites mandatory in the master release pipeline. `review29_accepted_gate_regressions.cjs` is a reviewer-authored, runnable initial B1/B2 check; it is intentionally red on PR22. Keep all nine RG suites too.
2. **P0 — Negative canonical-input matrix:** For every authoritative live-state and proposed domain, inject explicitly null, malformed, and omitted values separately. Assert no live-state mutation, no storage-byte change, truthful failure, and no partial proposal adoption. Avoid `|| []`/`|| {}` as invalid-value coercion.
3. **P0 — Allocation shift-contract probe:** Recreate the B2 scenario 2.1 missing-jobName shift path; assert it does not throw, that IDs match unambiguously and legitimate repeat reduction preserves unrelated snapshots.
4. **P1 — Complete-evidence runner:** Include individual suite status, bounded per-suite timeout, explicit dependency-blocked classification, aggregate nonzero result, and CI-readable machine summary. Verify missing Playwright cannot count as a pass.
5. **P1 — Browser reproducibility:** Record supported Playwright version, browser binary install procedure, exact command and logs for file:// smoke. Exercise clean start, recovery modal, allocation, import/export and scrolling on release artifact.
6. **P1 — Behavioral FR-03 matrix:** In addition to pure elapsed-hour checks, test eligibility-engine flows with adjacent-day, cross-midnight, both Adelaide DST transitions, and conflicting regular-hours commitments where represented by the application.

Reviewer test patch contains **only** the new executable retained-gate checker. No production files were modified.
