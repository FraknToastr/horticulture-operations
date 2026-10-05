# STAGE 2 TRANSACTION-MODEL ARCHITECTURAL INTEGRATION MAP: PR23_07_02

**Document Reference:** `STAGE2_PR23_07_02_INTEGRATION_MAP.md`  
**Release Candidate:** Candidate `PR23_07_02`  
**Governing Standard:** Independent Review 45 (`Review45_Stage2_PR23_07_01_Independent_Assessment.md`), Design Gate Review 04, and `REVIEW45_GEMINI_IMPLEMENTATION_HANDOFF.md`  
**Date:** 01 October 2026  
**Governance State:** Stage 2 Transaction-Model Remediation Active (Stage 1 Frozen, Stage 3 Strictly Not Authorized)

---

## 1. Architectural Mission & Purpose

Candidate `PR23_07_01` closed all eight Review 44 probes (8/8 PASS) and achieved 41/41 on the closure audit. However, Independent Review 45 identified three shared architectural contract failures across evidence identity, resolution authorization, and fail-closed reconciliation:

1. **`R45-01` (Exact Evidence Identity):** Prohibit destructive legacy alias overwrite or retirement based on metadata similarity; require byte-identical matching. Auxiliary compatibility staging must never overwrite pre-existing recovery evidence.
2. **`R45-02` (Explicit Parent Retirement Authorization & UI Provenance):** Eliminate `opts.force` as a bypass of verified recovery and prior-evidence acknowledgement. The quarantine viewer must capture and propagate composite `parentTransactionId` before extracting child workspace payloads.
3. **`R45-03` (Fail-Closed Recovery Enumeration & Reconciliation Boundary):** A single unified session enumeration/verification boundary where storage exceptions are never interpreted as zero unresolved artifacts.

This document establishes the binding structural map across these three architectural components before executing production code changes.

---

## 2. Core Abstractions & Integration Mapping

```text
========================================================================================
                          STAGE 2 INTEGRATED EVIDENCE ARCHITECTURE
========================================================================================

1. RecoveryEvidenceIdentity
   ├── Exact Key Prefix Classification:
   │     - Composite Parent:  'hort_ops_emergency_recovery_v2:transaction:<txId>'
   │     - Child Workspace:   'hort_ops_emergency_recovery_v2:<recId>'
   │     - Legacy Alias:      'hort_ops_emergency_recovery_v2'
   ├── Immutable Prior Evidence Protection:
   │     - Auxiliary staging strictly gated: if legacy alias or target key exists, NEVER overwrite
   │     - Staging failure aborts auxiliary mutations, leaving existing storage untouched
   └── Exact Byte-Identical Target Matching:
         - Legacy alias retirement requires exact byte match (`rawLegacy === rawRestored`)
           or exact canonical serialization match (`JSON.stringify(parsedLegacy) === JSON.stringify(parsedRestored)`)
         - NEVER retire legacy alias based solely on `recoveryId` and `createdAt`

2. RecoveryResolutionAuthorization
   ├── UI Provenance Preservation:
   │     - Quarantine Viewer inspects payload BEFORE child extraction
   │     - Captures `parentTransactionId = payload.transactionId`
   │     - Passes `{ parentTransactionId: parentTransactionId }` into `restoreEmergencyRecoveryArtifact()`
   ├── Gated Parent Resolution Lifecycle:
   │     - `restoreEmergencyRecoveryArtifact()` registers `resolvedBundles[parentTxId].workspaceRecovered = true`
   │     - `retireCompositeParentBundle()` enforces mandatory precondition check:
   │         * `workspaceRecovered === true` (verified restoration)
   │         * `priorEvidenceAcknowledged === true` (if `previousEmergencyRecoveryMetadata` is present)
   └── Zero Bypass Policy:
         - Complete removal and neutralization of `opts.force`
         - Forced deletion requests fail-closed without mutating evidence

3. ReconcileRecoveryEvidence
   ├── Single Unified Scanning Routine: `_scanRecoveryInventory()`
   │     - Executes fail-closed enumeration across `sessionStorage`
   │     - Returns typed outcome: `{ ok: true, count: N, keys: [...], compositeKeys: [...] }`
   │       OR `{ ok: false, error: err, count: -1 }`
   └── Fail-Closed Gating:
         - If scan fails (`!res.ok`):
             * `recoveryRequired` forced to `true`
             * `_autosaveBlocked` forced to `true`
             * Terminal state CANNOT be `RESTORE_SUCCESS_CLEAN`
         - Applied universally across:
             * Application bootstrap (`js/app.js::init()`)
             * Destructive reset preflight (`_checkUnresolvedEmergencyIsolation()`)
             * Post-restore evaluation (`restoreEmergencyRecoveryArtifact()`)
             * Post-retirement cleanup (`retireCompositeParentBundle()`)
========================================================================================
```

---

## 3. Component Specification & Invariant Crosswalk

