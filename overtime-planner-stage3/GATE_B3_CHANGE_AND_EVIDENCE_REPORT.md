# Stage 1 Gate B3 Change and Evidence Report (PR20)

**Document Reference:** `GATE_B3_CHANGE_AND_EVIDENCE_REPORT.md`  
**Governing Reviews:** Independent Peer Review 20 (`HortOps_Stage1_PR19_Full_Independent_Peer_Review.md`) & `GEMINI_STAGE1_GATE_B3_PR19_FULL_REVIEW_EXECUTION_PROMPT.md`  
**Authorised Gate:** Stage 1 Gate B3 (Transaction Hardening, Snapshot Evidence Loss Protection, Restore Canonical Equivalence & Modals Non-Aliasing)  
**Date:** 2026-09-27  
**Status:** **IMPLEMENTATION COMPLETE — Awaiting Independent Review 21**  

---

## 1. Executive Summary & Authorisation

Stage 1 Gate B2 was formally **ACCEPTED** by Independent Peer Review 20 on 2026-09-27 (accepted PR19 SHA-256: `796177ccc5f18c40992e6253b4c313a80f7327d2c3e1b1d69126906f8653947d`), endorsing the complete closure of B2-R19-01, B2-R19-02, and B2-R19-03, with documented B3 and pre-Gate D release blocker deferrals (FR-02 and FR-03).

Stage 1 Gate B3 was subsequently authorised for implementation under `GEMINI_STAGE1_GATE_B3_PR19_FULL_REVIEW_EXECUTION_PROMPT.md`. Gate B3 resolves the transactional vulnerabilities identified across mid-tier mutation methods (`updatePermit`, `saveJob`, `deleteJob`, `updateStaffMember`, `reconcileStaffSnapshot`, `importStaffMembers`), enforces stage-before-commit atomicity via a centralised proposal committer (`_commitCanonicalProposal`), eliminates snapshot evidence loss when deleting history-only jobs (FR-01), ensures canonical restore equivalence with safe defaults for omitted domains (FR-04), ensures truthful return values for all UI modal callers, and eliminates caller-alias mutation pollution.

All work has been executed inside Linux (Ubuntu 24.04 WSL2) using pure synthetic data. Zero personal staff data or operational rosters were used.

---

## 2. Bounded Write-Path Audit Table

As mandated by Section 3 of the execution prompt, the following 10-column audit was performed across all B3 write-path methods prior to implementation:

| Method | Canonical Domains Touched | Live Mutation Before Commit? | Checked Return? | Rollback Mechanism | Committed-Byte Effect on Failure | Cache/Digest/Render Side Effects | Caller Alias Risk | B2 Evidence Impact | Test ID |
|---|---|---|---|---|---|---|---|---|---|
| `updatePermit(shiftKey, overrides)` | `permits` | **NO** (Staged on detached clone) | **YES** (`{ success, error }`) | Live state untouched; storage write never executed if preflight fails | Zero byte change; exact baseline preserved | None on failure; recomputes digest and re-renders only on success | None (cloned) | None; snapshots preserved | B3-01, B3-02, FULL-B3-03 |
| `reconcileStaffSnapshot(analysis)` | `roster`, `assignments` | **NO** (Staged on detached proposals) | **YES** (`{ success, error, stats }`) | Live state untouched; departed staff retained if scheduled | Zero byte change; exact baseline preserved | None on failure; recomputes digest only on success | None (cloned) | Preserves historical snapshots & scheduled assignments | B3-05, B3-06, B3-07, FULL-B3-04 |
| `importStaffMembers(csvData)` | `roster` | **NO** (Delegates to `reconcileStaffSnapshot`) | **YES** (`{ success, error, count }`) | Live state untouched | Zero byte change; exact baseline preserved | None on failure; recomputes digest only on success | None (cloned) | Preserves historical snapshots | B3-05, B3-06 |
| `updateStaffMember(updatedStaff)` | `roster` | **NO** (Staged on detached clone; rejects ID mutation) | **YES** (`{ success, error }`) | Live state untouched | Zero byte change; exact baseline preserved | None on failure; recomputes digest only on success | None (deep clone detached from caller) | None; snapshots preserved | B3-03, B3-04, B3-13, FULL-B3-08 |
| `saveJob(jobData)` | `jobs`, `rostering.instructions` (if retiring) | **NO** (Staged on detached jobs & instructions clone) | **YES** (`{ success, error }`) | In-memory clone rolled back on storage failure | Zero byte change; exact baseline preserved | None on failure; recomputes digest only on success | None (caller input cloned before staging) | Sealing instruction preserves evidence | B3-08, B3-09, B3-10, FULL-B3-05, B3-13 |
| `deleteJob(jobId)` | `jobs`, `rostering.instructions` | **NO** (Delegates dependent jobs to `saveJob`; unencumbered jobs staged on detached clone) | **YES** (`{ success, error }`) | Live state untouched on storage failure | Zero byte change; exact baseline preserved | None on failure; recomputes digest only on success | None | **FR-01 Fixed:** Recognises `historicalSnapshots`; prevents hard-delete | B3-11, B3-12, FULL-B3-01, FULL-B3-02 |
| `restoreWorkspaceJson(jsonStr)` | All (`schemaVersion`, `jobs`, `roster`, `assignments`, `rostering`, `historicalSnapshots`, `permits`, `budgetSettings`, `uiState`) | **NO** (Full detached schema-v2 validation and persistence before live replacement) | **YES** (`boolean`) | Full pre-existing live state and committed storage bytes preserved | Zero byte change on invalid input | Invalidate caches and reload only after verified storage write | None (parsed detached envelope) | Pre-existing snapshots preserved on invalid input; restored snapshots adopted atomically | FULL-B3-06, FR-04 |

