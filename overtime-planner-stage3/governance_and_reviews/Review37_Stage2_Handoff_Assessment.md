# Review 37 — Stage 2 Handoff Assessment

**Project:** Horticulture Operations Overtime Planner  
**Review subject:** Review 37 Stage 2 corrective handoff  
**Assessment:** Suitable for corrective development; Stage 2 acceptance remains outstanding.

## Executive assessment

The Review 37 package is a structured corrective handoff. It identifies six findings, supplies three independent failure-injection tests, and includes separate instructions for Gemini and the next ChatGPT review. Its central risk is **R37-01: a destructive reset may report success even when persistent storage deletion fails**. This should block Stage 2 acceptance, since the operator could believe that the workspace has been erased when data remains in browser storage.

The handoff appropriately keeps Stage 1 closed and Stage 3 unauthorised. Its reset recovery specification and testing requirements should nevertheless be strengthened before it serves as a complete Stage 2 acceptance specification.

**Scope limitation:** This assessment addresses the handoff and its reported evidence. Without independently rerunning the supplied tests against the exact PR23 source archive, the underlying code defects and reported test outcomes are not independently reconfirmed.

## 1. Findings assessment

| Finding | Priority | Assessment |
|---|---|---|
| **R37-01 — Reset failure** | P0 | The proposed correction addresses the reported defect, but partial deletion and recovery require a more precise contract. |
| **R37-02 — Compaction** | P1 | Appropriate requirement for truthful partial-failure reporting and protection of active data. |
| **R37-03 — Storage health** | P1 | Appropriate cleanup requirement. Estimated quota and persistence availability should be reported separately. |
| **R37-04 — Release tests** | P1 | Critical integration gap: Stage 2 must not be omitted from the master acceptance result. |
| **R37-05 — Browser tests** | P1 | Appropriate finding, but the handoff does not include executable browser acceptance tests. |
| **R37-06 — Documentation** | P2 | Appropriate distinction between implementation, developer testing, and independent acceptance. |

## 2. Recommended improvements

### Priority 1 — Define the reset recovery contract

The corrective prompt proposes staging a recoverable backup before deleting browser storage. It must explicitly define **where that backup lives and when it is deleted**. A backup retained under another browser key could survive a supposedly destructive reset; deleting it too early could instead make a partial failure unrecoverable.

Specify and test separate outcomes for:

1. Successful deletion of all intended persistent data.
2. Failure before any deletion.
3. Failure after partial deletion.
4. Failure to preserve a recovery copy.
5. Failure to restore a recovery copy.

Each outcome needs explicit state transitions, operator-facing messaging, and recovery behaviour. Do not display success or reload on failure. A successful reset must result in a verifiably clean subsequent application boot.

### Priority 2 — Expand reviewer-owned regression tests

Retain the three original failure probes unchanged as a comparison baseline, then add negative-path and integration coverage for:

- Deletion failure on the second or a subsequent storage key.
- Failure to create a recovery copy.
- Failure while restoring that recovery copy.
- Reset modal refusing to reload after an unsuccessful operation.
- Successful reset followed by a clean application boot.
- Active workspace integrity when compaction fails partway through.

Unit-level failure-injection tests alone do not establish end-to-end safety.

### Priority 3 — Make the browser acceptance suite executable

Include the actual runnable browser test script, rather than instructions to build one. Exercise a populated **synthetic** workspace, exact reset confirmation, persistence after reload, and quarantine export integrity. Preserve distinct results for Node and browser testing. Missing Playwright or another browser-test dependency must be reported as **blocked/not run**, never as a pass.

## 3. Evidence verification and limitations

| Evidence | Reported status | Interpretation |
|---|---|---|
| Reviewer failure probes | Three intended failures against PR23 | Useful regression baseline, pending independent reproduction against the exact source archive. |
| Stage 2 dedicated tests | Node checks successful; browser test blocked by a missing module | Node results do not substitute for browser acceptance. |
| Retained master release tests | Aggregate run reached suite 16 after 15 successful suites | An incomplete aggregate is not a passing aggregate. |
| Separate lifecycle run | 158 assertions reported passing | Valuable scoped evidence, but does not complete the 17-suite aggregate run. |

The evidence supports proceeding with a bounded corrective cycle. It does **not** support unconditional Stage 2 acceptance.

## 4. Handoff and governance

The separation of the independent review, test plan, Gemini corrective prompt, and ChatGPT handoff is appropriate. Omitting unrelated unchanged source from a corrective peer-review package is also appropriate.

Make the dependency on the **exact PR23 source archive** prominent: a new reviewing session needs both the source archive and Review 37 to independently verify the reported code issues. Keep any new governance addendum marked **proposed** until its acceptance criteria are formally adopted. Do not reopen accepted Stage 1 gates or expand this cycle into Stage 3 functionality.

## 5. Proposed acceptance requirements

Stage 2 should remain unaccepted until the next corrective submission demonstrates all of the following:

- All six R37 findings are either corrected with evidence or explicitly dispositioned with a documented rationale.
- The destructive-reset recovery contract specifies and tests partial failure, recovery failure, messaging, and reload prevention.
- All three original reviewer probes are retained and pass against the corrected source, alongside the expanded negative-path cases.
- Browser acceptance tests execute successfully against a populated synthetic workspace, including reload and quarantine export checks.
- The full retained release suite completes, with Stage 2 included in the master aggregate and no silent skipped/blocked results.
- Documentation accurately differentiates implementation, developer verification, independent review, and accepted release status.
- The submission remains a minimal, bounded peer-review package rather than reopening Stage 1 or bundling Stage 3 work.

## Overall conclusion

**Suitable for the next bounded corrective development cycle; not yet suitable for Stage 2 acceptance.** Retain the six findings and original three probes, strengthen the reset recovery contract, and require expanded failure-path, browser, and full-release evidence before independent acceptance.
