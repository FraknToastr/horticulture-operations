# Independent Review 60 Finding Dispositions (PR26_04)

**Assessment Target:** Candidate `PR26_04` — Stage 3 Refusal & Absence Ledger Hardening  
**Authority:** Stage 3 is authorised and active. Stage 4 is **strictly not authorised**.  
**Date:** 2026-10-04 (Adelaide)  
**Baseline Result:** Review 60 Negative Probes (`REVIEW60_INDEPENDENT_NEGATIVE_PROBES.cjs`): **8/8 PASS (100% OK)**  
**Historical Continuity:** Review 59: **7/7 PASS**, Review 58: **5/5 PASS**, Review 57: **7/7 PASS**, Review 55: **0 departures**, Review 56: **5/5 PASS**, Stage 3 Master Gates: **6/6 PASS**, Playwright Browser Smoke: **7/7 PASS**, Release Gates: **24/24 PASS**.

---

## Executive Summary Matrix

| Finding ID | Priority | Description | Disposition | Remediation Summary |
|---|---|---|---|---|
| **R60-P0-01** | **P0** | Explicit `null` ledger values accepted throughout authoritative chain | **CLOSED** | Hardened `js/app.js` (`saveAbsenceAndRefusalData`, `_commitCanonicalProposal`), `schemaValidator.js` (`validateWorkspaceSchema`, `validateCurrentV2Presence`), `migrationEngine.js` (`createWorkspaceEnvelope`), and `storage.js` (`saveWorkspace`). Explicit `null` on `absences` or `refusalHistory` is strictly rejected before envelope creation, storage write, or state mutation. Zero writes occur. Verified with Probes `R60-03`, `R60-04`, `R60-05`, `R60-06` (**all PASS**). |
| **R60-P1-02** | **P1-high** | Stale destructive edits bypass optimistic concurrency checks | **CLOSED** | In [js/app.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/app.js#L360-L460) `_commitCanonicalProposal`, every identity disappearing from a proposed ledger is checked against the original modal baseline. If the committed record in storage changed since baseline (or was not in baseline), explicit deletion is rejected with `{ success: false, error: 'Stale deletion conflict: ...' }` without mutating storage or live state. Verified with Probes `R60-01`, `R60-02` (stale deletions rejected; 0 writes) and `R60-CONTROL` (unchanged deletion succeeds) (**all PASS**). |
| **R60-P1-03** | **P1** | Authoritative schema accepts duplicate absence identities | **CLOSED** | Added `seenAbsenceIds = new Set()` in [schemaValidator.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/storage/schemaValidator.js#L445-L485) (`validateWorkspaceSchema`). Gated `validateWorkspaceSchema`, `validateCurrentV2ForBoundary`, `createWorkspaceEnvelope`, `saveWorkspace`, and backup import. Rejects duplicate absence IDs regardless of staff/type/date. Verified with Probe `R60-07` (**PASS**). |

---

## Detailed Finding Dispositions

### 1. Finding R60-P0-01 (P0): Explicit Null Ledger Values Rejected Throughout Authoritative Chain

#### Root Cause
In `js/app.js:261–267`, type checking only failed when values were neither `undefined` nor `null` (`proposedAbsences !== null`). In `js/utils/storage/schemaValidator.js:447` and `478`, schema validation checked `parsed.absences !== null`, thereby skipping validation when `null` was explicitly supplied. Consequently, an explicit `null` payload would bypass existing ID checks, reach canonical envelope construction, and overwrite protected committed ledgers with `null`.

#### Remediation Applied
1. In [js/app.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/app.js):
   - In `saveAbsenceAndRefusalData`:
     ```javascript
     if (updatedAbsences !== undefined && (updatedAbsences === null || !Array.isArray(updatedAbsences))) {
       return { success: false, error: 'Invalid absences ledger: must be an array, null is not permitted' };
     }
     if (updatedRefusals !== undefined && (updatedRefusals === null || !Array.isArray(updatedRefusals))) {
       return { success: false, error: 'Invalid refusalHistory ledger: must be an array, null is not permitted' };
     }
     ```
   - In `_commitCanonicalProposal`:
     ```javascript
     if (proposedAbsences !== undefined && (proposedAbsences === null || !Array.isArray(proposedAbsences))) {
       if (this.state) this.state.storageStatus = 'save_failed';
       return { success: false, error: 'Invalid "absences" property: must be an array, null is not permitted' };
     }
     if (proposedRefusals !== undefined && (proposedRefusals === null || !Array.isArray(proposedRefusals))) {
       if (this.state) this.state.storageStatus = 'save_failed';
       return { success: false, error: 'Invalid "refusalHistory" property: must be an array, null is not permitted' };
     }
     ```
2. In [js/utils/storage/schemaValidator.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/storage/schemaValidator.js):
   - In `validateCurrentV2Presence`:
     ```javascript
     if (own.call(input, 'absences') && (input.absences === null || !Array.isArray(input.absences))) {
       return { valid: false, error: 'Invalid current-v2 field: absences: expected array, null is not permitted' };
     }
     if (own.call(input, 'refusalHistory') && (input.refusalHistory === null || !Array.isArray(input.refusalHistory))) {
       return { valid: false, error: 'Invalid current-v2 field: refusalHistory: expected array, null is not permitted' };
     }
     ```
   - In `validateWorkspaceSchema`:
     ```javascript
     if (Object.prototype.hasOwnProperty.call(parsed, 'absences') || parsed.absences !== undefined) {
       if (parsed.absences === null || !Array.isArray(parsed.absences)) {
         return { valid: false, error: 'Invalid "absences" property: must be an array.' };
       }
       ...
     }
     if (Object.prototype.hasOwnProperty.call(parsed, 'refusalHistory') || parsed.refusalHistory !== undefined) {
       if (parsed.refusalHistory === null || !Array.isArray(parsed.refusalHistory)) {
         return { valid: false, error: 'Invalid "refusalHistory" property: must be an array.' };
       }
       ...
     }
     ```
3. In [js/utils/storage/migrationEngine.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/storage/migrationEngine.js) (`createWorkspaceEnvelope`):
   Explicit `null` on `absences` or `refusalHistory` throws an error before constructing any candidate envelope.
4. **Evidence:**
   - `R60-03` (`Null absences rejected at canonical schema boundary`): **PASS**
   - `R60-04` (`Null refusalHistory rejected at canonical schema boundary`): **PASS**
   - `R60-05` (`Null absences cannot replace protected committed ledger`): **PASS** (0 writes, committed ledger unchanged)
   - `R60-06` (`Null refusalHistory cannot replace protected committed ledger`): **PASS** (0 writes, committed ledger unchanged)

---

### 2. Finding R60-P1-02 (P1-high): Stale Destructive Deletions Validated Against Baseline

#### Root Cause
In PR26_03, optimistic concurrency comparisons compared records present in proposed arrays against baseline records. However, when a record was deliberately removed by the modal for deletion, it was omitted from the proposed array (`seenAbsIds.has(id)` was false). The identity-loss guard recognized its ID in `authorisedAbsenceDeletions` and allowed the deletion without verifying if the committed record in storage had been concurrently revised since the modal opened.

#### Remediation Applied
In [js/app.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/app.js) `_commitCanonicalProposal`:
For every identity disappearing from a proposed ledger (`prevAbsId && !seenAbsIds.has(prevAbsId)` / `prevRefId && !seenRefIds.has(prevRefId)`):
1. First verify explicit deletion authorization (`isAbsAuth` / `isRefAuth`).
2. When authorized (and not a restore/reset operation), compare the committed record against the modal baseline (`baseAbs` / `baseRef`):
   - If the ID does not exist in baseline (`!baseAbsRec`), it was created concurrently; deletion is rejected.
   - If `JSON.stringify(commAbsRec) !== JSON.stringify(baseAbsRec)`, the committed record was modified concurrently; deletion is rejected with:
     `{ success: false, error: 'Stale deletion conflict: record has been modified concurrently' }`
   - Same check applied to `refusalHistory`.
3. In `staffAbsenceModal.js`, if `saveAbsenceAndRefusalData` fails, `showError()` displays the message and returns without closing the modal or modifying local state.
4. **Evidence:**
   - `R60-01` (`Explicit deletion of concurrently modified absence is rejected`): **PASS** (stale removal rejected, notes preserved, 0 writes).
   - `R60-02` (`Explicit deletion of concurrently modified refusal is rejected`): **PASS** (stale refusal removal rejected, reason preserved, 0 writes).
   - `R60-CONTROL` (`Explicit deletion of unchanged absence remains operational`): **PASS** (deletion of unmodified record succeeds, 1 write).

---

### 3. Finding R60-P1-03 (P1): Rejection of Duplicate Absence IDs in Canonical Schema v2

#### Root Cause
In `js/utils/storage/schemaValidator.js`, `refusalHistory` was updated in Review 59 with `seenRefusalIds = new Set()`, but `absences` lacked a duplicate identity check. While runtime proposals checked duplicates in `app.js`, canonical envelopes constructed directly, imported from backup, or restored could contain duplicate absence identities.

#### Remediation Applied
1. Added `seenAbsenceIds = new Set()` in [schemaValidator.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/storage/schemaValidator.js#L445-L485) within `validateWorkspaceSchema`.
2. Any duplicate absence ID immediately fails validation with `{ valid: false, error: 'Absence entry at index ' + aIdx + ' duplicate id "' + ab.id + '".' }`.
3. Covers all canonical boundary validation, envelope creation, direct saves, and backup imports without silently dropping or altering records.
4. **Evidence:**
   - `R60-07` (`Duplicate absence IDs rejected at canonical boundary`): **PASS**.

---

## Complete Verification Evidence

```bash
# Review 60 Negative Probes
HORTOPS_ROOT="$PWD" node REVIEW60_INDEPENDENT_NEGATIVE_PROBES.cjs
# Output: REVIEW60 RESULTS: 8 PASS, 0 FAIL; 8 TOTAL (exit 0)

# Review 59 Negative Probes
HORTOPS_ROOT="$PWD" node REVIEW59_INDEPENDENT_NEGATIVE_PROBES.cjs
# Output: REVIEW59 RESULTS: 7 PASS, 0 FAIL, TOTAL 7 (exit 0)

# Review 58 Negative Probes
node REVIEW58_INDEPENDENT_NEGATIVE_PROBES.cjs
# Output: 5/5 PASSED (100% OK) (exit 0)

# Review 57 Regressions
node review57_independent_regressions.cjs
# Output: 7 passed, 0 failed, 7 assertions (exit 0)

# Review 55 Adversarial Probes
node review55_adversarial_probes.cjs
# Output: 0 observable departures (exit 0)

# Review 56 Resolved Probes
node test_review56_resolved.cjs
# Output: ALL 5 REVIEW 56 DEFECT PROBES VERIFIED RESOLVED (100% OK) (exit 0)

# Stage 3 Master Gates
node scripts/run_all_stage3_gates.cjs
# Output: TOTAL: 6 PASSED, 0 FAILED (of 6 gates) (exit 0)

# Single File Parity
node scripts/build_single_file.cjs
sha256sum index.html dist/hort_ops_offline_planner.html
# Output: Both match SHA-256: 78060f36d0abf6447b06a63b62009045b3e146a75d086bc41b6c2d488fa01302

# Playwright Browser Smoke Test
NODE_PATH=/usr/local/lib/node_modules node scripts/test_stage3_browser_smoke.cjs
# Output: ALL 7 STAGE 3 BROWSER VERIFICATION CHECKS PASSED (100% OK) (exit 0)
```
