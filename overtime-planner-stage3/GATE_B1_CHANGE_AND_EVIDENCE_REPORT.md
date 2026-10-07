# Stage 1 Gate B1 — Change and Evidence Report (Review 16 Constructor Microclosure)

**Date:** 2026-09-25  
**Package:** `HortOps-Stage1-GateB1-PR16.zip`  
**Evaluation Scope:** Resolution of Review 16 Findings (`STAGE1_GATE_B1_INDEPENDENT_PEER_REVIEW_16.md`)  
**Baseline Artifact:** `HortOps-Stage1-GateB1-PR15.zip` (SHA-256: `ff71da39c7a9fb2aae6b2cd75e5391d0827ec986a8b64e8d1ae119d1b70e0d7e`)  
**Governance Ledger Amendment:** `ST1-GATE-B1-012`  
**Current Governance Status:** Gate A Accepted (Review 12); Gate B1 Developer-Implemented / Pending Independent Review 17; Gate B2/B3 Deferred; Gate C / Stage 2 Unauthorized.

---

## 1. Executive Summary & Review 16 Context

Independent Peer Review 16 evaluated `HortOps-Stage1-GateB1-PR15.zip`. While all previous discriminators (Review 13 6/6, Review 14 11/11, Review 15 5/5, Gate B1 Assertions 1–10, Persistence, Normal-Save, and 26 Rostering Engine groups) passed 100%, Review 16 identified a single unclosed constructor-level manifestation of the canonical-vs-runtime distinction:

- **B1-16-01 (Blocking): Constructor Silently Discards Contradictory Runtime Assignment Map.**
  - *Finding:* In PR15, `createWorkspaceEnvelope(data)` in `js/utils/storage/migrationEngine.js` assembled a selective `candidate` object before invoking validation. It copied `data.assignments` but dropped `data.customAssignments`. Consequently, a current-v2 object containing conflicting assignment maps (`assignments` assigning shift to `E1`, and `customAssignments` assigning shift to `E2`) was silently accepted by the constructor, returning a canonical envelope with only `E1` and losing `E2` without reporting an error.
  - *Resolution:* Inserted an explicit guard at the entry of `createWorkspaceEnvelope(data)` that throws `'Ambiguous current-v2 workspace: customAssignments is a runtime-only field; project to canonical assignments before construction'` if `own.call(data, 'customAssignments')` is true. This prevents information loss before candidate assembly.
  - *V1 Migration Normalisation:* Updated `migrateWorkspaceV1toV2(parsed)` in `migrationEngine.js` to normalise legacy v1 aliases inside the v1 conversion boundary. If v1 contains `customAssignments` without `assignments`, it copies them to `migrated.assignments` and deletes `migrated.customAssignments` so the synthetic v2 result is purely canonical. If v1 contains both `customAssignments` and `assignments`, it throws an explicit fail-closed error (`'Ambiguous Schema v1 assignment sources require explicit recovery'`) without mutating or deleting raw source data.

---

## 2. Source Code Modifications & Semantic Diffs

### 2.1 `js/utils/storage/migrationEngine.js` (Constructor Entry Guard & V1 Normalisation)

**Location:** `js/utils/storage/migrationEngine.js:35-55, 75-90`

**Diff 1 (V1 Migration Alias Normalisation):**
```javascript
// BEFORE (PR15):
if (!migrated.assignments && migrated.customAssignments) {
  migrated.assignments = migrated.customAssignments;
}
if (!migrated.assignments || typeof migrated.assignments !== 'object' || Array.isArray(migrated.assignments)) {
  migrated.assignments = {};
}

// AFTER (PR16):
if (!migrated.assignments && migrated.customAssignments) {
  migrated.assignments = migrated.customAssignments;
}
if (!migrated.assignments || typeof migrated.assignments !== 'object' || Array.isArray(migrated.assignments)) {
  migrated.assignments = {};
}
var ownV1 = Object.prototype.hasOwnProperty;
if (ownV1.call(parsed, 'customAssignments')) {
  if (ownV1.call(parsed, 'assignments')) {
    throw new Error(
      'Ambiguous Schema v1 assignment sources require explicit recovery'
    );
  }
  // Existing v1 logic above has copied the legacy alias to assignments.
  delete migrated.customAssignments;
}
```

**Diff 2 (Constructor Entry Guard):**
```javascript
// BEFORE (PR15):
if (!validator || typeof validator.validateCurrentV2ForBoundary !== 'function') {
  throw new Error('Canonical current-v2 validator unavailable');
}

var own = Object.prototype.hasOwnProperty;
candidate = {
  schemaVersion: 2,
  lastSaved: data.lastSaved === undefined ? new Date().toISOString() : data.lastSaved
};

// AFTER (PR16):
if (!validator || typeof validator.validateCurrentV2ForBoundary !== 'function') {
  throw new Error('Canonical current-v2 validator unavailable');
}

var own = Object.prototype.hasOwnProperty;
if (own.call(data, 'customAssignments')) {
  throw new Error(
    'Ambiguous current-v2 workspace: customAssignments is a runtime-only field; ' +
    'project to canonical assignments before construction'
  );
}
candidate = {
  schemaVersion: 2,
  lastSaved: data.lastSaved === undefined ? new Date().toISOString() : data.lastSaved
};
```

