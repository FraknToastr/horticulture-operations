# Independent Peer Review 56 Findings Disposition: Candidate PR26

**Date:** 2026-10-04  
**Author:** Principal Municipal Operational Systems Architect  
**Evaluation Target:** Candidate PR26 (remedying all findings from Review 56 Candidate PR25)  
**Authority:** Owner-authorized for **Stage 3**. Stage 4 is **NOT authorized**.  
**Baseline Commitments & Invariants:**
- **Invariant C2:** Additive backward compatibility with Schema v2.
- **Invariant C9:** Bit-for-bit SHA-256 build parity between [index.html](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/index.html) and [dist/hort_ops_offline_planner.html](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/dist/hort_ops_offline_planner.html).
- **Invariant C10:** 24 Permanent Master Release Suites (17 Stage 1 + 7 Stage 2) must remain 24/24 green without regressions.
- **Fail-Closed Safety:** Missing, throwing, or malformed safety dependencies must strictly block candidate allocation.

---

## 1. Executive Summary

All 6 findings from Independent Peer Review 56 (`R56-P0-01` through `R56-P1-06`, including `R56-P01b` consequence) have been fully investigated, reproduced, repaired, and permanently verified under automated contracts. 

Zero regressions were introduced to existing Stage 1 and Stage 2 baselines:
- **Review 55 Adversarial Probes:** 0 departures.
- **Review 56 Durability Contract Probes:** 6/6 test groups passed (100% OK).
- **Stage 3 Master Acceptance Suite:** 6/6 gates passed (100% OK).
- **Playwright Headless Browser Smoke:** 6/6 tests passed (100% OK).
- **24 Master Release Gates:** 24/24 passed cleanly (17/17 Stage 1, 7/7 Stage 2).
- **Single-File Compilation Parity:** SHA-256 matched bit-for-bit (`19cc108a77f06814ef85605c810f474cc93c33876675df147eaef724085e2574`).

---

## 2. Complete Findings Disposition Matrix

