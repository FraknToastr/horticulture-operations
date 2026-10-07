# Stage 2: Workspace Management, Confirmed Destructive Reset & Storage Hygiene — Corrective Change & Evidence Report (PR23_01)

**Document ID:** `STAGE2-CHANGE-AND-EVIDENCE-REPORT-PR23_01`  
**Date:** 2026-09-29  
**Author:** Pair Programming Assistant (Gemini)  
**Governance Scope:** Stage 2 Workspace Management (Independent Review 37 Corrective Remediation)  
**Target Release:** `HortOps-Stage2-Corrective-PR23_01.zip`  
**Current Milestone Status:**  
- **Stage 1 (Gates A–D):** Formally **ACCEPTED & CLOSED** (Independent Reviews 1–36)  
- **Stage 2 (Workspace Management):** Formally **AUTHORISED BY USER; IMPLEMENTED (Corrective Candidate PR23_01 under Independent Review)**  
- **Stage 3 (Workforce Intelligence):** Strictly **NOT AUTHORISED** pending independent acceptance of Stage 2  

---

## 1. Executive Summary: Review 37 Root Causes & Corrections

Independent Review 37 issued a **Corrective Submission Required** decision on initial submission PR23. Corrective release candidate **PR23_01** resolves all six findings:

| Finding | Priority | Defect Summary | Corrective Resolution in PR23_01 |
|---|---|---|---|
| **R37-01** | P0/P1 | Reset failure ignored by app and modal reloads | `storageDriver.resetWorkspace()` tracks deletions and postconditions; `app.resetToCleanSlate()` checks return code and aborts in-memory wipe on storage error; `resetWorkspaceModal.js` suppresses reload on error and displays error banner. |
| **R37-02** | P1 | Compaction unconditionally reported success on removal error | `compactStorage()` tracks `deletionFailed`, only tallies bytes actually removed, returns `success: !deletionFailed`, and is verified idempotent on clean storage while protecting canonical/quarantine keys. |
| **R37-03** | P1 | Active probe key leaked on read mismatch; quota rounded before 80% check | Probe wrapped in `try ... finally` with nested error handler for double-fault protection; exact unrounded ratio `(usedBytes / quotaEstimate) * 100 > 80` implemented; 5MB labeled heuristic estimate. |
| **R37-04** | P1 | Stage 2 tests omitted from master release runner | Suites 18 (`test_stage2_workspace_contract.cjs`) and 19 (`test_stage2_browser_smoke.cjs`) registered in `run_all_release_gates.cjs` with segregated Stage 1 vs Stage 2 audit reporting. |
| **R37-05** | P1 | Contract tests bundled with Playwright browser tests; lacked negative & populated tests | Decoupled pure Node contract suite (`test_stage2_workspace_contract.cjs`, 11 assertions) from Playwright browser suite (`test_stage2_browser_smoke.cjs`, 5 lifecycle assertions on populated workspace with false token rejection). |
| **R37-06** | P2 | Documentation prematurely claimed complete independent acceptance | Synchronized briefings, roadmaps, and reports to state "Implemented (Candidate PR23_01 under Independent Review)"; documented `currentYear = 2026` as canonical baseline reference year. |

---

## 2. In-Depth Technical Remediation & Reset Recovery Contract

### 2.1 The Reset Recovery Contract (R37-01 & Assessment Priority 1)
LocalStorage is inherently non-transactional across multi-key operations. Naively persisting a backup key to `localStorage` before reset risks leaving orphaned user data if the destructive wipe is interrupted.

**PR23_01 Architectural Contract:**
1. **Pre-Wipe Snapshot Staging:**
   All `hort_ops_*` keys are inspected and tracked prior to removal.
2. **Individual Deletion Tracking & Postcondition Verification:**
   Every `localStorage.removeItem(key)` is wrapped in an individual `try ... catch`. If any deletion throws, or if `localStorage.getItem('hort_ops_workspace_v2')` remains non-null post-wipe, `resetWorkspace()` flags `deletionFailed = true` and returns boolean `false`.
3. **In-Memory Live Model Protection:**
   In `HortOpsApp.resetToCleanSlate()`, in-memory domain models (jobs, staff, assignments, permits, historical snapshots) are **never** cleared before persistent wipe verification. If `storage.resetWorkspace()` returns `false`, `resetToCleanSlate()` sets `state.storageStatus = 'save_failed'`, updates the header health indicator, and returns `false`.
4. **Unconditional Reload Suppression:**
   In `HortOpsResetWorkspaceModal.executeReset()`, if `resetToCleanSlate()` returns `false`, `window.location.reload()` is strictly suppressed. The modal remains open and renders `#reset-modal-error-banner` (`"Storage reset failed: persistent storage could not be wiped. Your live data has been preserved in memory."`).
