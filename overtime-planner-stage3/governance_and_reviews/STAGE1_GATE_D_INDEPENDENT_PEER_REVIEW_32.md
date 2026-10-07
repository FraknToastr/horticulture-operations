# Independent Review 32 — Stage 1 Gate D PR22 final submission

**Reviewed:** `HortOps-Stage1-GateD-Full-PeerReview-PR22(3).zip`  
**Framework:** Horticulture Universal Engineering Test and Review Standard v1.1 / accepted Stage 1 invariants C1–C10 and I1–I12  
**Assessment:** Production and retained-gate checks passing where independently executed. Review 31 source/evidence corrections closed. **One new test-evidence safeguard weakness remains, and Playwright browser smoke was not independently executable in this environment.** Gemini's supplied evidence reports the full 17/17 pass, but the reviewer does not represent that result as an independently reproduced full browser run.

## 1. Scope and reconstructed baseline

Used the latest complete ZIP directly as the review baseline. Its manifest verifies, its privacy and deletion checks pass, and `index.html` and `dist/hort_ops_offline_planner.html` have identical SHA-256 hashes (`6fae7b1019698356b6a533853e76eea04ed62add01088a2f1955ed8104dfae05`). No production-code changes are recommended on the evidence reproduced in this review.

## 2. Review 31 closure

`scripts/review31_release_evidence_contract.cjs .` returned **4 PASS, 0 FAIL**. Browser smoke now explicitly opens the `dist` artifact under `file://`. The evidence probe's timeout branch now exits nonzero. The browser script monitors console errors and page exceptions and verifies both arrays are empty before declaring success.

## 3. Independent execution

- Master release runner: suites 1–15 passed (retained Gate B1/B2/B3/C; canonical restore; negative-domain matrix; FR-02; FR-03; static audit; scheduler; workforce; persistence; rostering; recovery; multi-year differential). The aggregate invocation was interrupted by the execution environment during suite 16; therefore it does not demonstrate a completed aggregate exit.
- Independent lifecycle execution: all **158 assertions passed**, exit 0.
- Browser smoke: the Playwright dependency is not installed here, and an attempted Chromium CLI fallback timed out. Therefore RG9 could not be independently executed; this is an environment limitation, not an established application defect.
- Developer-submitted evidence in briefing/report: reports all 17 suites passed, with RG9 completing successfully on the built `dist` file and zero console/page errors. Packaged screenshot SHA-256 matches the report (`b8c256d3a7932c25dafefbecb06d78a04f19acd40ff1e6a0ef678d5037017247`). A screenshot and report support provenance but are not equivalent to an independently reproduced browser run.

## 4. New independent finding — R32-E1 (medium, test-evidence reliability)

The updated `review25_evidence_claim_consistency.cjs` correctly rejects a master-runner timeout but still treats a **red** simulated runner summary as success if the briefing lacks the literal phrase `Entire test suite 100% PASS`. This package instead says `17 PASSED, 0 FAILED, 0 BLOCKED` and `100% green`, leaving its aggregate evidence unchecked for those formulations. This issue is reproduced by reviewer test `review32_evidence_provenance.cjs`: the original tree yields **3 PASS, 1 FAIL**. The patch changes the evidence probe to require all 17 declared suites, consistent counts, zero failures, zero blocked suites, and a successful actual runner exit. The reviewer test yields **4 PASS, 0 FAIL** when applied to the proposed patch. No production modules are changed.

**Disposition:** Correct the test-evidence probe before treating the evidence safeguard itself as independently verified. This is a bounded test-only change, not a reason to reopen accepted B1–C or to begin another production correction cycle. Do not weaken the test by removing the contradictory-result assertion.

## 5. Gate D and Stage 2 decision record

- Review 31 source/evidence corrections: **verified closed**.
- Independently reproduced nonbrowser functional test coverage: **passing** (15 integrated suites plus independent 158-check lifecycle).
- Independent full 17/17 execution: **not reproduced in this reviewer environment**; Gemini reports 17/17, including browser smoke.
- Additional R32-E1 test-evidence integrity correction: **patch supplied and verified separately; not present in submitted ZIP**.
- Stage 2: **user authorised commencement**. The submitted briefing still says Stage 2 is not authorised because it was written before that decision. Reconcile it in the next governing handoff; do not misrepresent the user's authorisation or the provenance of Gate D evidence.

**Acceptance wording:** Reviewer-verified closure of the previous Review 31 issues and no new demonstrated production defect. Formal *independent* unconditional browser acceptance is not asserted without an executable browser run or a separately authorised evidence-acceptance decision. Do not represent the original 17/17 vendor claim as an independently reproduced full battery.

## 6. Corrective handoff

Apply only the supplied `scripts/review25_evidence_claim_consistency.cjs` test patch. Integrate `review32_evidence_provenance.cjs` as a regression test, confirm original-tree intended failure and corrected-tree 4/4 PASS, then run the full 17-suite battery in the Playwright-equipped environment, retaining original unedited stdout/stderr and exit status as evidence. Update the Stage 1 closure/Stage 2 handoff ledger to accurately reflect user authorisation and distinguish Gemini's full 17/17 execution from this independent review's partial reproduced coverage. Supply only changed test/document files and logs in the next minimal package.