---

## 3. Eight Boundaries: Verification Decision Matrix

| Boundary | Canonical Input (`assignments`) | Alias-Only Input (`customAssignments`) | Conflicting Dual-Map Input (`assignments` + `customAssignments`) | Runtime State Input (`state.customAssignments`) |
|---|---|---|---|---|
| **1. Canonical Constructor** (`createWorkspaceEnvelope`) | Valid; returns canonical detached envelope | Throws error before candidate projection | Throws error before candidate projection | N/A (constructor receives caller arguments) |
| **2. Direct Save** (`storage.saveWorkspace`) | Valid; commits bytes to storage | Rejected; returns `ok:false`, raw storage untouched | Rejected; returns `ok:false`, raw storage untouched | N/A (direct save receives envelope) |
| **3. Real App Save** (`app.saveCurrentWorkspace`) | Valid (when passed via envelope) | N/A | N/A | Preflight passes via `{ inputKind: 'runtime_state' }`, projects to canonical `assignments`, persists canonical-only envelope |
| **4. JSON Backup** (`exportModal.exportBackupJson`) | Valid; downloads canonical payload | N/A | N/A | Projects live state to canonical `assignments`; downloaded backup contains zero `customAssignments` alias |
| **5. Verified Read / Startup** (`storage.loadWorkspace`) | Valid; loads without recovery | Quarantined; enters `recoveryRequired`, raw storage untouched | Quarantined; enters `recoveryRequired`, raw storage untouched | N/A |
| **6. JSON Import & Restore** (`prepareWorkspaceJsonImport` & `restoreWorkspaceJson`) | Valid; restores detached working copy | Rejected; returns `success:false`, state & storage untouched | Rejected; returns `success:false`, state & storage untouched | N/A |
| **7. Snapshot Validation** (`validateScheduledCommitment`) | Valid (governed by calendar, time, duration rules) | Valid | Valid | Valid (independent of assignment key) |
| **8. Entity Array Guards** (`validateWorkspaceSchema`) | Returns normal validation error on null entries | Returns normal validation error | Returns normal validation error | Returns normal validation error |

---

## 4. Test Evidence & Verification Commands

All test runs were executed in **Ubuntu 24.04 WSL2** (`Node.js v22.23.2`).

### 4.1 Review 16 Independent Boundary Probe (`scripts/review16_boundary_probe.cjs`)
- **Baseline (PR15):** 6/7 Pass (Check 1 failed: constructor accepted dual-map input).
- **Post-Fix (PR16):** **7/7 Passed (0 Gaps)**.
- **Command:** `node scripts/review16_boundary_probe.cjs`
- **Exit Code:** `0`

```
PASS 1 constructor rejects alias-only and conflicting dual-map envelopes
PASS 2 canonical preflight default rejects alias and dual; explicit runtime accepts genuine state
PASS 3 direct save rejects both forms without overwriting canonical bytes
PASS 4 JSON import rejects both forms and preserves storage
PASS 5 verified reader rejects injected alias-only storage without mutation
Workspace restore aborted: invalid Schema v2 envelope Missing required current-v2 field: assignments
Workspace restore aborted: invalid Schema v2 envelope Ambiguous current-v2 workspace: runtime customAssignments must be explicitly projected to canonical assignments
PASS 6 real restore rejects alias and dual without changing live state or raw storage
PASS 7 canonical real restore accepts populated assignments with detached state
REVIEW16_INDEPENDENT 7/7 PASS; 0 GAP
```

### 4.2 Review 15 Reproduction Discriminator (`scripts/reproduce_b1_review15.cjs`)
- **Command:** `node scripts/reproduce_b1_review15.cjs`
- **Exit Code:** `0`
- **Result:** **5/5 Passed (0 Gaps)**

### 4.3 Review 14 Reproduction Suite (`scripts/reproduce_b1_review14.cjs`)
- **Command:** `node scripts/reproduce_b1_review14.cjs`
- **Exit Code:** `0`
- **Result:** **11/11 Passed (0 Gaps)**

### 4.4 Review 13 Reproduction Suite (`scripts/reproduce_b1_review13.cjs`)
- **Command:** `node scripts/reproduce_b1_review13.cjs`
- **Exit Code:** `0`
- **Result:** **6/6 Passed (0 Gaps)**

### 4.5 Targeted Gate B1 Persistence & Validation Suite (`scripts/test_gate_b1.cjs`)
- **Command:** `node scripts/test_gate_b1.cjs`
- **Exit Code:** `0`
- **Result:** **Assertions 1–11 Passed (100%)**

