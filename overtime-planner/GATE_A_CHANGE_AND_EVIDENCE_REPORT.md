# GATE A CORRECTIVE CHANGE & VERIFICATION EVIDENCE REPORT
## Horticulture Overtime Planner — Baseline Stage 1 Architecture, Governance & Canonical-Data Reset

- **Package Reference:** `HortOps-Stage1-GateA-Closure-PR11.zip`
- **Review Adjudication:** Independent Peer Review 11 (`STAGE1_GATE_A_INDEPENDENT_PEER_REVIEW_11.md`)
- **Governing Directives:** `GEMINI_GATE_A_FINAL_MICROCLOSURE_PROMPT_REVIEW11.md` & `GEMINI_STAGE1_ARCHITECTURE_GOVERNANCE_RESET_DIRECTIVE.md` (Section 6)
- **Status:** Proposed — Submitted for Independent Peer Review (Gate A Closure PR11)
- **Authoritative Date:** 2026-09-25

---

## 1. Summary of Unified Changes Addressing Review 10 Findings (GA10-01 to GA10-06)

Independent Peer Review 10 identified six precise findings across builder bypasses, malformed baseline export, corrupted baseline save overwrite, in-place validation mutations, unmaintained regression fixtures, and documentation control characters. PR10 delivers the complete unified resolution:

### GA10-01 (Blocking) — Envelope Builder Bypass Closure
- **Defect:** `HortOpsStorage.createWorkspaceEnvelope()` in `js/utils/storage/migrationEngine.js:39` accepted raw incomplete current-v2 payloads and defaulted missing `historicalSnapshots` to `{}` and missing `rostering` to empty maps. Calling the builder before saving bypassed the evidence-loss guard and dropped persisted snapshot counts from two to zero.
- **Resolution:**
  - Hardened `createWorkspaceEnvelope()` to strictly require explicit current-v2 evidence maps via `HortOpsSchemaValidator.validateCurrentV2Presence()`.
  - If `data` lacks `historicalSnapshots`, `rostering`, `instructions`, or `provenance`, it immediately throws an explicit `Error`.
  - Prohibits synthesis of fallback empty maps for incomplete raw current-v2.
  - v1 migration paths (`migrateWorkspaceV1toV2()`) explicitly materialize canonical empty evidence domains as part of recognized v1 conversion *before* calling the strict builder.
  - Verified by adversarial test: raw v2 missing history throws error; stored snapshots remain intact.

### GA10-02 (Blocking) — Authoritative Committed Baseline Reader & Export Guard
- **Defect:** `exportBackupJson()` in `js/components/exportModal.js` conditionally evaluated key retention only if corresponding maps existed in storage, and never validated the stored baseline itself before checking keys. An incomplete stored baseline missing snapshots and provenance still allowed a full backup download.
- **Resolution:**
  - Implemented `HortOpsStorage.readVerifiedCommittedV2()` in `js/utils/storage.js:130`. Reads, parses, and validates the persisted envelope using `validateCurrentV2ForBoundary()`.
  - `exportBackupJson()` invokes `readVerifiedCommittedV2()`. If stored bytes cannot be parsed or fail Schema v2 validation, export aborts with a descriptive error and **blocks file download** (zero calls to `downloadFile()`).
  - Calls `checkEvidenceKeyRetention()` against the verified committed baseline.

### GA10-03 (High) — Unreadable Committed Bytes Overwrite Prevention
- **Defect:** `saveCurrentWorkspace()` in `js/app.js` wrapped `JSON.parse(rawStored)` in a try/catch that silently swallowed parse errors. If storage contained unreadable or corrupted JSON, normal save overwrote it, erasing evidence that was present in the corrupted string.
- **Resolution:**
  - `saveCurrentWorkspace()` now consumes `HortOpsStorage.readVerifiedCommittedV2()`.
  - If committed storage exists but `!committed.ok` (unreadable JSON or invalid schema), save **fails closed immediately**, logs the error, sets `storageStatus = 'save_failed'`, and returns `false`.
  - Unreadable committed bytes remain 100% byte-for-byte untouched in storage.

