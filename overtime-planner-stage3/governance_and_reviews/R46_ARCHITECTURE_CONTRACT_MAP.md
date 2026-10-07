# Architecture Contract Map — PR23_07_03 Consolidation
**Author:** Antigravity / Gemini Handoff Pair  
**Date:** 2026-10-02 (Authored Pre-Implementation)  
**Governing Peer Review:** Independent Peer Review 46 (ChatGPT Adversarial Audit)  
**Target Release Candidate:** PR23_07_03  
**Status:** AUTHORITATIVE ARCHITECTURAL SPECIFICATION (PRE-EDIT CHECKPOINT)

---

## 1. Executive Intent & Architectural Invariants

Peer Review 46 uncovered four architectural contract defects in candidate `PR23_07_02` where recovery evidence safety, retirement authorization, and operator UI lifecycle diverged from fail-closed invariants:
1. **R46-01 (Retirement Authorization):** `retireCompositeParentBundle()` accepted caller options (`opts.workspaceRecovered`, `opts.acknowledgedPriorEvidence`) as proof of completed preconditions.
2. **R46-02 (Exact Raw-Byte Identity & Non-Overwrite):** Destructive removals in `restoreEmergencyRecoveryArtifact()` and writes in `_stageTransactionRecoveryBundle()` lacked pre-read raw-byte verification.
3. **R46-03 (UI Lifecycle & Provenance):** `quarantineViewerModal.js` unconditionally triggered `window.location.reload()` 500 ms after restore, erasing the in-memory `resolvedBundles` registry while older evidence remained unacknowledged, and attempted generic scanning and retirement of unrelated parent bundles.
4. **R46-04 (Fail-Closed Inventory Verification):** `_reconcileRecoveryInventory()` ignored anomalous `key(i) === null` returns when `length > 0`, falsely returning { ok: true, count: 0 }.

This document specifies the exact authoritative boundaries, call graph, and terminal state truth table across `js/utils/storage/storageDriver.js` and `js/components/quarantineViewerModal.js` **prior to modifying production code**.

---

## 2. Function-Level Boundary & Call Graph

### 2.1 Component Interaction Graph

```mermaid
graph TD
    subgraph UI ["Operator Recovery Boundary (quarantineViewerModal.js)"]
        UI_Open["Quarantine Modal Opened"]
        UI_Restore["restoreEmergencyArtifact()"]
        UI_Export["exportQuarantineFile()"]
        UI_Ack["Operator Prior Evidence Ack"]
        UI_Reload["Deferred window.location.reload()"]
    end

    subgraph Driver ["Authoritative Storage Driver (storageDriver.js)"]
        TxB["Transaction B: restoreEmergencyRecoveryArtifact(artifact, context)"]
        StageTx["_stageTransactionRecoveryBundle(bundle, json, prefix)"]
        Reconcile["_reconcileRecoveryInventory() [Single Authoritative Inventory Reader]"]
        RetireParent["retireCompositeParentBundle(transactionId) [Zero Caller Overrides]"]
        Rollback["_executeCompensatingRollback() / _restoreRawStorageSnapshot()"]
    end

    subgraph Registry ["In-Memory Resolution State (storageDriver.resolvedBundles)"]
        RecState["{ workspaceRecovered: bool, priorEvidenceAcknowledged: bool, targetRecoveryId, retired: bool }"]
    end

    subgraph SessionStorage ["Browser sessionStorage (Immutable Raw Evidence)"]
        ParentKey["hort_ops_emergency_recovery_v2:transaction:<id>"]
        ChildKey["hort_ops_emergency_recovery_v2:<recId>"]
        LegacyKey["hort_ops_emergency_recovery_v2"]
    end

    UI_Restore -->|1. Inspects parentTxId & child| TxB
    TxB -->|2. Pre-read localStorage & write workspace| SessionStorage
    TxB -->|3. Exact Raw-Byte Check| ChildKey
    TxB -->|4. Exact Raw-Byte Check| LegacyKey
    TxB -->|5. Registers workspaceRecovered: true| RecState
    TxB -->|6. Authoritative Inventory Audit| Reconcile
    Reconcile -->|Scan length & keys| SessionStorage
    
    UI_Restore -->|7. If Clean: Retire Parent| RetireParent
    RetireParent -->|Check internal state only| RecState
    RetireParent -->|If authorized: removeItem| ParentKey
    RetireParent -->|Audit remaining| Reconcile

    UI_Restore -->|8. Evaluate Terminal State| UI_Reload
    Note1["RELOAD ONLY IF terminalState == RESTORE_SUCCESS_CLEAN\nNEVER reload if evidence remains or scan failed!"] -.--> UI_Reload
```

### 2.2 Boundary Roles & Authoritative Ownership

