# Review 32 — Test Improvement Plan

**Priority 1 / R32-E1:** Make evidence-consistency assertions semantic, not phrasing-sensitive. Require exactly 17 suites (until the documented battery changes), matching status totals, 0 failed/blocked, complete output and success exit status from the master runner. Patch and reviewer-owned adversarial test supplied.

**Priority 2 / evidence portability:** Attach an unedited release-run transcript, exact invocation, environment/Playwright and Chromium versions, bundle SHA-256 and process exit code. Do not substitute a screenshot or Markdown copy of log lines for the raw browser execution log.

**Priority 3 / future hardening:** Extend browser smoke to negative persistence-failure UX flows and ensure seeded browser test state is explicitly restored through the canonical contract before asserting navigation. Keep these as Stage 2 test-improvement backlog items unless a specific demonstrated regression makes them release blocking.