---

## 3. Detailed Implementation Architecture

### 3.1 Central Proposal Committer (`_commitCanonicalProposal`)
Located in `js/app.js`, `_commitCanonicalProposal(proposalOverrides)` acts as the single, authoritative stage-before-commit transaction coordinator:
1. **Recovery Guard:** Fails closed if app is currently in recovery mode.
2. **Schema Invariant A:** Validates Schema v2 presence on runtime state.
3. **Committed Baseline Reader:** Calls `storage.readVerifiedCommittedV2()` to verify storage is readable.
4. **Evidence-Loss Guard:** Compares live snapshot count and identity keys against committed storage, preventing accidental snapshot erasure.
5. **Canonical Envelope Creation:** Calls `storage.createWorkspaceEnvelope()` with proposed overrides merged over current live state.
6. **Single Atomic Commit:** Calls `storage.saveWorkspace(envelope)` once.
7. **Storage Status Truthfulness:** Updates `this.state.storageStatus` to `'saved'` on success, or `'session_only'` / `'save_failed'` on failure.
8. **Detached Return:** Returns `{ success: boolean, storageMode, envelope, snapshotCount, error }` to caller. Live state is ONLY adopted after verified success.

### 3.2 B3-01: Permit Mutation Atomicity (`updatePermit`)
- Staged on a detached clone of `state.customPermits`.
- Validates payload and builds candidate permit object.
- Commits proposed permits map via `_commitCanonicalProposal({ customPermits: stagedPermits })`.
- Live state (`state.customPermits`) is adopted **only after successful commit**.
- On failure, live permits remain untouched, storage bytes remain byte-identical, and `{ success: false, error }` is returned.
- Direct UI caller in `staffAssignModal.js` checks `{ success, error }` contract and alerts operator on failure without closing modal.

### 3.3 B3-02 & B3-03: Workforce Reconciliation & Individual Staff Atomicity
- **Reconciliation Engine Output:** Roster and assignments proposals are treated as a single atomic unit. If storage write fails, neither is published.
- **Departed Staff Preservation:** `reconcileStaffSnapshot()` checks whether departing staff hold scheduled assignments; if so, their historical records and assignments are preserved rather than silently revoked.
- **Individual Staff Mutation:** `updateStaffMember()` deep-clones caller input, rejects staff ID mutations, verifies staff exists, stages detached roster clone, and commits via `_commitCanonicalProposal`.
- **Caller Isolation:** Detached cloning ensures subsequent mutations to the caller's object cannot mutate live state.
- Direct UI callers in `staffExemptionModal.js` and `importModal.js` check `{ success, error }` contract.