### GA10-04 (High) — In-Place Validation Mutation Elimination via Defensive Working Copy
- **Defect:** `HortOpsSchemaValidator.validateWorkspaceSchema()` invoked in-place `normalizeLineage()` at `schemaValidator.js:27` before completing semantic checks. Calling `validateCurrentV2ForBoundary()` on input that subsequently failed semantic checks (e.g. employee status `'banana'`) mutated the caller's input instruction. When passed an envelope sharing a reference with `app.state.rostering`, a rejected restore mutated live runtime state.
- **Resolution:**
  - Refactored `validateCurrentV2ForBoundary(input)` in `js/utils/storage/schemaValidator.js:729`:
    1. Validates structural presence on the raw input first via `validateCurrentV2Presence(input)`.
    2. Deep clones input into a defensive working copy `working = JSON.parse(JSON.stringify(input))`.
    3. Executes semantic validation and `normalizeLineage()` **exclusively on the defensive working copy**.
    4. If invalid, returns `{ valid: false, error: ... }` without ever mutating caller-owned input.
    5. If valid, returns `{ valid: true, data: working }`.
  - `HortOpsStorage.saveWorkspace()` and `HortOpsApp.restoreWorkspaceJson()` consume `check.data` for serialization and state adoption.
  - Verified by adversarial test: rejected validation leaves source object unmutated; rejected restore leaves active `app.state` and storage completely unchanged despite shared object references.

### GA10-05 (High) — Canonical Persistence Regression Suite Maintenance
- **Defect:** `scripts/test_persistence.cjs` exited nonzero at line 57 because its pre-Gate-A v2 fixtures omitted the newly required evidence maps (`historicalSnapshots` and `rostering`).
- **Resolution:**
  - Surgically updated all 35 intended-valid and semantic-negative v2 fixtures in `scripts/test_persistence.cjs` to include canonical explicit empty maps:
    ```javascript
    historicalSnapshots: {},
    rostering: { instructions: {}, provenance: {} },
    ```
  - Preserved all deliberate malformed presence checks and recognized-v1 migration tests.
  - Executed suite: **ALL PERSISTENCE REGRESSION TESTS PASSED (100%)**.

### GA10-06 (Medium) — Control Character Elimination & Line Anchor Accuracy
- **Defect:** Architecture audit contained 12 non-whitespace C0 control characters (nine vertical tabs, two form feeds, one bell) resulting from unescaped string interpolations. Line anchors for `restoreWorkspaceJson` and `createWorkspaceEnvelope` were outdated.
- **Resolution:**
  - Removed all C0 control characters from `STAGE1_ARCHITECTURE_AUDIT_AND_CANONICALISATION_PLAN.md` and `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`. Byte-level scan confirms: **0 bad control characters**.
  - Synchronized all function anchors to exact current lines: `saveWorkspace:156`, `loadWorkspace:224`, `readVerifiedCommittedV2:130`, `init:19`, `saveCurrentWorkspace:54`, `restoreWorkspaceJson:448`, `createWorkspaceEnvelope:41`, `prepareWorkspaceJsonImport:91`, `exportBackupJson:22`.
  - Recorded Gate B boundary finding `GB-OWN-001`.
  - Marked audit status as **Proposed (Pending Independent Peer Review Acceptance)**.

---

## 2. Formal 8-Row Boundary Inventory Table