| Function / Helper | File | Authority & Governing Contract | Anti-Patterns Prohibited |
|---|---|---|---|
| `_reconcileRecoveryInventory()` | `storageDriver.js` | **Single authoritative reader** for all recovery evidence in `sessionStorage`. Validates `length`, each `key(i)` non-null string, and classifies entries (`keys`, `compositeKeys`, `byType`). Returns { ok: true, count, verified: true, ... } or { ok: false, error, verified: false }. | **NEVER** return `ok: true` when `length > 0` but enumeration fails or yields `null`. **NEVER** ignore read exceptions. |
| `_stageTransactionRecoveryBundle()` | `storageDriver.js` | **Authoritative staged persistence** for composite transaction envelopes. Pre-reads `parentKey`, `wsRecoveryKey`, and `legacyKey`. Compares raw bytes. If occupied with different bytes: **DO NOT OVERWRITE**, keep memory-only, return collision error. If occupied with identical bytes: idempotent reuse. | **NEVER** overwrite existing evidence keys with different bytes. **NEVER** claim `persisted` if parent composite write was denied. |
| `restoreEmergencyRecoveryArtifact()` | `storageDriver.js` | **Transaction B restore orchestrator**. Validates target artifact, writes local snapshot, verifies local restoration. On success: removes `childKey` and `legacyKey` **strictly if and only if stored bytes === raw input bytes**. Sets `resolvedBundles[parentTxId].workspaceRecovered = true`. Calls `_reconcileRecoveryInventory()`. | **NEVER** delete `childKey` on ID match alone without raw byte identity. **NEVER** delete `legacyKey` using canonical parsed equivalence. |
| `retireCompositeParentBundle()` | `storageDriver.js` | **Authoritative parent bundle retirement**. Validates that `this.resolvedBundles[transactionId].workspaceRecovered === true`. If parent contains `previousEmergencyRecoveryMetadata`, validates `this.resolvedBundles[transactionId].priorEvidenceAcknowledged === true`. Removes `parentKey` only after internal proof. | **NEVER** accept caller options (`opts.workspaceRecovered`, `opts.acknowledgedPriorEvidence`, `opts.force`) as proof. Public options are requests, not proof. |
| `restoreEmergencyArtifact()` | `quarantineViewerModal.js` | **Operator UI adapter**. Preserves `parentTxId` from composite payload before extracting child. Invokes `restoreEmergencyRecoveryArtifact()`. If unencumbered parent was restored, requests retirement of that specific parent. | **NEVER** scan sessionStorage for unrelated parent keys. **NEVER** schedule `setTimeout(location.reload)` while recovery evidence remains or if scan failed. |

---

## 3. Four Core Architectural Contracts (R46-01 .. R46-04)

### Contract 1: Retirement Authorization (R46-01, AC-04)
- **Problem:** Public caller options allowed arbitrary callers to pass `{ workspaceRecovered: true, acknowledgedPriorEvidence: true }` or `{ force: true }`, bypassing verification.
- **Authoritative Rule:** Authorization must come exclusively from verified internal state: `this.resolvedBundles[transactionId]?.workspaceRecovered === true` and `this.resolvedBundles[transactionId]?.priorEvidenceAcknowledged === true`. Caller flags are requests, never proof. Remove caller options as authorization overrides.

### Contract 2: Exact Raw-Byte Identity & Pre-Read Non-Overwrite (R46-02, AC-01, AC-02)
- **Target Child Retirement:** `restoreEmergencyRecoveryArtifact()` must compare `window.sessionStorage.getItem(rKey) === rawInputString` before calling `removeItem()`. Different bytes under the same ID must survive.
- **Legacy Compatibility Alias Retirement:** Must strictly require `currentLegacyVal === rawInputString`. Remove the parsed canonical equality branch because parsed canonical equality is not raw byte equality.
- **Staging Pre-Read:** In `_stageTransactionRecoveryBundle()`, pre-read parent, child, and alias keys before `setItem()`. If occupied by different raw bytes, prohibit overwrite and report staging failure/persistence as `memory_only`. If identical bytes exist, treat as idempotent.

### Contract 3: Quarantine UI Lifecycle & Provenance Preservation (R46-03, AC-06)
- **Problem:** Premature reload scheduled 500ms after restore wiped volatile in-memory `resolvedBundles` before the operator could inspect/acknowledge prior evidence, and arbitrary parent keys were scanned and destroyed.
- **Authoritative Rule:** Never auto-reload while recovery evidence remains (`terminalState === RESTORE_SUCCESS_EVIDENCE_REMAINS` or `recoveryRequired === true`). Retain the parent bundle and resolution state in the UI until explicit acknowledgement/retirement occurs. Never scan or retire unrelated parent bundles.

