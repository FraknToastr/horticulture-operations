# Stage 1 — Maintained Governance & Peer-Review Continuity Guide

**Status:** Gate A **ACCEPTED** (Review 12); Gate B1 **ACCEPTED** (Review 17); Gate B2 **ACCEPTED** (Review 20); Gate B3 **ACCEPTED** (Review 21); **Gate C (Prototype Staff Data Isolation & Clean-Slate Verification) AUTHORISED FOR IMPLEMENTATION (In Progress).** Gate D / Stage 2 / Stage 3 **not authorised to start**.  
**Stop condition:** Implement Gate C (isolate prototype staff dataset, verify zero-storage cold start, deprecate obsolete v1 code) and submit incremental package `HortOps-Stage1-GateC-PR21.zip` for Independent Peer Review 22.

> **This is the sole maintained resume guide.** `RESUME_WORK_INSTRUCTIONS.md` only redirects here. For the active Gate B3 review contract, use `GEMINI_STAGE1_GATE_B3_PR19_FULL_REVIEW_EXECUTION_PROMPT.md` and `Offline2-overtime-planner-support/peer reviews/HortOps_Stage1_PR19_Full_Independent_Peer_Review.md`. Preserve the original guide verbatim under `historical/`.

## 1. Current authority and accepted sequencing

The governing reset directive (C1–C10) and frozen existing rostering invariants continue to strictly govern all development. Reviews 06/07 conditionally endorsed the **A → B → C → D** gate sequence, amended to place Gate B before Gate C.

- **Gate A:** **ACCEPTED** (Independent Review 12, PR11 SHA-256: `bb8ca019d8dd6ac98fdf72529717c61bfa068929e38123b2724eb556302a24cb`). Canonical Schema v2 storage baseline, zero-loss retention checks, defensive-copy isolation, fail-closed unreadable storage.
- **Gate B1:** **ACCEPTED** (Independent Review 17, PR16 SHA-256: `ba5f9d223c32bbf3956ca13ebb1ced4ed8ca242bd2fde9fd685fd181c9d8edce`). Canonical `assignments` vs runtime `customAssignments` boundary, constructor-level alias rejection, fail-closed v1 migration.
- **Gate B2:** **ACCEPTED** (Independent Review 20, PR19 SHA-256: `796177ccc5f18c40992e6253b4c313a80f7327d2c3e1b1d69126906f8653947d`). Authoritative scheduled-commitment ownership, pure delta planner (`commitmentPlanner.js`), strict cumulative descendant removal proof, mandatory caller-injected `todayKey`, pure input non-mutation.
- **Gate B3:** **ACCEPTED** (Independent Review 21, PR20 SHA-256: `24981a4806185f398ce49e441836dd19122abd1d993b3019d8e6e0f13d5d3fec`). Full transaction hardening across mid-tier mutation methods (`updatePermit`, `saveJob`, `deleteJob`, `updateStaffMember`, `reconcileStaffSnapshot`, `importStaffMembers`); stage-before-commit atomicity via `_commitCanonicalProposal`; snapshot evidence loss prevention in Job deletion (FR-01); canonical restore live replacement and optional domain defaults (FR-04); UI modal caller contract propagation; detached input cloning preventing caller mutation pollution.
- **Gate C:** **AUTHORISED (In Progress).** Scope: Prototype staff data isolation (`staffRoster.js`), clean-slate zero-storage cold-start verification, reviewed obsolete v1 code removal.

- **Gate D:** **PLANNED.** Final integrated release verification and acceptance. Explicit registered release blockers for pre-Gate D: FR-02 (schedule precision & interval validation) and FR-03 (timezone/DST 10-hour rest validation).

Stage 2 owns user-facing workspace reset and browser-storage wipe. Stage 3 owns interconnected Job/Workforce Registry and smart auto-rostering. Stage 4 owns standalone targeted UI refinement. Future extension concepts remain design-only.

## 2. Confirmed stale instructions — never execute