5. **Clean Slate Postcondition:**
   When `resetWorkspace()` succeeds, live state cleanly initializes to 0 jobs, 0 staff, default budget, and `currentYear = 2026`. On browser reload, the application boots to a verified clean-slate state.

### 2.2 Truthful Storage Compaction & Idempotency (R37-02)
- Allowlisted stale keys (`hort_ops_custom_*`, `hort_ops_*_offline`, `__hort_ops_probe*`, `this.LEGACY_V1_KEY`) are removed individually.
- Active canonical keys (`hort_ops_workspace_v2`), quarantine keys, and third-party keys are never targeted.
- `reclaimedBytes` is only incremented when `removeItem` succeeds.
- When executed on clean storage (0 stale keys), returns `success: true, prunedCount: 0, reclaimedBytes: 0`.

### 2.3 Persistence Probe Double-Fault Robustness (R37-03)
- `getStorageHealth()` executes the write/read probe in a `try ... finally` block.
- The `finally` block executes `window.localStorage.removeItem(probeKey)` inside a nested `try ... catch`. If removal throws (e.g. storage locked read-only), `probeOk` is set to `false`, guaranteeing no lingering probe sentinels.
- Usage percentage is evaluated as `(usedBytes / quotaEstimate) * 100 > 80` without prior rounding.

---

## 3. Verification Runbook & Test Evidence

### 3.1 Reviewer Failure Probes Baseline (`scripts/review37_stage2_failure_probes.cjs`)
**Red Baseline on PR23:** `TOTAL 0 PASS, 3 FAIL`  
**Green Outcome on PR23_01:**
```text
StorageDriver removeItem failed for hort_ops_workspace_v2: Error: Injected removeItem denial: hort_ops_workspace_v2
PASS R37-P1: Failed reset must not report success or clear live state
Storage compaction deletion failure for hort_ops_custom_staff_v1: Error: Injected removeItem denial: hort_ops_custom_staff_v1
PASS R37-P2: Compaction deletion failures must be reported truthfully
PASS R37-P3: Persistence probe must clean up on read mismatch
TOTAL 3 PASS, 0 FAIL
```
*Raw Log:* `test_reports/stage2_review37_failure_probes_verified.log`

---

### 3.2 Deterministic Node Contract Suite (`scripts/test_stage2_workspace_contract.cjs`)
100% headless Node.js contract covering baseline probes, $n$-th key failure, reload suppression, compaction idempotency, probe double-fault, unrounded quota ratio, and quarantine extraction:
```text
================================================================
 STAGE 2 WORKSPACE MANAGEMENT & STORAGE HYGIENE CONTRACT SUITE
================================================================

[PASS] (1/11) R37-P1: Failed reset must not report success or clear live state
[PASS] (2/11) R37-P2: Compaction deletion failures must be reported truthfully
[PASS] (3/11) R37-P3: Persistence probe must clean up on read mismatch
[PASS] (4/11) T01-A: Nth-key deletion failure midway through reset must abort cleanly
[PASS] (5/11) T01-B: Verified clean reset initializes clean slate and wipes all owned keys
[PASS] (6/11) T01-C: Reset modal must suppress reload and render error banner on failure
[PASS] (7/11) T03-A: Compaction idempotency on already clean workspace
[PASS] (8/11) T03-B: Compaction prunes all allowlisted stale keys and leaves active data safe
[PASS] (9/11) T04-A: Probe cleanup double-fault marks probeOk = false without throwing
[PASS] (10/11) T04-B: Unrounded quota ratio boundary testing (> 80%)
[PASS] (11/11) T05: Quarantine payload extraction conserves corrupt bytes safely

----------------------------------------------------------------
TOTAL: 11 PASSED, 0 FAILED (of 11 contract assertions)
----------------------------------------------------------------
```
*Raw Log:* `test_reports/stage2_workspace_contract_verified.log`

---

### 3.3 Stage 2 Playwright Browser Smoke Suite (`scripts/test_stage2_browser_smoke.cjs`)
Real headless Chromium execution testing populated workspace seeding, confirmation rejection, exact `RESET` wipe, clean boot post-reload, storage health compaction, and quarantine recovery:
```text
================================================================
 STAGE 2 WORKSPACE MANAGEMENT & STORAGE BROWSER SMOKE SUITE
================================================================

Target Standalone Bundle: file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/dist/hort_ops_offline_planner.html

>>> [1/5] Seeding populated canonical Schema v2 workspace...
    [PASS] Populated workspace seeded successfully (2 jobs, 2 staff).
>>> [2/5] Testing Reset Confirmation input validation...
    [PASS] All false confirmation tokens strictly rejected.
>>> [3/5] Executing verified destructive reset...
    [PASS] Clean slate established and verified durable.
>>> [4/5] Testing Storage Health Monitor Modal & Compaction...
    [PASS] Storage health monitor, active probe & compaction verified.
>>> [5/5] Testing Corrupted Workspace Quarantine Recovery Flow...
    [PASS] Corrupted workspace triggered recovery state successfully.

================================================================
 ALL 5 STAGE 2 BROWSER LIFECYCLE TESTS PASSED (100% OK)
================================================================
```
*Raw Log:* `test_reports/stage2_browser_smoke_verified.log`

