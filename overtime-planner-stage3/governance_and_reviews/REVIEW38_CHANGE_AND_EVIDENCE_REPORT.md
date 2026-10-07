# Review 38 Change and Evidence Report: Stage 2 Workspace Management Remediation (PR23_02)

**Document Reference:** `REVIEW38_CHANGE_AND_EVIDENCE_REPORT.md`  
**Candidate Release Target:** `HortOps-Stage2-Corrective-PR23_02.zip`  
**Baseline Artifact:** `HortOps-Stage2-Full-PeerReview-PR23_01.zip`  
**Review Reference:** Review 38 (`Review38_PR23_01_Assessment_and_Prompts`)  
**Date:** 29 September 2026  
**Status:** **SUBMITTED FOR INDEPENDENT PEER REVIEW (Corrective Candidate PR23_02)**  
**Governance Scope:** Stage 1 Gates A–D remain **ACCEPTED & CLOSED**; Stage 3 remains strictly **NOT AUTHORISED**.

---

## 1. Architectural Design Decision & Recovery Model (R38-01)

### 1.1 Problem Statement & Risk Analysis
Review 38 identified that during destructive workspace reset (`StorageDriver.resetWorkspace()`), if key removal succeeds for an initial key (e.g. `hort_ops_workspace_v2`) but throws or fails on a subsequent key (e.g. `hort_ops_jobs_offline`), persistent storage is left in a partially erased state. While `HortOpsApp.resetToCleanSlate()` preserved live in-memory state and the modal suppressed reload, this in-memory preservation is fragile: once the user closes or reloads the browser tab, un-restored persistent data is lost. Furthermore, postcondition verification in PR23_01 only checked if `hort_ops_workspace_v2 === null`, rather than verifying that all targeted application keys were removed.

### 1.2 Evaluation of Alternative Designs
Per Directive Bounded Instructions:
- **Option A (Mandatory Pre-Reset Downloadable Backup):**
  - *Feasibility:* Browser file downloads initiated via DOM `a.click()` and `URL.createObjectURL(blob)` do not provide a synchronous, observable operating system guarantee that file persistence completed. Headless environments, browser popup blockers, or user cancellation of file dialogs cannot be synchronously verified by client JavaScript. Declaring a reset blocked on an unverifiable download creates false security or blocks automated environments.
- **Option B (Compensating Transactional Rollback + Durable Session Emergency Backup) — SELECTED:**
  - *Mechanism:* While `localStorage` lacks atomic multi-key transactions at the browser API level, the application driver implements an explicit two-phase transactional contract:
    1. **Preflight Inventory & Snapshot:** Before modifying persistent storage, inspect and snapshot all application-owned keys (`hort_ops_*` and `__hort_ops_*`) into an in-memory dictionary. If reading any key fails, immediately abort with `preflight_failed` (0 deletions performed).
    2. **Sequential Targeted Deletion:** Enumerate and remove targeted keys.
    3. **Compensating Rollback:** If any `removeItem` fails:
       - Immediately stop further deletions.
       - Restore all deleted keys back to `localStorage` from the preflight snapshot.
       - Verify post-rollback data matching in `localStorage`.
       - If verified: return `{ success: false, status: 'rolled_back', rolledBack: true }`. The pre-reset workspace remains 100% intact and demonstrably survives cold browser reload.
    4. **Emergency Session Staging:** If compensating rollback itself fails (e.g., storage quota lock):
       - Stage the recovery snapshot to `sessionStorage` under `hort_ops_emergency_recovery_v2` (which survives tab reloads in the same session).
       - Lock out autosave (`this._autosaveBlocked = true`).
       - Expose an emergency export button and clipboard copy in the modal banner.
    5. **Postcondition Verification on Success:**
       - Verify that *all* targeted application keys are permanently absent.
       - Clean up any temporary session recovery staging.
       - Unrelated origin keys are verified preserved.

---

## 2. Fail-Closed Master Release Gate Runner (R38-02)

### 2.1 Problem Statement
In PR23_01, `scripts/run_all_release_gates.cjs` recognized `BLOCKED` suites and tracked `totalBlocked`, but terminated with `process.exit(totalFailed > 0 ? 1 : 0)`. Thus, a run with `0 FAILED, 1 BLOCKED` exited code `0`, allowing incomplete mandatory browser verification to falsely pass the release gate.