| Finding ID | Severity | Title & Review 56 Departure | Root Cause | Files & Lines Modified | Automated Evidence & Contracts | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R56-P0-01** | **P0** | **Canonical Ledger Durability**<br/>`app.init()` dropped populated `absences` and `refusalHistory` from loaded Schema v2 workspace. | Initial state declaration omitted default properties; `init()` read only legacy properties; commit proposals failed to attach domains to envelope. | [js/app.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/app.js) lines 14-16, 38-41, 218-226, 370-375, 758-765, 807-810, 890-892, 1000-1016;<br/>[js/components/exportModal.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/exportModal.js) lines 51-52 | [scripts/test_stage3_absence_persistence_contract.cjs](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/scripts/test_stage3_absence_persistence_contract.cjs) (Test 2); `test_review56_resolved.cjs` Probe 1 & 2. | **RESOLVED** |
| **R56-P0-02** (`R56-P01b`) | **P0** | **Actual Absence Enforcement**<br/>Unloaded absence ledger permitted on-leave workers in normal runtime; absentees not hard-blocked across entry points. | `validateEmployeeForOccurrence` lacked authoritative check against canonical absence ledger; modal lacked pre-save absence violation check. | [js/utils/eligibilityEngine.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/eligibilityEngine.js) lines 410-440;<br/>[js/components/staffAssignModal.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffAssignModal.js) lines 917-940 | [scripts/test_stage3_absence_persistence_contract.cjs](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/scripts/test_stage3_absence_persistence_contract.cjs) (Test 1, 2b); `test_review56_resolved.cjs` Probe 1b. | **RESOLVED** |
| **R56-P0-03** | **P0** | **Fair-Share Ranking with Refusals**<br/>Standalone fair-share calculation was not wired to ranking; candidate ordering and rotation ignored refusal counts. | Candidate model and rostering engine sorted only by YTD hours, ignoring refusal history; refusal counting was not dynamic in score function. | [js/utils/absences.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/absences.js) lines 135-155;<br/>[js/components/staffAssignModal/candidateModel.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffAssignModal/candidateModel.js) lines 195-207;<br/>[js/utils/rostering/engine.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/rostering/engine.js) lines 280-295 | [scripts/test_stage3_absence_persistence_contract.cjs](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/scripts/test_stage3_absence_persistence_contract.cjs) (Test 5); `test_review56_resolved.cjs` Probe 3. | **RESOLVED** |
| **R56-P1-04** | **P1** | **Fail-Closed Missing Fatigue Engine**<br/>When `simulateAssignmentFatigue` was missing or threw, worker was permitted; malformed returns pushed wrong reason. | Engine availability check was not strictly fail-closed, and catch block did not mark hard block; non-object return was miscategorized. | [js/utils/eligibilityEngine.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/eligibilityEngine.js) lines 454-471;<br/>[js/components/staffAssignModal.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffAssignModal.js) lines 895-915 | [scripts/test_stage3_absence_persistence_contract.cjs](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/scripts/test_stage3_absence_persistence_contract.cjs) (Test 6a, 6b, 6c); `test_review56_resolved.cjs` Probe 4. | **RESOLVED** |
| **R56-P1-05** | **P1** | **Fail-Closed Missing Absence Engine**<br/>When absence method was missing or threw, worker became eligible rather than hard-blocked. | Silent fallback defaulted missing engine or corrupt ledger to `absent: false` rather than asserting `ABSENCE_ENGINE_UNAVAILABLE`. | [js/utils/eligibilityEngine.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/eligibilityEngine.js) lines 410-440;<br/>[js/components/staffAssignModal.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffAssignModal.js) lines 917-940 | [scripts/test_stage3_absence_persistence_contract.cjs](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/scripts/test_stage3_absence_persistence_contract.cjs) (Test 6d, 6e); `test_review56_resolved.cjs` Probe 5. | **RESOLVED** |
| **R56-P1-06** | **P1** | **Operational Absence & Refusal Management UI**<br/>Absence intervals and refusal history lacked supervisor-facing CRUD, live shift conflict alerts, and transactional persistence. | UI forms for editing absence intervals and logging refusals were missing from the interactive Stage 3 feature gate. | [js/components/staffAbsenceModal.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffAbsenceModal.js);<br/>[js/components/staffRegistry.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffRegistry.js) line 162;<br/>[index.modular.html](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/index.modular.html) lines 30, 82;<br/>[scripts/build_single_file.cjs](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/scripts/build_single_file.cjs) lines 73-74 | [scripts/test_stage3_browser_smoke.cjs](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/scripts/test_stage3_browser_smoke.cjs); Playwright Chromium live modal audit. | **RESOLVED** |

---

## 3. Detailed Technical Remediation

### 3.1 P0-1 Canonical Ledger Durability
1. **Initial State Declaration:** `js/app.js` declares `absences: []` and `refusalHistory: []` on `HortOpsApp.state`.
2. **Cold App Initialization:** `app.init()` extracts `ws.absences` and `ws.refusalHistory` from loaded storage, with backward-compatible alias fallback for `ws.refusals`.
3. **Detached Proposal Commit:** In `_commitCanonicalProposal()`, proposal overrides or state values are validated as fail-closed arrays. An **evidence-loss guard** rejects commits if established storage contains absences (`committed.data.absences.length > 0`) and a non-reset proposal provides an empty array (`"Suspicious evidence loss: absence records dropped"`).
4. **Export Modal Projection:** `js/components/exportModal.js` packages `absences` and `refusalHistory` with defensive `Array.isArray()` defaulting, preventing `undefined` property leakage during JSON serialization.
5. **Transactional Persistence Helper:** Added `app.saveAbsenceAndRefusalData(updatedAbsences, updatedRefusals)` for atomic ledger mutations with automatic digest recomputation and view re-rendering.