### 3.4 B3-04 & FR-01: Job Management & Snapshot Evidence Protection
- **FR-01 Resolution in `getJobDependencies`:** Updated dependency counter to inspect `state.historicalSnapshots`. If any historical snapshot references the target Job ID, `historicalSnapshots` count is incremented, and `canHardDelete` evaluates to `false`.
- **Safe Retirement:** Jobs with historical snapshots but no active rostering instructions are transitioned to `status: 'inactive'` via `saveJob()`, preserving all historical evidence and attributions.
- **Fail-Closed on Future Instructions:** Jobs with active future rostering instructions remain strictly protected against deletion.
- **Unencumbered Hard Deletion:** Truly unencumbered jobs (0 dependencies) are staged on a detached clone, committed via `_commitCanonicalProposal`, and rolled back if storage write fails.
- **Input Isolation:** `saveJob()` deep-clones caller input, eliminating aliasing vulnerabilities.

### 3.5 B3-05 & FR-04: Full Restore Canonical Equivalence
- In `restoreWorkspaceJson()`, restored data completely replaces live state, eliminating stale lingering properties.
- **Canonical Defaults Policy:** When optional domains are omitted from an accepted Schema v2 restore payload:
  - `budgetSettings` resets to `window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS` (`{ annualBudgetCap: 50000 }`), preventing stale pre-restore caps.
  - `uiState` resets to canonical view defaults (`activeView: 'forward_planner'`, `currentYear: 2026`).
- On validation or persistence failure, prior live state and committed storage bytes remain 100% byte-identical.

---

## 4. Verification & Test Evidence

All tests executed in Linux (Ubuntu 24.04 WSL2):

### 4.1 Focused Gate B3 Suite (`scripts/test_gate_b3.cjs`)
Created dedicated 18-test suite covering B3-01 through B3-14 and FULL-B3-01 through FULL-B3-08:
```text
=== RUNNING GATE B3 TRANSACTION HARDENING & ATOMICITY TEST SUITE ===
  [PASS] B3-01: updatePermit: successful permit mutation commits and adopts state
  [PASS] B3-02 / FULL-B3-03: updatePermit: storage failure rolls back live permits, bytes unchanged
  [PASS] B3-03: updateStaffMember: successful update commits and adopts detached state
  [PASS] B3-04: updateStaffMember: storage failure leaves staff list and committed bytes unchanged
  [PASS] B3-05: reconcileStaffSnapshot: successful reconciliation commits atomically and adopts state
  [PASS] B3-06 / FULL-B3-04: reconcileStaffSnapshot: storage failure preserves original roster, assignments, and storage bytes
  [PASS] B3-07: reconcileStaffSnapshot: departed staff does not erase historical scheduled commitment assignments
  [PASS] B3-08 / FULL-B3-05: saveJob: existing Job edit storage failure preserves original Job and bytes
  [PASS] B3-09: saveJob: new Job insertion storage failure does not append uncommitted Job to live list
  [PASS] B3-10: saveJob: instruction sealing on retirement rolls back if storage write fails
  [PASS] B3-11: deleteJob: unencumbered hard delete failure rolls back live jobs list
  [PASS] B3-12: deleteJob: active future rostering instruction fails closed against retirement deletion
  [PASS] FULL-B3-01 (FR-01): getJobDependencies: recognizes historical scheduled commitment snapshots; prevents hard delete
  [PASS] FULL-B3-02: deleteJob: storage failure during history-only retirement rolls back live state and bytes
  [PASS] FULL-B3-06 (FR-04): restoreWorkspaceJson: accepted partial restore resets omitted optional domains to canonical defaults
  [PASS] FULL-B3-06 (Negative): restoreWorkspaceJson: rejected invalid restore preserves prior live state and storage bytes
  [PASS] B3-13 / FULL-B3-08: caller-owned mutation after successful saveJob or updateStaffMember cannot reach adopted live state
  [PASS] B3-14 / FULL-B3-07: unrelated B3 mutations preserve B2 snapshots, instructions, provenance and canonical identity

================================================================
 ALL GATE B3 TESTS PASSED (18/18) [100%]
================================================================
```