```
=== RUNNING GATE B1 CANONICAL V2 PERSISTENCE & SCHEDULED-COMMITMENT SUITE ===
>>> [ASSERTION 1] Fresh Explicit-Empty V2 Workspace Full Lifecycle                 [PASS]
>>> [ASSERTION 2] Real Current-V2 Commitments with Observed Time Formats           [PASS]
>>> [ASSERTION 3] Strict Validation Rejection on Impossible / Malformed Records     [PASS]
>>> [ASSERTION 4] Mandatory Evidence Maps & Recognized V1 Migration                [PASS]
>>> [ASSERTION 5] Exporter Mandatory Retention Check & Save-Then-Export            [PASS]
>>> [ASSERTION 6] Failed Restore Non-Mutation & Valid Restore Detached Working Copy [PASS]
>>> [ASSERTION 7] Single-File HTML Standalone Hash Equivalence                     [PASS]
>>> [ASSERTION 8] Independent Peer Review 13 Discriminating Probes (6 Checks)      [PASS]
>>> [ASSERTION 9] Independent Peer Review 14 Discriminating Probes (11 Checks)     [PASS]
>>> [ASSERTION 10] Independent Peer Review 15 Discriminating Probes (Canonical vs Runtime) [PASS]
>>> [ASSERTION 11] Review 16 Canonical Constructor Microclosure & V1 Migration      [PASS]
================================================================
 ALL GATE B1 CANONICAL PERSISTENCE & VALIDATION TESTS PASSED (100%)
================================================================
```

### 4.6 Gate A Normal-Save Snapshot Suite (`scripts/test_normal_save_snapshots.cjs`)
- **Command:** `node scripts/test_normal_save_snapshots.cjs`
- **Exit Code:** `0`
- **Result:** **100% Passed (Groups 1–3, Cases A1–A8, GA10-01–04, R11-01–04)**

### 4.7 Persistence & Architecture Failure Contracts (`scripts/test_persistence.cjs`)
- **Command:** `node scripts/test_persistence.cjs`
- **Exit Code:** `0`
- **Result:** **100% Passed (All 6 Contracts + Storage Lifecycle Sections 1–31)**

### 4.8 Rostering Engine Test Suite (`scripts/test_rostering_engine.cjs`)
- **Command:** `node scripts/test_rostering_engine.cjs`
- **Exit Code:** `0`
- **Result:** **26/26 Test Suites Passed (100% Compliant)**

### 4.9 Standalone Single-File Compilation & Hash Verification
- **Command:** `node scripts/build_single_file.cjs`
- **Exit Code:** `0`
- **Result:**
  - `index.html`: `71294454272961295d212e5e0d97ac801aa285f787af51827a4a6b46ec1ad247`
  - `dist/hort_ops_offline_planner.html`: `71294454272961295d212e5e0d97ac801aa285f787af51827a4a6b46ec1ad247`
  - **Equivalence:** Byte-for-byte SHA-256 match confirmed.

---

## 5. Verification Debt Documentation

- **Pre-Existing Rostering Lifecycle Test Fixture Debt (`scripts/test_rostering_lifecycle.cjs:466`):**
  - The fixture at line 466 calls `window.HortOpsStorage.createWorkspaceEnvelope` without providing `historicalSnapshots: {}`. Under Gate B1 rules, this correctly throws `Error: Explicit current-v2 workspace required`.
  - As confirmed by Independent Reviews 15 and 16, this is a pre-existing PR13-era test maintenance item for the integrated release gate (Gate D) and not a regression introduced by PR14/PR15/PR16. It is recorded in the verification debt register and was deliberately not modified in this bounded microclosure.

---

## 6. Incremental Archive Package Composition (`PR16`)

The incremental package `HortOps-Stage1-GateB1-PR16.zip` contains exactly 9 files:

| File Path | Description |
|---|---|
| `js/utils/storage/migrationEngine.js` | Production source: constructor guard and v1 alias normalisation |
| `scripts/review16_boundary_probe.cjs` | Review 16 seven-check boundary probe |
| `scripts/reproduce_b1_review15.cjs` | Review 15 five-scenario discriminator test |
| `scripts/test_gate_b1.cjs` | Gate B1 suite augmented with Assertion 11 |
| `index.html` | Rebuilt standalone single-file bundle |
| `dist/hort_ops_offline_planner.html` | Rebuilt standalone single-file bundle (identical hash) |
| `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md` | Amended transition register (`ST1-GATE-B1-012`) |
| `GATE_B1_CHANGE_AND_EVIDENCE_REPORT.md` | Comprehensive change and evidence report |
| `MANIFEST.sha256.txt` | SHA-256 digest manifest for all packaged files |

---

## 7. Governance Compliance & Stop Rule

- **Gate A:** Remains **Accepted** under Review 12.
- **Gate B1:** Status is **Developer-Implemented / Pending Independent Review 17** (Amendment `ST1-GATE-B1-012`).
- **Gate B2 / B3:** Formally **Deferred**.
- **Gate C / Stage 2:** Formally **Unauthorized**.
- **Stop Rule:** Execution halts immediately upon delivery of `HortOps-Stage1-GateB1-PR16.zip`. No work on Gate B2/B3, Gate C, or Stage 2 will commence without explicit independent peer review acceptance.