| Superseded instruction | Current rule |
|---|---|
| Execute Gate A prompts or architecture audit rewrites | Gate A is formally **ACCEPTED** (Review 12). Do not re-execute or modify accepted Gate A contracts. |
| Execute Gate B1 / Gate B2 prompts | Gate B1 (Review 17) and Gate B2 (Review 20) are formally **ACCEPTED**. |
| Purge prototype staff data or legacy code during B3 | Gate C owns legacy code and seeded data removal. Do NOT delete prototype data or legacy keys in Gate B3. |
| Touch test-14 incomplete constructor fixture in B3 | Gate D owns test-14 cleanup. |
| Implement FR-02 or FR-03 in Gate B3 | Explicit release blockers registered for pre-Gate D; out of scope for Gate B3. |
| `historicalSnapshots: this.state.historicalSnapshots || {}` | No silent evidence substitution. A deliberately empty new workspace must initialise explicitly; missing/malformed evidence in an established workspace must fail closed. |
| Call `app.loadWorkspace()` in the integration test | This method did **not** exist in the inspected source. Use `HortOpsApp.init()` → `HortOpsStorage.loadWorkspace(...)`. |
| Produce unversioned or overwritten ZIP packages | Produce uniquely named incremental packages (`HortOps-Stage1-GateB3-PR20.zip`). Preserve all prior review evidence. |

## 3. Exact next-session protocol (Handoff for Review 21)

When resuming or evaluating the session:
1. Verify baseline status: Gate A, Gate B1, and Gate B2 are formally ACCEPTED; Gate B3 PR20 implements the complete transaction hardening, snapshot evidence protection, and canonical restore equivalence.
2. Verify all verification suites pass:
   ```bash
   cd /home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner
   node scripts/test_gate_b3.cjs                             # 18/18 PASS [100%]
   node scripts/HortOps_PR19_Independent_Synthetic_Probes.cjs # FR-01, FR-04, FR-05 resolved; 0 regressions
   node scripts/test_gate_b2.cjs                             # 100% PASS (Scenarios 1-6 + R18/R19 suites)
   node scripts/test_gate_b1.cjs                             # 100% PASS (Assertions 1-11)
   node scripts/test_normal_save_snapshots.cjs               # 100% PASS (Groups 1-3)
   node scripts/test_persistence.cjs                         # 100% PASS (Sections 1-31)
   node scripts/test_recovery_ui.cjs                         # 100% PASS
   node scripts/test_static_release.cjs                      # 100% PASS (45/45 JS files syntax audit)
   sha256sum index.html dist/hort_ops_offline_planner.html    # Identical SHA-256 hashes
   ```
3. Verify that `js/app.js` contains the canonical proposal transaction pipeline:
   - Centralised helper `_commitCanonicalProposal(proposalOverrides)` validating Schema v2 presence, reading committed storage baseline, enforcing anti-evidence-loss checks, constructing canonical Schema v2 envelope, and saving once before live state adoption.
   - `updatePermit(shiftKey, overrides)` stages detached permits clone, commits proposal, and adopts only on verified success; returns `{ success, error }`.
   - `reconcileStaffSnapshot()` and `importStaffMembers()` commit proposed roster and assignments atomically; departed staff with scheduled commitments are preserved rather than silently dropped.
   - `updateStaffMember()` rejects staff ID mutation, stages detached roster clone, commits proposal, and isolates caller mutation.
   - `saveJob()` clones caller input, stages detached jobs array and sealed rostering instructions (if retiring), commits proposal, and rolls back on failure; returns `{ success, error }`.
   - `getJobDependencies()` includes `state.historicalSnapshots` count (FR-01), preventing hard-deletion of history-only jobs and retiring them to inactive.
   - `deleteJob()` delegates history-dependent jobs to retirement and hard-deletes unencumbered jobs via `_commitCanonicalProposal`, rolling back on storage failure.
   - `restoreWorkspaceJson()` performs full detached live replacement, resetting omitted optional domains (`budgetSettings`, `uiState`) to canonical defaults (FR-04) and rolling back on invalid JSON.
4. Verify UI callers handle transaction return contract:
   - `staffAssignModal.js` checks `updatePermit` return status.
   - `staffExemptionModal.js` checks `updateStaffMember` return status.
   - `importModal.js` checks `confirmSync` return status.
5. Submit package `HortOps-Stage1-GateB3-PR20.zip` for **Independent Peer Review 21**.
6. **Mandatory Stop:** Do not proceed to Gate C, Gate D, or Stage 2 without formal Review 21 acceptance.

## 4. Evidence and claims

- "Developer-reported PASS," "Independently reproduced PASS," and "Accepted" are distinct statuses governed by `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`.
- PR20 fixes all B3-01 through B3-14 criteria, resolves FR-01, FR-04, and FR-05, and registers FR-02 and FR-03 as pre-Gate D release blockers.
- Both standalone HTML files match byte-for-byte with identical SHA-256 hashes.

