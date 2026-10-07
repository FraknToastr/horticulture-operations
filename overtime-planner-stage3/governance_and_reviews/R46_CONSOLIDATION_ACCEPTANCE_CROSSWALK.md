# Architecture Consolidation Acceptance Crosswalk — PR23_07_03
**Author:** Antigravity / Gemini Handoff Pair  
**Date:** 2026-10-02  
**Target Candidate:** PR23_07_03 (Responding to Review 46 Directive)  
**Governance Scope:** Design Gate 04 Consolidation, Locked Acceptance Dimensions AC-01 through AC-12, Probes R46-P01 through R46-P08

---

## 1. Acceptance Matrix Crosswalk (AC-01 through AC-12)

| Dimension | Title & Intent | Controlled Scenarios | Target Source Paths & Control Points | Assertion / Test File | Coverage Status |
|---|---|---|---|---|---|
| **AC-01** | **Evidence Identity** | Unique artifact and legacy alias exact raw byte comparison | `js/utils/storage/storageDriver.js`<br>- `restoreEmergencyRecoveryArtifact()` targeted retirement | `R46-P03`, `R46-P04`, Closure Audit assertions 49 & 50 | **FULL** |
| **AC-02** | **Key Collisions** | Parent / child / alias pre-read non-overwrite | `js/utils/storage/storageDriver.js`<br>- `_stageTransactionRecoveryBundle()` | `R46-P05`, `R46-P08`, Closure Audit assertions 51 & 54 | **FULL** |
| **AC-03** | **Provenance Preservation** | Restore links selected parent to original raw evidence | `js/utils/storage/storageDriver.js`<br>- `restoreEmergencyRecoveryArtifact()`<br>`js/components/quarantineViewerModal.js`<br>- `restoreEmergencyArtifact()` | `R45-P03`, `R46-P07`, Closure Audit assertions 44 & 53 | **FULL** |
| **AC-04** | **Retirement Authorization** | Removal of caller override flags; strict internal state authorization | `js/utils/storage/storageDriver.js`<br>- `retireCompositeParentBundle()` | `R46-P01`, `R46-P02`, Closure Audit assertions 47 & 48 | **FULL** |
| **AC-05** | **Operator Resolution** | Coexisting parent bundles, explicit metadata acknowledgement | `js/utils/storage/storageDriver.js`<br>- `retireCompositeParentBundle()`<br>- `acknowledgeParentPriorEvidence()` | `R44-P04`, `R44-P06`, Closure Audit assertions 34 & 36 | **FULL** |
| **AC-06** | **UI Lifecycle & Reload** | No premature reload when evidence remains; volatile registry preserved | `js/components/quarantineViewerModal.js`<br>- `restoreEmergencyArtifact()` | `R46-P07`, Closure Audit assertion 53 | **FULL** |
| **AC-07** | **Inventory Completeness** | Typed fail-closed inventory on null key, length mismatch, or exception | `js/utils/storage/storageDriver.js`<br>- `_reconcileRecoveryInventory()` | `R46-P06`, Closure Audit assertion 52 | **FULL** |
| **AC-08** | **Transaction Isolation** | Failed reset rollback preserves memory bundle; export always available | `js/utils/storage/storageDriver.js`<br>- `_executeCompensatingRollback()` | `TM-I08`, `TM-I09`, Closure Audit assertions 8 & 9 | **FULL** |
| **AC-09** | **Transaction B Failures** | Mid-restore failure & deep double fault retain pre-restore + target evidence | `js/utils/storage/storageDriver.js`<br>- `restoreEmergencyRecoveryArtifact()` lines 1360-1420 | `TM-F21`, `TM-F22`, `TM-F25`, Closure Audit assertions 21, 22, 25 | **FULL** |
| **AC-10** | **Origin Isolation** | Governed storage operations leave unrelated local/session keys untouched | `js/utils/storage/storageDriver.js`<br>- reset and restore loops | `TM-I15`, `TM-F24`, Closure Audit assertions 15 & 24 | **FULL** |
| **AC-11** | **Browser Verification** | Real offline browser recovery, download, acknowledgement, and reload | `scripts/test_review39_browser_recovery.cjs`<br>`scripts/test_stage2_browser_smoke.cjs` | Stage 2 Browser Test Suites (Playwright Chromium) | **FULL** |
| **AC-12** | **Release Battery Integrity** | Exactly 24 permanent release suites; bit-for-bit build parity; manifest | `scripts/run_all_release_gates.cjs`<br>`scripts/build_single_file.cjs` | 24 Release Gates Runner, SHA-256 build verification | **FULL** |