### 2.2 Implemented Fail-Closed Architecture
1. **Deterministic Exit Codes:**
   - Exit `1` (`FAILED`): If `totalFailed > 0`.
   - Exit `2` (`BLOCKED`): If `totalBlocked > 0` with `totalFailed === 0`.
   - Exit `3` (`INCOMPLETE`): If `results.length !== totalSuites` or suite execution was truncated.
   - Exit `0` (`PASSED`): Only when all mandatory suites complete as `PASSED`.
2. **Dedicated Runner Self-Test Suite (`scripts/test_runner_contract.cjs`):**
   - Implements automated, reviewer-executable tests covering matrix items B01–B04.
   - Injected mandatory `BLOCKED` suite $\rightarrow$ Runner exits code `2` with `[RELEASE GATE BLOCKED]` summary (`1 BLOCKED, 0 FAILED`).
   - Injected mandatory `FAILED` suite $\rightarrow$ Runner exits code `1` with `[RELEASE GATE FAILED]` summary.
   - Injected all `PASSED` suites $\rightarrow$ Runner exits code `0` with `[RELEASE GATE PASSED]` summary.
   - Injected missing script / incomplete manifest $\rightarrow$ Runner exits code `3` or `1`.

---

## 3. Finding-by-Finding Diff & Remediation Map

| Finding ID | Severity | File(s) Modified | Architectural Remediation |
|---|---|---|---|
| **R38-01** | High | `js/utils/storage/storageDriver.js`<br>`js/utils/storage.js`<br>`js/app.js`<br>`js/components/resetWorkspaceModal.js` | Implemented preflight snapshotting, compensating rollback on partial deletion failure, emergency session staging on rollback write failure, autosave lockout (`_autosaveBlocked = true`), and truthful modal banners distinguishing rollback from emergency recovery. |
| **R38-02** | High | `scripts/run_all_release_gates.cjs`<br>`scripts/test_runner_contract.cjs` | Enforced fail-closed process exit codes for `BLOCKED` (code 2), `FAILED` (code 1), and `INCOMPLETE` (code 3). Created deterministic runner self-test matrix (B01–B04) and registered it as a mandatory Stage 2 Acceptance Gate. |

---

## 4. Review 38 Acceptance Matrix Verification Ledger

| ID | Scenario | Mandatory Assertion | Level | Result |
|---|---|---|---|:---:|
| **A01** | Preflight backup/read cannot complete | Zero deletions; reset fails explicitly; original state survives cold reload | Unit + Browser | **PASS** |
| **A02** | First targeted removal fails | No success or reload; durable recovery path demonstrably intact | Unit + Browser | **PASS** |
| **A03** | Second/later targeted removal fails after earlier deletion succeeds | Recovery restores/retains all pre-reset data after cold reload; no misleading intact-state claim | Unit + Browser | **PASS** |
| **A04** | Multiple removal calls fail | No success; deterministic recovery, explicit unrecovered keys and actionable path | Unit | **PASS** |
| **A05** | Compensating rollback / recovery persist fails | Detect separately; expose remaining valid recoverable bytes; autosave cannot overwrite them | Unit + Browser | **PASS** |
| **A06** | Success path | All app-owned targeted keys absent; unrelated origin key remains; no stale backup left contrary to policy | Unit + Browser | **PASS** |
| **A07** | Reload after success | Boot produces correct clean slate without old data repopulation | Browser | **PASS** |
| **A08** | Confirmation input not exactly `RESET` | No destructive call, no reload | Unit + Browser | **PASS** |
| **A09** | Reset fails after partial progress | Modal reports actual persistence/recovery state; no reload | Browser | **PASS** |
| **A10** | Corrupt-workspace quarantine and JSON restore | Existing recovery and export flows unchanged | Existing + Browser | **PASS** |
| **A11** | Existing R37 failure probes | 3/3 still pass | Node | **PASS** |
| **A12** | Existing Stage 2 workspace contract | 16/16 assertions pass | Node | **PASS** |
| **B01** | Inject one mandatory browser suite `BLOCKED`; all others `PASSED` | Summary says `BLOCKED`; release runner exits nonzero (code 2) | Runner Self-Test | **PASS** |
| **B02** | Inject one mandatory suite `FAILED`; all others `PASSED` | Summary says `FAILED`; release runner exits nonzero (code 1) | Runner Self-Test | **PASS** |
| **B03** | All mandatory suites `PASSED` | Accurate totals; exit zero | Runner Self-Test | **PASS** |
| **B04** | Missing / timed-out suite | Aggregate cannot exit zero; separate reason shown | Runner Self-Test | **PASS** |
| **B05** | Real full suite | Stage 1 retained and Stage 2 mandatory suites all pass; 20/20 passed, 0 failed, 0 blocked | Node + Browser | **PASS** |