## 5. Review and packaging standard

The independent reviewer examines changed source, root causes, input boundaries, and failure contracts. Gemini supplies only modified/necessary files and runs proportionate tests.
Package contents:
- `js/app.js`
- `js/components/staffAssignModal.js`
- `js/components/staffExemptionModal.js`
- `js/components/importModal.js`
- `scripts/test_gate_b3.cjs`
- `scripts/HortOps_PR19_Independent_Synthetic_Probes.cjs`
- `index.html`
- `dist/hort_ops_offline_planner.html`
- `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md`
- `STAGE1_GATE_A_PEER_REVIEW_CONTINUITY.md`
- `GATE_B3_CHANGE_AND_EVIDENCE_REPORT.md`
- `HANDOFF_GATE_B3_PR20.md`
- `MANIFEST.sha256.txt`

## Review 20 Adjudication Summary (Gate B2 Acceptance)
- **Review Package:** `HortOps-Stage1-GateB2-Closure-PR19.zip`
- **Independent Finding:** Gate A and B1 remain ACCEPTED. Gate B2 accepted via `HortOps_Stage1_PR19_Full_Independent_Peer_Review.md`. All 8/8 direct exported-planner boundary scenarios pass.
- **Accepted PR19 Artifact SHA-256:** `796177ccc5f18c40992e6253b4c313a80f7327d2c3e1b1d69126906f8653947d`.
- **Surviving Defects / Gate B3 & Pre-Gate D Scope:**
  - FR-01: Job deletion snapshot dependency protection (resolved in B3).
  - FR-02: Date and recurrence interval validation (pre-Gate D release blocker).
  - FR-03: Timezone/DST 10-hour rest validation (pre-Gate D release blocker).
  - FR-04: Workspace restore omitted domain defaults (resolved in B3).
  - FR-05: Permit save transaction rollback (resolved in B3).
- **Explicit Authorisation:** Gate B3 implementation authorised.

### Peer Review 22 (Gate C Full Acceptance & Gate D Authorisation)
- **Review Identifier:** `STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_22.md`
- **Date:** 2026-09-28
- **Package Assessed:** `HortOps-Stage1-GateC-PR21.zip` (`f46dc8ac57f217efc292d0606d438db67f6067b03f83c4ac8197cb3b3ed8a08b`)
- **Outcome:** **ACCEPTED**. Gate C closed with zero prototype seeds in distribution, caller-isolated permits, reordered retirement notices, complete privacy clearance, and verified headless Playwright browser execution.
- **Authorisation:** Gate D authorised (`ST1-GATE-D-019`). Stage 2 and Stage 3 remain unauthorised.

### Peer Review 23 (Gate C Revised Evaluation — Rejection with Bounded Corrective Scope)
- **Review Identifier:** `STAGE1_GATE_C_PR21_REVISED_INDEPENDENT_PEER_REVIEW_23.md`
- **Date:** 2026-09-28
- **Governing Directives:** `GEMINI_GATE_C_FINAL_CORRECTIVE_PROMPT_REVIEW23.md`
- **Outcome:** **NOT ACCEPTED** (4 bounded causes: R23-01 tree hygiene/deletions, R23-02 production seed reads purge, R23-03 FR-04 restore canonical equivalence, R23-04 test sentinels de-identification, R23-05 governance synchronization). Gate D not yet authorised.

### Review 24 Submission (Gate C Final Corrective Submission)
- **Submission Package:** `HortOps-Stage1-GateC-PR21.zip`
- **Date:** 2026-09-28
- **Scope Delivered:**
  1. `R23-C1`: Machine-verifiable `DELETIONS.txt` and `scripts/verify_deletions.cjs` ensuring clean tree reproduction.
  2. `R23-C2`: Excision of all `window.HortOpsData` seed reads across production code (`app.js`, `storage.js`, `migrationEngine.js`, `scheduler/engine.js`).
  3. `R23-C3`: Standalone bundle byte equivalence (`5ec73836ea4a2502425cec531963c05bbf4d3e450bb5b8852c430f3a8cb372a8`) and zero-seed clean boot.
  4. `R23-B3`: FR-04 restore canonical normalization and persistence before adoption (`test_r23_restore_canonical.cjs` 100% PASS).
  5. `R23-P1`: De-identified structural synthetic test sentinels in `scripts/test_gate_c.cjs`.
  6. `R23-G1`: Synchronized transition register truthfully reflecting gate statuses.