### 4.2 Independent Reviewer Synthetic Probes (`scripts/HortOps_PR19_Independent_Synthetic_Probes.cjs`)
Preserved reviewer synthetic test script unchanged as independent baseline. Executed with outcome:
```text
NOT_REPRODUCED History-only job can be hard deleted while retained snapshot references missing job (FR-01: RESOLVED)
REPRODUCED Impossible one-off date accepted: {"targetDate":"2026-02-30","validated":true,"saved":true} (FR-02: DEFERRED TO PRE-GATE D)
REPRODUCED Fractional recurrence interval accepted: {"intervalWeeks":1.5,"validated":true} (FR-02: DEFERRED TO PRE-GATE D)
NOT_REPRODUCED Optional omitted restore fields leave live/persisted budget or UI divergent (FR-04: RESOLVED)
CONTROL normal-save snapshot retained: true (PASS)
NOT_REPRODUCED Known B3 permit rollback gap (FR-05: RESOLVED)
Independent source-boundary probes complete. Findings reproduced: 2
```
All targeted B3 findings (FR-01, FR-04, FR-05) are proven **RESOLVED**. The only reproduced findings are the two facets of FR-02, which are explicitly registered pre-Gate D release blockers. Zero new regressions introduced.

### 4.3 Regression Test Suites
All existing suites pass 100%:
- `node scripts/test_gate_b2.cjs`: **100% PASS** (Scenarios 1-6 + R18/R19 suites).
- `node scripts/test_gate_b1.cjs`: **100% PASS** (Assertions 1-11).
- `node scripts/test_normal_save_snapshots.cjs`: **100% PASS** (Groups 1-3).
- `node scripts/test_persistence.cjs`: **100% PASS** (Sections 1-31 & Architecture Fail-Closed contracts).
- `node scripts/test_recovery_ui.cjs`: **100% PASS**.
- `node scripts/test_static_release.cjs`: **100% PASS** (45/45 JavaScript files pass node --check syntax audit, 0 undeclared helper identifiers).

### 4.4 Standalone Compilation & Checksum Verification
Compiled standalone distributions via `node scripts/build_single_file.cjs`:
- `index.html`: `e6ace5a62270632d8b6b07a0a5d16550bd8e125bda61ca86ea904768a08615aa` (831.4 KB)
- `dist/hort_ops_offline_planner.html`: `e6ace5a62270632d8b6b07a0a5d16550bd8e125bda61ca86ea904768a08615aa` (831.4 KB)
Both files are byte-for-byte identical.

---

## 5. Full-Review Findings Ledger (FR-01 through FR-09)

| Finding | Description | Disposition | Status / Evidence |
|---|---|---|---|
| **FR-01** | History-only job can be hard-deleted while retained snapshot references missing job | B3 Core Scope | **RESOLVED.** `getJobDependencies` inspects `state.historicalSnapshots`; prevents hard deletion and enforces retirement. Verified in `test_gate_b3.cjs` and `HortOps_PR19_Independent_Synthetic_Probes.cjs`. |
| **FR-02** | Job schedule validator accepts invalid calendar dates (e.g. 2026-02-30) and fractional recurrence intervals | Pre-Gate D Release Blocker | **REGISTERED RELEASE BLOCKER.** Deferred to bounded pre-Gate D release gate. Acceptance note below. |
| **FR-03** | Host-timezone-dependent 10-hour physical rest calculation | Pre-Gate D Release Blocker | **REGISTERED RELEASE BLOCKER.** Requires South Australia roster timezone semantics and dual-host DST verification under `Australia/Adelaide` and `UTC`. Deferred to pre-Gate D release gate. Acceptance note below. |
| **FR-04** | Accepted partial-v2 restore leaves stale live budget/UI values | B3 Core Scope | **RESOLVED.** `restoreWorkspaceJson` resets omitted optional domains to canonical defaults (`DEFAULT_BUDGET_SETTINGS` and default UI view). Verified in `test_gate_b3.cjs` and `HortOps_PR19_Independent_Synthetic_Probes.cjs`. |
| **FR-05** | Permit mutation before save with live/storage divergence on failure | B3 Core Scope | **RESOLVED.** `updatePermit` stages detached clone, validates, persists via `_commitCanonicalProposal`, and adopts only on success. Verified in `test_gate_b3.cjs` and `HortOps_PR19_Independent_Synthetic_Probes.cjs`. |
| **FR-06** | Prototype employee data and private XLSX workbooks in repository | Gate C | **DEFERRED TO GATE C.** Development seed isolation and legacy removal are strictly assigned to Gate C. No prototype data included in B3 PR20 package. |
| **FR-07** | Obsolete `test_rostering_lifecycle.cjs` test-14 fixture and unexecuted Playwright browser smoke | Gate D | **DEFERRED TO GATE D.** Test-14 fixture repair and full browser smoke testing are assigned to Gate D release verification. |
| **FR-08** | Outdated governance statuses in transition register and continuity guide | B3 Core Scope | **RESOLVED.** `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md` and `STAGE1_GATE_A_PEER_REVIEW_CONTINUITY.md` updated with Gate B2 acceptance (Review 20) and Gate B3 in progress. |
| **FR-09** | ES5 claim vs modern holiday module syntax | Gate D | **DEFERRED TO GATE D.** Standards and build compatibility verification assigned to Gate D. |