| # | Boundary Name & Call Site | Source Location | Boundary Role Tag | Ingress / Egress | Shared Validator Hook & Contract | Failure Semantics & Storage Preservation |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **B1** | `HortOpsStorage.saveWorkspace()` | `js/utils/storage.js:156` | Raw supported-v2 input / Runtime projection | Ingress to storage (localStorage / driver) | Prevalidates raw input via `HortOpsSchemaValidator.validateCurrentV2ForBoundary(workspace)`. No fallback insertion (`|| {}`). Serializes `check.data`. | **Fail-closed:** Returns `{ok: false, stage: 'validation', storageMode: 'unchanged', error: check.error}`. Zero write to storage; previous raw bytes preserved. |
| **B2** | `HortOpsStorage.loadWorkspace()` / `HortOpsApp.init()` | `js/utils/storage.js:224` / `js/app.js:19` | Stored current-v2 envelope / Recovery result | Egress from storage / Ingress to application state | Validates persisted v2 envelope via `validateCurrentV2Presence(parsedV2)`. | **Quarantine:** Missing or invalid evidence maps quarantined with `recoveryRequired: true`. Zero storage overwrite; raw bytes untouched. |
| **B3** | `HortOpsApp.saveCurrentWorkspace()` | `js/app.js:54` | Runtime current-v2 projection | Egress from live state / Ingress to storage | Validates live state presence (`validateCurrentV2Presence`) and verifies committed baseline via `HortOpsStorage.readVerifiedCommittedV2()`. Checks snapshot key retention. | **Fail-closed:** Suspends auto-save if recovery required, evidence missing, or committed storage unreadable/invalid; sets `storageStatus = 'save_failed'`; returns `false`. Storage untouched. |
| **B4** | `HortOpsMigrationEngine.createWorkspaceEnvelope()` | `js/utils/storage/migrationEngine.js:41` | Envelope builder (new, runtime projection, or migrated) | Data transformation | Strictly requires explicit evidence maps on current-v2 input via `validateCurrentV2Presence`. Throws `Error` if `historicalSnapshots` or `rostering` missing. | **Fail-closed:** Prohibits synthesis of fallback maps for incomplete current-v2. Leaves v1 empty evidence materialization to `migrateWorkspaceV1toV2()`. |
| **B5** | `HortOpsMigrationEngine.prepareWorkspaceJsonImport()` | `js/utils/storage/migrationEngine.js:91` | Raw supported-v2 input (file import) | Ingress from external JSON to import staging | If `sourceVersion === 2`, strictly executes `validateCurrentV2Presence(parsed)` followed by `validateWorkspaceSchema(parsed)`. Removed all contextual exceptions. | **Fail-closed:** Rejects incomplete v2 regardless of assignment counts; returns `{success: false, stage: 'validation', schemaVersion: 2, error: shape.error}`. |
| **B6** | `HortOpsApp.restoreWorkspaceJson()` | `js/app.js:448` | Raw supported-v2 input / Full workspace replacement | Ingress to storage and runtime state | Prevalidates envelope via `validateCurrentV2ForBoundary(envelope)` operating on defensive working copy *before* any state or storage mutation. Adopts `check.data`. Clears scheduler boundary cache. | **Fail-closed:** Rejects invalid envelope immediately; returns `false`. Zero mutation to `app.state`; zero write to storage. Shared runtime references preserved untouched. |
| **B7** | `HortOpsExportModal.exportBackupJson()` | `js/components/exportModal.js:22` | Runtime current-v2 projection | Egress from live state to JSON download | Reads verified committed baseline via `HortOpsStorage.readVerifiedCommittedV2()`. Validates live projection via `validateCurrentV2Presence`. Verifies identity key retention via `checkEvidenceKeyRetention(committed.data, liveProjection)`. | **Fail-closed:** Aborts export immediately if committed baseline is corrupt or if live keys are missing. Zero file download (`downloadFile` blocked); storage untouched. |
| **B8** | Default Initial Envelope Construction | `js/utils/storage.js:456` | New workspace (clean slate initialization) | Internal creation on first boot | Constructs canonical initial envelope with explicit `{}` evidence fields: `historicalSnapshots: {}`, `rostering: { instructions: {}, provenance: {} }`. | Produces fully compliant current-v2 envelope ready for valid persistence. |

---

## 3. Test Execution & Evidence Log

### 3.1 Focused Gate A Test Suite (`scripts/test_normal_save_snapshots.cjs`)
Executed natively inside Ubuntu 24.04 WSL2: `node scripts/test_normal_save_snapshots.cjs`.