- **Verification Evidence:** `REVIEW23_FOCUSED_PROBES.cjs` (5/5 PASS, 0 gaps), `test_gate_c.cjs` (7/7 PASS), `test_gate_b3.cjs` (18/18 PASS), `test_r23_restore_canonical.cjs` (PASS), `verify_deletions.cjs` (PASS).
- **Status:** **AWAITING INDEPENDENT ACCEPTANCE (Review 24 Evaluation)**. Gate D remains unauthorised.

### Peer Review 24 (Gate C Evaluation — Assessment Package Protocol v1.1)
- **Review Identifier:** `Review24_GateC_Protocol_v1.1_Assessment_Package`
- **Date:** 2026-09-28
- **Outcome:** **NOT ACCEPTED** (Findings: HORT-GC-R24-F01 Blocker privacy clearance across documentation, HORT-GC-R24-F02 High evidence overstatement, HORT-GC-R24-F03 Medium persistence element-zero assertion, HORT-GC-R24-F04 Medium stale historical fixtures, HORT-GC-R24-F05 Low browser smoke blocked in container).
- **Supplied Patch:** `REVIEWER_TEST_PATCH.zip` containing `review24_package_privacy_hygiene.cjs`, `review24_workspace_snapshot_scheduler_boundary.cjs`, `test_persistence.cjs`, and `run_all_release_gates.cjs`.

### Review 25 Submission (Gate C Corrective Resubmission)
- **Submission Packages:** `HortOps-Stage1-GateC-PR21.zip` (Incremental Delta) and `HortOps-Stage1-GateC-Full-PeerReview-PR21.zip` (Full Companion).
- **Date:** 2026-09-28
- **Scope Delivered:**
  1. `HORT-GC-R24-F01`: Full package privacy anonymisation; all 12 references replaced with `PERSONNEL_DUPLICATE_ASSIGNMENT_INVESTIGATION.md` and generic operative prose; `review24_package_privacy_hygiene.cjs` PASS (0 findings).
  2. `HORT-GC-R24-F03`: Integrated patched `test_persistence.cjs` asserting clean-slate empty arrays on invalid-v2 recovery (100% PASS).
  3. `HORT-GC-R24-F02`: Integrated complete-evidence `run_all_release_gates.cjs` and reconciled evidence reports distinguishing targeted green passes from stale fixtures, baseline failures, and blocked container browser evidence.
  4. `R24-T02`: Integrated `review24_workspace_snapshot_scheduler_boundary.cjs` (PASS).
- **Status:** **ACCEPTED FOR DEFINED SCOPE** (Independent Peer Review 26, 2026-09-28). Gate D remains unauthorised until formal initiation.

### Peer Review 25 (Gate C Evaluation — Universal Protocol v1.1)
- **Review Identifier:** `STAGE1_GATE_C_INDEPENDENT_PEER_REVIEW_25.md`
- **Date:** 2026-09-28
- **Outcome:** **NOT YET ACCEPTED — ONE EVIDENCE CORRECTION REMAINING** (Finding R25-F01: briefing row R23-REG blanket green claim contradicted by release runner output; privacy blocker and persistence assertions verified closed, zero production defects demonstrated).
- **Supplied Patch:** `REVIEW25_REVIEWER_TEST_PATCH` containing `scripts/review25_evidence_claim_consistency.cjs`.

### Review 26 Submission (Gate C Final Documentation Closure)
- **Submission Packages:** `HortOps-Stage1-GateC-PR21.zip` (Incremental Delta) and `HortOps-Stage1-GateC-Full-PeerReview-PR21.zip` (Full Companion).
- **Date:** 2026-09-28
- **Scope Delivered:**
  1. `R25-F01`: Reconciled briefing row R23-REG to accurately reflect targeted suites 100% PASS while release runner reports 5 passed, 3 failed (legacy fixtures), 1 blocked/deferred.
  2. Integrated and verified `scripts/review25_evidence_claim_consistency.cjs` (PASS).
  3. Re-verified `scripts/review24_package_privacy_hygiene.cjs` (PASS [0 findings]).
- **Status:** **AWAITING INDEPENDENT ACCEPTANCE (Review 26 Evaluation)**. Gate D remains unauthorised.