---

## 6. Non-Implementing Release-Blocker Acceptance Notes

### 6.1 FR-02 Acceptance Note: Schedule Precision & Recurrence Interval Validation
- **Classification:** Pre-Gate D Release Blocker (Mandatory before Stage 1 sign-off).
- **Target Seam:** `js/utils/storage/schemaValidator.js` (`validateJob()` / `isRealYmd()`) and `js/components/jobEditModal/formValidator.js`.
- **Synthetic Input Matrix:**
  1. `{ targetDate: '2026-02-30', frequencyType: 'one_off' }` -> Invalid calendar date; must reject with descriptive validation error.
  2. `{ frequencyType: 'recurring', intervalWeeks: 1.5 }` -> Non-integer recurrence interval; must reject with descriptive validation error (strictly positive integers only).
  3. `{ frequencyType: 'recurring', intervalWeeks: 0 }` -> Zero recurrence interval; must reject.
- **Expected Invariant:** Only real Gregorian calendar dates validated via strict year-month-day decomposition (e.g. `new Date(Date.UTC(y, m-1, d))` matching input `y, m, d`) and positive integer interval weeks (`Number.isInteger(n) && n >= 1`) may pass schema validation or form entry.
- **Verification Command:** Dedicated test suite `node scripts/test_fr02_schedule_validation.cjs` to be authored during pre-Gate D.

### 6.2 FR-03 Acceptance Note: Timezone and DST-Aware 10-Hour Rest Validation
- **Classification:** Pre-Gate D Release Blocker (Mandatory before Stage 1 sign-off).
- **Target Seam:** `js/utils/eligibilityEngine.js` (rest-gap calculation) and `js/utils/scheduler/engine.js`.
- **Operating Context:** South Australia operational timezone (`Australia/Adelaide`, UTC+09:30 standard / UTC+10:30 daylight saving time).
- **Synthetic Input Matrix:**
  1. Shift boundary crossing autumn daylight saving changeover (April transition, 25-hour day): physical rest must measure actual wall-clock elapsed minutes (>= 600 min), not nominal local hour subtraction.
  2. Shift boundary crossing spring daylight saving changeover (October transition, 23-hour day): 10 hours rest must account for clock jump.
  3. Execution verification under `TZ=UTC` and `TZ=Australia/Adelaide` environments producing identical eligibility decisions.
- **Expected Invariant:** 10-hour physical rest calculation must operate on epoch milliseconds / UTC timestamps derived from SA local time, guaranteeing exactly 36,000,000 milliseconds of elapsed rest regardless of host machine timezone.
- **Verification Command:** Dedicated test suite `node scripts/test_fr03_dst_rest.cjs` executed under both `TZ=UTC node ...` and `TZ=Australia/Adelaide node ...`.

---

## 7. Delivery Package & Stopping Rule

- **Delivery Package:** `HortOps-Stage1-GateB3-PR20.zip`
- **Contents:**
  - Production source: `js/app.js`, `js/components/staffAssignModal.js`, `js/components/staffExemptionModal.js`, `js/components/importModal.js`
  - Compiled distribution: `index.html`, `dist/hort_ops_offline_planner.html`
  - Test suites: `scripts/test_gate_b3.cjs`, `scripts/HortOps_PR19_Independent_Synthetic_Probes.cjs`
  - Governance & Reports: `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`, `STAGE1_GATE_A_PEER_REVIEW_CONTINUITY.md`, `GATE_B3_CHANGE_AND_EVIDENCE_REPORT.md`, `HANDOFF_GATE_B3_PR20.md`, `MANIFEST.sha256.txt`
- **Mandatory Stop Condition:** Gemini execution stops immediately upon generation of this report and submission of PR20. No self-authorisation of Gate C, Gate D, Stage 2, or Stage 3. Awaiting Independent Peer Review 21.