```text
=== RUNNING GATE A NORMAL-SAVE SNAPSHOTS & PROTOCOL V2 ACCEPTANCE MATRIX ===
>>> [TEST GROUP 1] Real App Lifecycle: saveCurrentWorkspace -> mutate Job -> init() -> Rest Enforcement
  [PASS] 1.1: HortOpsApp.saveCurrentWorkspace() successfully persisted nonempty historicalSnapshots.
  [PASS] 1.2: Edited parent Job persisted while original historical snapshot timing remained uncorrupted.
  [PASS] 1.3: Fresh HortOpsApp.init() reloaded workspace and resolved shift timing from authoritative snapshot.
  [PASS] 1.4: Canonical Eligibility Engine correctly rejected candidate for INSUFFICIENT_REST (4h rest < 10h required).
>>> [TEST GROUP 2] Protocol v2 Boundary Acceptance Matrix (Cases A1 - A8)
  [PASS] Case A1: Explicit empty new v2 state saves and loads successfully.
  [PASS] Case A2: Direct save with missing/null snapshots or rostering maps strictly rejected; storage untouched.
  [PASS] Case A3: Persisted v2 startup with missing evidence is quarantined; raw data untouched.
  [PASS] Case A4: v2 import missing any evidence map rejects regardless of assignments; explicit-empty succeeds.
  [PASS] Case A5: Direct restore with incomplete v2 rejects before storage or state mutation.
  [PASS] Case A6: Removing 1 of 2 identities across snapshots, instructions, or provenance blocks export with 0 downloads.
  [PASS] Case A7: Real export -> import prepare -> restore pipeline verified with exact bytes across all domains.
  [PASS] Case A8: Direct persistence write failure leaves previous stored bytes intact.
>>> [TEST GROUP 3] Review 10 Unified Invariant Closures
  [PASS] GA10-01: Common envelope builder strictly rejects incomplete raw v2 without synthesizing fallbacks.
  [PASS] GA10-02: Backup exporter strictly blocks download when committed storage baseline is malformed.
  [PASS] GA10-03: Normal save refuses to overwrite unreadable committed storage bytes.
  [PASS] GA10-04a: Boundary validator operates on defensive working copy; rejected validation leaves source object unmutated.
  [PASS] GA10-04b: Rejected restore leaves active app.state and storage completely untouched even with shared runtime references.
  [PASS] R11-01a: Missing baseline reader fails closed on normal save; storage preserved.
  [PASS] R11-01b: Missing baseline reader fails closed on backup; 0 downloads triggered.
  [PASS] R11-02: Backup includes live unsaved edits via checked save-then-export contract.
  [PASS] R11-03: Accepted restore adopts fully detached working copies of budgetSettings and uiState.
  [PASS] R11-04: Pre-clone non-JSON guard rejects Infinity/NaN without laundering into null.
================================================================
 ALL PROTOCOL V2, REVIEW 10 & REVIEW 11 TESTS PASSED (100%)
================================================================
```

### 3.2 Canonical Persistence Regression Suite (`scripts/test_persistence.cjs`)
Executed natively inside Ubuntu 24.04 WSL2: `node scripts/test_persistence.cjs`.
- Result: **ALL PERSISTENCE REGRESSION TESTS PASSED (100%)**.
- All 6 architecture dependency failure contracts passed (100% fail-closed).

### 3.3 Rostering Engine Verification (`scripts/test_rostering_engine.cjs`)
Executed natively inside Ubuntu 24.04 WSL2: `node scripts/test_rostering_engine.cjs`.
- Result: **ALL 26 OFFLINE17 ROSTERING TEST SUITES PASSED (100% COMPLIANT)**.

### 3.4 Single-File Standalone Rebuild & Checksum Verification
Compiled via `node scripts/build_single_file.cjs`:
- Inlined 1 stylesheet and 44 script modules.
- Checksums verified:
  ```text
  d9d1b1cde34d75d75fcedf1a1c85ea39fc9ac89ab80d7a4dc18cc73729847a97  index.html
  d9d1b1cde34d75d75fcedf1a1c85ea39fc9ac89ab80d7a4dc18cc73729847a97  dist/hort_ops_offline_planner.html
  ```
  Both files are **100% byte-for-byte identical**.

---

## 4. Scope Boundary, Retained Contracts & Deferred Gate B Work

1. **Retained Legacy v1 Migration:**
   - Legacy migration paths (`migrateWorkspaceV1toV2()`, legacy individual keys) remain intact and separately identifiable. Removal is strictly deferred to Gate C.
2. **Deferred Gate B Work (`GB-OWN-001`):**
   - Direct complete-v2 whole-workspace replacement currently permits intentional or accidental record key removal.
   - Gate B must define authorized full replacement and provenance-aware edits to distinguish intentional record retirement from unauthorized key loss.
   - Dynamic atomic mutation transactions across multi-shift operational edits.
3. **Formal Adjudication of Challenges:**
   - Audit confirmed that ChatGPT Review 10 unified specifications are completely sound, feasible, and verified. Zero design challenges required.

---

## 5. Stop Point Declaration

In strict compliance with Protocol v2 and Review 10 Section 5:
**DEVELOPER IMPLEMENTATION IS COMPLETE. ALL 8 BOUNDARIES AND REPAIRED PERSISTENCE REGRESSION SUITES ARE VERIFIED (100% PASS). WORK IS STOPPED AWAITING INDEPENDENT GATE A PEER REVIEW ACCEPTANCE.**
