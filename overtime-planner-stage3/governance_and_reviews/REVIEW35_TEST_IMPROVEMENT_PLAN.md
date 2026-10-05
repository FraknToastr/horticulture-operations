# Review 35 — Test improvement plan

**Priority: Low; non-blocking.** Update the retained Review 28 governance test to accept the authoritative current Gate D `ACCEPTED / CLOSED` status, preserving all other controls. An executable single-file patch is supplied. The original test fails on PR22_03, whereas the patched test passes. No production, release-runner or application changes are recommended. Longer-term, avoid time-frozen lifecycle statuses in historical regression tests unless a stage-scoped fixture is explicitly under test.
