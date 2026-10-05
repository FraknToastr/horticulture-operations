# Independent Review 30 — Stage 1 Gate D PR22 corrective resubmission

**Review basis:** `HortOps-Stage1-GateD-Full-PeerReview-PR22(1).zip` (173 archived files), assessed independently under Review Protocol v1.1. **Disposition: technically corrected, conditional hold on final Gate D acceptance pending independently reproducible browser smoke.** Stage 2 must not begin until the independent release checkpoint has been formally accepted.

## Executive findings

1. **Review 29 B1 regression closed.** Retained B1 suite passes; the reviewer-authored negative canonical-domain test also passes. B2, B3, C and restore suites pass. In contrast to Review 29, no accepted-gate regression was independently reproduced.
2. **Review 29 B2 regression closed.** Retained B2 suite and the original Review 29 accepted-gate probe both pass; the revised release runner includes these retained tests rather than running only RG1–RG9.
3. **FR-02 and FR-03 verified.** Both dedicated calendar and Adelaide DST/rest suites pass.
4. **Lifecycle verification completed independently.** `node scripts/test_rostering_lifecycle.cjs` terminates successfully with all 158 assertions passing. The aggregate runner completed its first 15 suites successfully but did not finish within the review execution window while on suite 16. An aggregate 17/17 pass is therefore **not independently attested** here.
5. **Browser smoke is blocked in this review environment.** `node scripts/test_browser_smoke.cjs` exits because `playwright` is unavailable. The developer's included evidence asserts an earlier browser pass, but reviewer reproduction is outstanding. An available system Chromium binary by itself is not equivalent to the Playwright test.
6. **Archive integrity and hygiene verified.** `sha256sum -c MANIFEST.sha256.txt`, deletion checker and package-wide privacy probe pass. `index.html` and `dist/hort_ops_offline_planner.html` have identical SHA-256 (`6fae7b1019698356b6a533853e76eea04ed62add01088a2f1955ed8104dfae05`). Governance crosschecks and the Review 29 accepted-gate regression probe pass.

## Independently executed evidence

| Check | Result |
|---|---|
| Master runner suites 1–15 (retained gates, FR-02/03 and RG1–RG7) | 15 pass |
| RG8 lifecycle, isolated process | PASS, 158/158 |
| RG9 Playwright, isolated process | BLOCKED, module not installed |
| Full 17-suite runner in this environment | INCOMPLETE; execution deadline reached in RG8 |
| Archive manifest, deletion and privacy | PASS |
| Review 26/27/28 governance probes | PASS |
| Review 29 accepted-gate regression probe | PASS |
| Legacy Review 25 evidence probe | TIMEOUT; internally launches entire runner with a 120-second budget, insufficient for this environment. Do not record this as an application defect or a pass. |

## Acceptance boundary and required next action

**Do not conflate an unavailable Playwright dependency with a failed application smoke test.** Preserve the developer's original Playwright transcript and exact execution environment, then reproduce RG9 against the distributed `file://` bundle using the documented Playwright version/browser installation. Independently confirm no page errors, no console errors and all expected interactions. Run the full 17-suite command in an adequately resourced environment (and allow the lifecycle suite enough runtime); capture exit code, per-suite statuses and aggregate counts. Only after these checks pass should the independent reviewer record formal Gate D acceptance. No Stage 2 implementation is authorised by this review.

## Test improvement recommendations

- Retain all six accepted/negative gate checks in the master runner permanently; add automated inspection to prevent their future omission (test included in patch).
- Separate an execution-environment failure (missing Playwright) from a programmatic assertion failure in every gate report; never turn BLOCKED into PASS.
- The inherited `review25_evidence_claim_consistency.cjs` launches the entire battery under a hardcoded 120-second timeout. Update it to consume a completed runner's machine-readable result or a supplied log rather than nesting an entire potentially long battery; alternatively give it an appropriate configurable timeout and surface timeouts as BLOCKED. Never weaken its evidence-consistency assertion.
- Preserve deterministic synthetic fixtures and independent boundary probes; do not restore legacy seed dependencies merely to make tests green.

## Minimal corrective handoff for Gemini

No new production-code defect is established in this retry. Supply reproducible browser-smoke evidence, a complete 17-suite run with actual machine exit code, and (if necessary) a test-only execution-timeout adjustment. Keep the release checkpoint bounded to Gate D. Do not commence Stage 2 pending independent acceptance.