---

## 2. Review 46 Independent Probes Mapping (R46-P01 through R46-P08)

| Probe ID | Target Architectural Contract | Pre-Edit Result (`PR23_07_02`) | Expected Post-Edit (`PR23_07_03`) | Closure Audit Integration Slot |
|---|---|---|---|---|
| **R46-P01** | Caller flags (`workspaceRecovered`, `acknowledgedPriorEvidence`) MUST NOT authorise retirement of unrecovered parent with prior evidence | **FAIL** (unverified caller claims authorized destructive retirement) | **PASS** | `test_stage2_transaction_model_closure_audit.cjs` :: Assertion 47 (`R46-P01`) |
| **R46-P02** | Caller `workspaceRecovered` alone MUST NOT retire unrelated empty-prior parent | **FAIL** (unrelated parent retired without verified workspace recovery) | **PASS** | `test_stage2_transaction_model_closure_audit.cjs` :: Assertion 48 (`R46-P02`) |
| **R46-P03** | Restoring target MUST NOT retire same-ID unique key with different stored raw evidence | **FAIL** (different unique-key evidence destroyed despite nonidentical bytes) | **PASS** | `test_stage2_transaction_model_closure_audit.cjs` :: Assertion 49 (`R46-P03`) |
| **R46-P04** | Legacy alias with semantically equal but different raw bytes MUST survive exact-byte retirement | **FAIL** (non-byte-identical legacy artifact removed) | **PASS** | `test_stage2_transaction_model_closure_audit.cjs` :: Assertion 50 (`R46-P04`) |
| **R46-P05** | Parent staging MUST NOT overwrite an existing different child recovery artifact | **FAIL** (previously persisted child artifact silently overwritten) | **PASS** | `test_stage2_transaction_model_closure_audit.cjs` :: Assertion 51 (`R46-P05`) |
| **R46-P06** | Inventory MUST NOT report empty when `length > 0` but `key(i)` is null | **FAIL** (nonempty storage reported empty after anomalous enumeration) | **PASS** | `test_stage2_transaction_model_closure_audit.cjs` :: Assertion 52 (`R46-P06`) |
| **R46-P07** | UI MUST NOT automatically reload and lose parent-resolution state while parent evidence remains | **FAIL** (forced reload drops volatile resolvedBundles registry before operator acknowledges earlier evidence) | **PASS** | `test_stage2_transaction_model_closure_audit.cjs` :: Assertion 53 (`R46-P07`) |
| **R46-P08** | Parent staging MUST NOT overwrite different existing bundle at same transaction key | **FAIL** (older composite overwritten by new composite with same ID) | **PASS** | `test_stage2_transaction_model_closure_audit.cjs` :: Assertion 54 (`R46-P08`) |

---

## 3. Residual Gap & Limitation Assessment

- **Gaps Identified:** None. Every probe addresses a bounded invariant in `storageDriver.js` or `quarantineViewerModal.js`.
- **Permanent Suite Count:** Exactly 24 suites retained. Probes are integrated directly into the temporary closure audit script `scripts/test_stage2_transaction_model_closure_audit.cjs` expanding it from 47 to 55 assertions. No 25th suite is created.
- **Parity Contract:** Bit-for-bit match between `index.html` and `dist/hort_ops_offline_planner.html` will be verified post-compilation.