---

### 3.4 Complete Master Release Runner (`scripts/run_all_release_gates.cjs`)
Comprehensive 19-suite aggregate run across all 17 Retained Stage 1 Gates and 2 Stage 2 Acceptance Gates:
```text
================================================================
 FINAL COMPLETE RELEASE GATES AUDIT SUMMARY
================================================================
 [PASSED] [Stage 1 Retained] Retained Gate B1: Canonical v2 Persistence & Boundary Validation (0.17s, exit 0)
 [PASSED] [Stage 1 Retained] Retained Gate B2: Authoritative Commitment Lifecycle Acceptance (0.11s, exit 0)
 [PASSED] [Stage 1 Retained] Retained Gate B3: Transaction Coordinator & Rollback Hardening (0.05s, exit 0)
 [PASSED] [Stage 1 Retained] Retained Gate C: Prototype Seed Isolation & Privacy Clearance (0.08s, exit 0)
 [PASSED] [Stage 1 Retained] Retained Canonical Restore: Full Envelope Equivalence (R23-B3) (0.04s, exit 0)
 [PASSED] [Stage 1 Retained] Review 29: Negative Canonical Domain Matrix & Shift Resilience (0.07s, exit 0)
 [PASSED] [Stage 1 Retained] FR-02: Strict Gregorian Calendar & Recurrence Interval Validation (0.03s, exit 0)
 [PASSED] [Stage 1 Retained] FR-03: Adelaide Timezone & DST-Aware 10-Hour Physical Rest (0.04s, exit 0)
 [PASSED] [Stage 1 Retained] RG1: Static Syntax & Helper Scope Audit (0.95s, exit 0)
 [PASSED] [Stage 1 Retained] RG2: Scheduler Engine Invariants & Recurrence Overrides (1.74s, exit 0)
 [PASSED] [Stage 1 Retained] RG3: Workforce Lifecycle & Assignment Integrity (0.10s, exit 0)
 [PASSED] [Stage 1 Retained] RG4: Persistence Contract & JSON Schema Validation (0.10s, exit 0)
 [PASSED] [Stage 1 Retained] RG5: Assisted Rostering Engine & Propagation Invariants (0.07s, exit 0)
 [PASSED] [Stage 1 Retained] RG6: Truthful Persistence State & Recovery Warnings (0.03s, exit 0)
 [PASSED] [Stage 1 Retained] RG7: Multi-Year Scheduler & Rostering Differential (2025-2028) (0.91s, exit 0)
 [PASSED] [Stage 1 Retained] RG8: Offline17.5j Rostering Integrity Freeze & Invariants (21.48s, exit 0)
 [PASSED] [Stage 1 Retained] RG9: Playwright Headless Browser Smoke Suite (27.35s, exit 0)
 [PASSED] [Stage 2 Acceptance] Stage 2 Node: Workspace Management, Destructive Reset & Storage Hygiene Contract (0.09s, exit 0)
 [PASSED] [Stage 2 Acceptance] Stage 2 Browser: Workspace Seeding, Reset Verification & Quarantine Smoke (2.62s, exit 0)

----------------------------------------------------------------
 STAGE 1 RETAINED GATES: 17/17 PASSED (0 failed, 0 blocked)
 STAGE 2 ACCEPTANCE GATES: 2/2 PASSED (0 failed, 0 blocked)
----------------------------------------------------------------
TOTAL: 19 PASSED, 0 FAILED, 0 BLOCKED, 19 SUITES.
```
*Raw Log:* `test_reports/release_runner_r37_stage2_verified.log`

---

## 4. Architectural Boundaries & Compliance

1. **Zero NPM Runtime Dependencies:** Pure client-side browser execution via `file://`.
2. **Strict ES5 Compliance:** Verified across all modular JS source files.
3. **Single-File Parity:** Root `index.html` and `dist/hort_ops_offline_planner.html` compiled via `scripts/build_single_file.cjs` and confirmed 100% byte-for-byte identical (671.8 KB).
4. **Deletions Hygiene:** Confirmed zero prohibited prototype artifacts via `scripts/verify_deletions.cjs`.
5. **Cryptographic Manifest:** All tracked repository files verified in `MANIFEST.sha256.txt`.