### Contract 4: Fail-Closed Recovery Inventory (R46-04, AC-07)
- **Problem:** Enumerating `sessionStorage` when `length > 0` but `key(i)` returns `null` resulted in empty inventory reporting (`{ ok: true, count: 0 }`), falsely clearing `recoveryRequired`.
- **Authoritative Rule:** If `len > 0` and any key is `null` or non-string, or enumeration encounters an exception, return `{ ok: false, error: ... }` to keep `recoveryRequired` and `_autosaveBlocked` strictly `true`.

---

## 4. Terminal State Truth Table

The following truth table defines every operational branch and terminal outcome across the storage driver and UI:

| Scenario / Branch | Staging / Precondition | `restoreEmergencyRecoveryArtifact()` Outcome | Storage Evidence After Call | `recoveryRequired` | `_autosaveBlocked` | UI Reload Permitted? | Operator Next Action |
|---|---|---|---|---|---|---|---|
| **Clean Standalone Restore** | Unique child restored, no other session keys exist | `RESTORE_SUCCESS_CLEAN` | Target child removed, legacy removed, 0 keys remaining | `false` | `false` | **YES** (500 ms) | Normal operation resumed |
| **Parent Child Restored, Prior Evidence Exists** | Child restored, parent composite has `previousEmergencyRecoveryMetadata` | `RESTORE_SUCCESS_EVIDENCE_REMAINS` | Target child removed; parent composite strictly preserved in `sessionStorage` | `true` | `true` | **NO** (Strictly blocked) | Inspect/export prior metadata; explicit acknowledgement before retirement |
| **Parent Child Restored, Empty Prior Metadata** | Child restored, parent has empty prior metadata `{}` | `RESTORE_SUCCESS_EVIDENCE_REMAINS` -> UI calls `retireCompositeParentBundle()` -> `inv.count === 0` | Child removed; parent removed; 0 keys remaining | `false` | `false` | **YES** (After successful parent retirement) | Normal operation resumed |
| **Restore Verification Failed (Rollback Success)** | Local write or verification error; rollback succeeds | `ROLLBACK_CURRENT_VERIFIED` | Workspace rolled back intact; all session recovery keys preserved | `true` | `true` | **NO** | Diagnose storage error, export emergency payload |
| **Restore Double Fault (Deep Failure)** | Local write fails AND compensating rollback fails | `RESTORE_DEEP_FAILURE` | Deep recovery bundle staged (or memory-only); pre-restore and target snapshot intact | `true` | `true` | **NO** | Export deep recovery bundle, manual recovery |
| **Target Raw Bytes Mismatch on Restore** | Stored unique key has different bytes than input artifact | Restores workspace; skips removal of stored key | Stored key with divergent bytes preserved intact | `true` | `true` | **NO** | Investigate collided evidence |
| **Legacy Alias Raw Bytes Mismatch** | Stored alias has different indentation / bytes | Restores workspace; skips removal of legacy alias | Legacy alias preserved intact | `true` | `true` | **NO** | Investigate legacy evidence |
| **Inventory Enumeration Exception** | `sessionStorage.length > 0` but `key(i) === null` | `RESTORE_SCAN_FAILED` | All storage keys untouched | `true` | `true` | **NO** | Storage repair; autosave remains fail-closed |
| **Parent Staging Key Collision** | Staging new bundle at existing key with different bytes | `stagingSuccess: false`, `persistence: memory_only` | Existing parent composite untouched; new bundle preserved in memory | `true` | `true` | **NO** | In-memory bundle directly exportable |
| **Counterfeit Parent Retirement Call** | Caller passes `{ workspaceRecovered: true, force: true }` without internal record | `retirement_rejected_unresolved` | Parent bundle untouched | Unchanged (`true`) | Unchanged (`true`) | **NO** | Operator must restore through authorized UI |

---

## 5. Implementation Verification Criteria

1. **Pre-Edit Baseline:** Independent probes `R46-P01` through `R46-P08` produce **0 PASS / 8 FAIL**.
2. **Post-Edit Probes:**
   - Independent probes `R46-P01` through `R46-P08` produce **8 PASS / 0 FAIL**.
   - Review 45 probes produce **6 PASS / 0 FAIL**.
   - Review 44 probes produce **8 PASS / 0 FAIL**.
3. **Closure Audit:** `test_stage2_transaction_model_closure_audit.cjs` expanded to **55 PASS / 0 FAIL**.
4. **Deterministic Build:** `index.html` and `dist/hort_ops_offline_planner.html` match bit-for-bit SHA-256.
5. **Governed Release Battery:** Master runner executes exactly 24 release suites with **24 PASS / 0 FAIL**.