---

## 5. Master Release Runner Output (`run_all_release_gates.cjs`)

```
================================================================
 HORTICULTURE OPERATIONS - COMPLETE RELEASE & RETAINED GATES RUNNER
================================================================

>>> [SUITE 1/20] Running Retained Gate B1: Canonical v2 Persistence & Boundary Validation...
[SUITE 1 PASSED] (0.17s, exit 0)
>>> [SUITE 2/20] Running Retained Gate B2: Authoritative Commitment Lifecycle Acceptance...
[SUITE 2 PASSED] (0.12s, exit 0)
>>> [SUITE 3/20] Running Retained Gate B3: Transaction Coordinator & Rollback Hardening...
[SUITE 3 PASSED] (0.05s, exit 0)
>>> [SUITE 4/20] Running Retained Gate C: Prototype Seed Isolation & Privacy Clearance...
[SUITE 4 PASSED] (0.08s, exit 0)
>>> [SUITE 5/20] Running Retained Canonical Restore: Full Envelope Equivalence (R23-B3)...
[SUITE 5 PASSED] (0.04s, exit 0)
>>> [SUITE 6/20] Running Review 29: Negative Canonical Domain Matrix & Shift Resilience...
[SUITE 6 PASSED] (0.07s, exit 0)
>>> [SUITE 7/20] Running FR-02: Strict Gregorian Calendar & Recurrence Interval Validation...
[SUITE 7 PASSED] (0.03s, exit 0)
>>> [SUITE 8/20] Running FR-03: Adelaide Timezone & DST-Aware 10-Hour Physical Rest...
[SUITE 8 PASSED] (0.04s, exit 0)
>>> [SUITE 9/20] Running RG1: Static Syntax & Helper Scope Audit...
[SUITE 9 PASSED] (0.96s, exit 0)
>>> [SUITE 10/20] Running RG2: Scheduler Engine Invariants & Recurrence Overrides...
[SUITE 10 PASSED] (1.74s, exit 0)
>>> [SUITE 11/20] Running RG3: Workforce Lifecycle & Assignment Integrity...
[SUITE 11 PASSED] (0.10s, exit 0)
>>> [SUITE 12/20] Running RG4: Persistence Contract & JSON Schema Validation...
[SUITE 12 PASSED] (0.10s, exit 0)
>>> [SUITE 13/20] Running RG5: Assisted Rostering Engine & Propagation Invariants...
[SUITE 13 PASSED] (0.06s, exit 0)
>>> [SUITE 14/20] Running RG6: Truthful Persistence State & Recovery Warnings...
[SUITE 14 PASSED] (0.03s, exit 0)
>>> [SUITE 15/20] Running RG7: Multi-Year Scheduler & Rostering Differential (2025-2028)...
[SUITE 15 PASSED] (0.91s, exit 0)
>>> [SUITE 16/20] Running RG8: Offline17.5j Rostering Integrity Freeze & Invariants...
[SUITE 16 PASSED] (23.82s, exit 0)
>>> [SUITE 17/20] Running RG9: Playwright Headless Browser Smoke Suite...
[SUITE 17 PASSED] (25.00s, exit 0)
>>> [SUITE 18/20] Running Stage 2 Node: Workspace Management, Destructive Reset & Storage Hygiene Contract...
[SUITE 18 PASSED] (0.10s, exit 0)
>>> [SUITE 19/20] Running Stage 2 Node: Master Release Runner Self-Test Contract (Matrix B01-B04)...
[SUITE 19 PASSED] (0.25s, exit 0)
>>> [SUITE 20/20] Running Stage 2 Browser: Workspace Seeding, Reset Verification & Quarantine Smoke...
[SUITE 20 PASSED] (3.80s, exit 0)

================================================================
 FINAL COMPLETE RELEASE GATES AUDIT SUMMARY
================================================================
 [PASSED] [Stage 1 Retained] Retained Gate B1: Canonical v2 Persistence & Boundary Validation (0.17s, exit 0)
 [PASSED] [Stage 1 Retained] Retained Gate B2: Authoritative Commitment Lifecycle Acceptance (0.12s, exit 0)
 [PASSED] [Stage 1 Retained] Retained Gate B3: Transaction Coordinator & Rollback Hardening (0.05s, exit 0)
 [PASSED] [Stage 1 Retained] Retained Gate C: Prototype Seed Isolation & Privacy Clearance (0.08s, exit 0)
 [PASSED] [Stage 1 Retained] Retained Canonical Restore: Full Envelope Equivalence (R23-B3) (0.04s, exit 0)
 [PASSED] [Stage 1 Retained] Review 29: Negative Canonical Domain Matrix & Shift Resilience (0.07s, exit 0)
 [PASSED] [Stage 1 Retained] FR-02: Strict Gregorian Calendar & Recurrence Interval Validation (0.03s, exit 0)
 [PASSED] [Stage 1 Retained] FR-03: Adelaide Timezone & DST-Aware 10-Hour Physical Rest (0.04s, exit 0)
 [PASSED] [Stage 1 Retained] RG1: Static Syntax & Helper Scope Audit (0.96s, exit 0)
 [PASSED] [Stage 1 Retained] RG2: Scheduler Engine Invariants & Recurrence Overrides (1.74s, exit 0)
 [PASSED] [Stage 1 Retained] RG3: Workforce Lifecycle & Assignment Integrity (0.10s, exit 0)
 [PASSED] [Stage 1 Retained] RG4: Persistence Contract & JSON Schema Validation (0.10s, exit 0)
 [PASSED] [Stage 1 Retained] RG5: Assisted Rostering Engine & Propagation Invariants (0.06s, exit 0)
 [PASSED] [Stage 1 Retained] RG6: Truthful Persistence State & Recovery Warnings (0.03s, exit 0)
 [PASSED] [Stage 1 Retained] RG7: Multi-Year Scheduler & Rostering Differential (2025-2028) (0.91s, exit 0)
 [PASSED] [Stage 1 Retained] RG8: Offline17.5j Rostering Integrity Freeze & Invariants (23.82s, exit 0)
 [PASSED] [Stage 1 Retained] RG9: Playwright Headless Browser Smoke Suite (25.00s, exit 0)
 [PASSED] [Stage 2 Acceptance] Stage 2 Node: Workspace Management, Destructive Reset & Storage Hygiene Contract (0.10s, exit 0)
 [PASSED] [Stage 2 Acceptance] Stage 2 Node: Master Release Runner Self-Test Contract (Matrix B01-B04) (0.25s, exit 0)
 [PASSED] [Stage 2 Acceptance] Stage 2 Browser: Workspace Seeding, Reset Verification & Quarantine Smoke (3.80s, exit 0)

----------------------------------------------------------------
 STAGE 1 RETAINED GATES: 17/17 PASSED (0 failed, 0 blocked)
 STAGE 2 ACCEPTANCE GATES:  3/3 PASSED (0 failed, 0 blocked)
----------------------------------------------------------------
TOTAL: 20 PASSED, 0 FAILED, 0 BLOCKED, 20/20 SUITES.

[RELEASE GATE PASSED] All 20 mandatory release gate suites passed with zero failures and zero blocked.
Process exit code: 0
```

---

## 6. Scope & Governance Attestation

1. **Stage 1 Immutability:** Stage 1 Gates A, B1, B2, B3, C, and D remain **ACCEPTED & CLOSED**. No Stage 1 schemas, commitment structures, or boundary checks were modified.
2. **Stage 3 Boundary:** No Stage 3 features (qualification matching, absence ledger, candidate rotation algorithms) were implemented.
3. **Offline & ES5 Invariants:** 100% ES5 vanilla JavaScript preserved in all client files; zero npm runtime packages; zero external CDN dependencies.
4. **Independent Review Status:** Stage 2 is not self-certified. Candidate PR23_02 is formally submitted for independent ChatGPT peer review.
