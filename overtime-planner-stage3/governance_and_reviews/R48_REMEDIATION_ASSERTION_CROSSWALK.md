# Review 48 Remediation Assertion Crosswalk: Stage 2 Consolidation (Candidate PR23_07_05)

**Document Reference:** `governance_and_reviews/R48_REMEDIATION_ASSERTION_CROSSWALK.md`  
**Candidate Release Package:** `HortOps-Stage2-Corrective-PR23_07_05.zip`  
**Date:** 02 October 2026  

---

## 1. Traceability Matrix: Review 48 Probes to Code Remediation

| Probe ID | Finding & Assertion | File & Line in PR23_07_05 | Implementation Mechanism | Validation Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **`R48-P01`** | Acknowledgement requires a bound, verified parent; calling with `'NOT_RECOVERED'` must return `success: false` and set no flag. | `js/utils/storage/storageDriver.js:1800–1810` | Validates `this.resolvedBundles && this.resolvedBundles[transactionId]?.workspaceRecovered`. If absent or false, fails immediately with `{ success: false, status: 'parent_not_resolved_or_workspace_not_recovered' }`. | **PASS** (`tests/review48_independent_contract_probes.cjs`) |
| **`R48-P02`** | Parent with prior evidence cannot be deleted merely after direct API acknowledgement without inspect/export confirmation. | `js/utils/storage/storageDriver.js:1820–1835, 1720–1735` | Parses bundle raw bytes. If non-empty `previousEmergencyRecoveryMetadata` exists, `acknowledgeParentPriorEvidence` requires `options.operatorConfirmed \|\| options.evidenceInspected \|\| options.evidenceExported`. Bare call returns `{ success: false, status: 'acknowledgement_requires_operator_confirmation' }`. In `retireCompositeParentBundle`, unacknowledged prior evidence fails closed, leaving parent key in storage intact. | **PASS** (`tests/review48_independent_contract_probes.cjs`) |
| **`R48-P03`** | Failed retirement verification requires verified compensation or retained exportable preimage; silent no-op compensation must not lose data. | `js/utils/storage/storageDriver.js:1740–1775` | After calling `sessionStorage.setItem(targetKey, preRemovalPreimage)`, re-reads storage to verify `getItem(targetKey) === preRemovalPreimage`. If write threw, was a no-op, or readback diverged, retains preimage on `this._retirementRecoveryBundleJson`, updates `lastRestoreResult.recoveryBundleJson`, triggers active emergency isolation, and returns `{ success: false, status: 'retirement_verification_failed_uncompensated', recoveryBundleJson }`. | **PASS** (`tests/review48_independent_contract_probes.cjs`) |
| **`R48-P04`** | Inventory reader must detect storage length drift during key enumeration. | `js/utils/storage/storageDriver.js:660–675` | Captures `startLen = sessionStorage.length` before loop. After enumeration, captures `finalLen = sessionStorage.length`. If `finalLen !== startLen \|\| finalLen !== allKeys.length`, returns `{ ok: false, count: -1, verified: false, error: 'Enumeration instability: storage length drifted' }`. | **PASS** (`tests/review48_independent_contract_probes.cjs`) |
| **`R48-P05`** | Indirect-parent workspace restore must not silently retire parent bundle. | `js/components/quarantineViewerModal.js:164–168` | Removed automatic invocation of `retireCompositeParentBundle(parentTxId)` on child restore. Parent bundle remains preserved in storage until explicit operator decision. | **PASS** (`tests/review48_independent_contract_probes.cjs`) |
| **`R48-P06`** | Inventory reader must mark structurally invalid JSON parent as malformed (e.g. `'{}'`). | `js/utils/storage/storageDriver.js:630–655` | Evaluates structural schema requirements per entry type: `parent_transaction` requires `artifactType === 'hort_ops_reset_transaction_recovery'`, non-empty `transactionId`, and valid `currentWorkspaceRecoveryArtifact` object. Syntactically valid JSON objects missing required keys are classified `validationStatus: 'malformed'`. | **PASS** (`tests/review48_independent_contract_probes.cjs`) |

---

## 2. Review 48 Assessment Acceptance Requirements (Section 5)

| Requirement ID | Description | Evidence & Demonstration | Status |
| :--- | :--- | :--- | :--- |
| **Matrix Item 1** | Existing 30 unchanged adversarial probes (Reviews 44–47) remain green. | R44 (8/8), R45 (6/6), R46 (8/8), R47 (8/8) executed against PR23_07_05; 30/30 passed. | **CLOSED** |
| **Matrix Item 2** | Six Review 48 probes run unchanged and pass. | `tests/review48_independent_contract_probes.cjs` executed against PR23_07_05; 6/6 passed. | **CLOSED** |
| **Matrix Item 3** | Temporary closure audit retains 55 assertions; no 25th release suite. | `scripts/test_stage2_transaction_model_closure_audit.cjs` passed with exactly 55/55 assertions. Release suite count is exactly 24. | **CLOSED** |
| **Matrix Item 4** | Full operator workflow with two different parents, explicit inspect/export, acknowledged retirement, preservation of other parent. | Demonstrated in `scripts/test_review48_demonstration.cjs` (Req 4.1, 4.2, 4.3). Verified in Playwright browser suite. | **CLOSED** |
| **Matrix Item 5** | Force `removeItem` success + readback failure + compensation no-op, verify original preimage is downloadable, test compensation throw and mismatch. | Demonstrated in `scripts/test_review48_demonstration.cjs` (Req 5.1, 5.2). Preimage retained on `_retirementRecoveryBundleJson` under active isolation. | **CLOSED** |