### 3.2 P0-2 Actual Absence Enforcement
1. **Authoritative Occurrence Hard Block:** In `js/utils/eligibilityEngine.js` (`validateEmployeeForOccurrence`), occurrence dates are checked against the canonical absence ledger. If `isStaffAbsentOnDate` returns `absent: true`, candidate is hard-blocked with reason `STAFF_ABSENT` across manual, modal, rotation, and auto-recommendation pathways.
2. **Modal Pre-Save Validation:** In `js/components/staffAssignModal.js`, `saveAllocation()` cross-checks all staged officers against absence records on the target shift date and aborts save if any absent officer remains staged.
3. **Cross-Year Boundary Continuity:** Permanent contract tests verify that absence intervals crossing the calendar boundary (e.g., 2026-12-30 through 2027-01-05) enforce hard blocks on 30 Dec, 31 Dec, 01 Jan, and 05 Jan, while correctly releasing officers on 06 Jan.

### 3.3 P0-3 Fair-Share Ranking with Refusals
1. **Equitable Ranking Formula:**
   $$\text{Score} = 1000 - (\text{ytdHours} \times 2) + (\text{refusalCount} \times 5) - \text{fatiguePenalty}$$
2. **Refusal History Integration:** `calculateFairShareScore(staff, params)` dynamically calculates refusal count from `params.refusalHistory` if not explicitly supplied.
3. **Candidate Ordering:** In `js/components/staffAssignModal/candidateModel.js`, candidate sorting evaluates fair-share scores descending (`scoreB - scoreA`), ensuring officers who previously refused overtime receive higher priority in subsequent offerings.
4. **Assisted Rotation:** In `js/utils/rostering/engine.js` (`recommendRotationCandidate`), rotation candidate selection breaks ties using fair-share scores before name or role.
5. **Authorised Leave Invariant:** Approved leave (annual leave, sick leave, RDOs) is strictly classified as absence and does **not** increment refusal counts.

### 3.4 P1-4 & P1-5 Fail-Closed Safety Dependencies
1. **Fatigue Engine Availability:** If `HortOpsFatigueEngine.simulateAssignmentFatigue` is missing, throws an exception, or returns a non-object/malformed return, candidate is hard-blocked with reason `FATIGUE_ENGINE_UNAVAILABLE` and `hardBlock: true`.
2. **Absence Engine Availability:** If `HortOpsAbsences.isStaffAbsentOnDate` is missing, throws an exception, or returns a non-object return, candidate is hard-blocked with reason `ABSENCE_ENGINE_UNAVAILABLE` and `hardBlock: true`.
3. **Valid Empty Ledger Allowed:** Existing workspaces with genuine empty absence arrays (`absences: []`) operate normally without blocking.

### 3.5 P1-6 Operational Absence & Refusal Management UI
1. **Interactive Modal Component:** Created [js/components/staffAbsenceModal.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffAbsenceModal.js) featuring:
   - Dedicated tabs for **Planned & Unplanned Leave** and **Overtime Refusal History**.
   - Input forms for adding absence intervals across all municipal categories (`annual_leave`, `sick_leave`, `rdo`, `long_service`, `training`, `bereavement`) with Gregorian date validation (`isRealYmd`).
   - Live shift conflict warnings highlighting overlapping scheduled shifts via `findShiftConflicts`.
   - Refusal event logging with immediate feedback on the officer's fair-share priority score.
   - Transactional persistence via `saveAbsenceAndRefusalData`.
2. **Registry Integration:** Embedded a `Leave` button in the Actions column of [js/components/staffRegistry.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffRegistry.js).
3. **Modular & Single-File Parity:** Mounted `#staff-absence-modal-root` in `index.modular.html` and verified self-contained compilation into `index.html` and `dist/hort_ops_offline_planner.html`.

---

## 4. Verification Evidence & Summary

- **Contract Suite:** `scripts/test_stage3_absence_persistence_contract.cjs` (Gate 3F) added to permanent test suite inventory.
- **Stage 3 Acceptance:** 6/6 gates passed cleanly (100%).
- **Master Release Gates:** 24/24 suites passed cleanly (100%).
- **Review 55 Adversarial Probes:** 0 departures.
- **Review 56 Defect Probes:** 0 departures.

Candidate PR26 is completely resolved, non-regressive, and staged for Review 57.