### 3.1 `RecoveryEvidenceIdentity`
* **Governing Invariants:** `TM-I06`, `TM-I07`, `TM-I09`, `TM-I11`
* **Target Probes:** `R45-P01`, `R45-P04`
* **Detailed Mechanics:**
  1. In `_stageTransactionRecoveryBundle()`:
     - Auxiliary legacy staging (`window.sessionStorage.setItem(legacyKey, ...)`) must execute **only if** parent composite staging succeeded (`parentPersisted === true`) **and** the legacy key does not already hold an existing unacknowledged composite or recovery artifact.
     - If parent composite staging fails or throws, no legacy alias write is attempted, preserving any existing composite evidence in `hort_ops_emergency_recovery_v2`.
  2. In `restoreEmergencyRecoveryArtifact()`:
     - Retirement of the legacy alias key `hort_ops_emergency_recovery_v2` must verify that the content of the legacy alias is byte-for-byte identical to the raw restored artifact string, or that canonical parse yields identical storage snapshots (`JSON.stringify(parsedLegacy) === JSON.stringify(restoredArtifact)`).
     - If the legacy alias has different workspace content or metadata (even if sharing `recoveryId` and `createdAt`), it is preserved intact.

### 3.2 `RecoveryResolutionAuthorization`
* **Governing Invariants:** `TM-I06`, `TM-I08`, `TM-I12`, `TM-I13`
* **Target Probes:** `R45-P02`, `R45-P03`
* **Detailed Mechanics:**
  1. In `quarantineViewerModal.js`:
     - Prior to extracting `parsed.currentWorkspaceRecoveryArtifact` into `payload`, the modal reads and caches `parentTxId = parsed.transactionId`.
     - When calling `storage.restoreEmergencyRecoveryArtifact(payload, { parentTransactionId: parentTxId })`, the parent transaction context is preserved and propagated.
  2. In `retireCompositeParentBundle()`:
     - Precondition 1: `resolutionRecord && resolutionRecord.workspaceRecovered === true`.
     - Precondition 2: If bundle contains `previousEmergencyRecoveryMetadata` with keys, `resolutionRecord && resolutionRecord.priorEvidenceAcknowledged === true`.
     - **Removal of `force` bypass:** All checks referencing `opts.force` are deleted. Passing `{ force: true }` without verified recovery and acknowledgement returns `success: false` and preserves storage.

### 3.3 `ReconcileRecoveryEvidence`
* **Governing Invariants:** `TM-I04`, `TM-I10`, `TM-I11`, `TM-I14`, `TM-I15`
* **Target Probes:** `R45-P05`, `R45-P06`
* **Detailed Mechanics:**
  1. Implement a single, robust helper `_reconcileRecoveryInventory()` on `HortOpsStorageDriver`:
     ```javascript
     _reconcileRecoveryInventory: function() {
       try {
         if (typeof window === 'undefined' || !window.sessionStorage) {
           return { ok: true, count: 0, keys: [], compositeKeys: [] };
         }
         var keys = [];
         var compositeKeys = [];
         var len = window.sessionStorage.length;
         for (var i = 0; i < len; i++) {
           var k = window.sessionStorage.key(i);
           if (k && k.indexOf('hort_ops_emergency_recovery_v2') === 0) {
             keys.push(k);
             if (k.indexOf('hort_ops_emergency_recovery_v2:transaction:') === 0) {
               compositeKeys.push(k);
             }
           }
         }
         return { ok: true, count: keys.length, keys: keys, compositeKeys: compositeKeys };
       } catch (err) {
         return { ok: false, count: -1, error: err, keys: [], compositeKeys: [] };
       }
     }
     ```
  2. Post-Restore Evaluation:
     - Invoke `_reconcileRecoveryInventory()`. If `!inv.ok`, set terminal state to `'RESTORE_SCAN_FAILED'` (or `'RESTORE_SUCCESS_REMAINDER'`), ensure `recoveryRequired = true`, and enforce `_autosaveBlocked = true`.
  3. Post-Retirement Evaluation:
     - Invoke `_reconcileRecoveryInventory()`. If `!inv.ok`, do not release autosave; maintain `_autosaveBlocked = true`.
  4. Application Startup & Reset Preflight:
     - Ensure any enumeration exception in `app.js::init()` or `_checkUnresolvedEmergencyIsolation()` treats the recovery inventory as non-empty (`recoveryRequired = true`, `_autosaveBlocked = true`, reject destructive reset).

---

## 4. Verification & Validation Strategy

1. **Independent Probe Baseline:**
   - Confirm Review 44 probes remain **8/8 PASS**.
   - Confirm Review 45 probes transition from **0/6 FAIL** to **6/6 PASS**.
2. **Master Battery Integrity:**
   - Maintain all 17 Stage 1 retained suites at 100% PASS.
   - Maintain all 7 Stage 2 acceptance suites at 100% PASS.
   - Ensure `scripts/test_stage2_transaction_model_closure_audit.cjs` is expanded to include tests for all Review 45 edge cases.
3. **Build Determinism:**
   - Recompile `dist/hort_ops_offline_planner.html` via `scripts/build_single_file.cjs`.
   - Verify SHA-256 parity between `index.html` and `dist/hort_ops_offline_planner.html`.
