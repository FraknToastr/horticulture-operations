# Independent Review 59 Finding Dispositions (PR26_03)

**Assessment Target:** Candidate `PR26_03` — Stage 3 Refusal & Absence Ledger Hardening  
**Authority:** Stage 3 is authorised and active. Stage 4 is **strictly not authorised**.  
**Date:** 2026-10-04 (Adelaide)  
**Baseline Result:** Review 59 Negative Probes (`REVIEW59_INDEPENDENT_NEGATIVE_PROBES.cjs`): **7/7 PASS (100% OK)**  
**Historical Continuity:** Review 58: **5/5 PASS**, Review 57: **7/7 PASS**, Review 55: **0 departures**, Review 56: **5/5 PASS**, Stage 3 Master Gates: **6/6 PASS**, Playwright Browser Smoke: **7/7 PASS**, Release Gates: **24/24 PASS**.

---

## Executive Summary Matrix

| Finding ID | Priority | Description | Disposition | Remediation Summary |
|---|---|---|---|---|
| **R59-P0-01** (Gate A) | **P0** | Undeclared final-absence deletion automatically authorised | **CLOSED** | Deleted legacy backward-compatibility fallback in [saveAbsenceAndRefusalData](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/app.js#L1074-L1110) (`js/app.js`). Undeclared deletions fail closed. Modernized test harness fixtures to pass explicit `{ deletedAbsenceIds: ['...'], deletedRefusalIds: [] }`. Verified with `R59-P0-A` (blocked, 0 writes) and `R59-BASELINE` (explicit removal succeeds). |
| **R59-P1-02** (Gate B) | **P1** | Canonical validator accepts undated and impossible Gregorian dates | **CLOSED** | Wired `!rh.date || typeof rh.date !== 'string' || !this.isRealYmd(rh.date)` into canonical schema validator [validateWorkspaceSchema](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/storage/schemaValidator.js#L479-L505) (`schemaValidator.js`). Gated all storage saves, envelopes, imports, and boundaries. Corrected typo `YYYY-MM-DDi-` in [validateRefusalRecord](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/absences.js#L58-L72) (`absences.js`). Verified with `R59-P1-B` (2 probes pass). |
| **R59-P1-03** (Gate B) | **P1** | Duplicate refusal IDs admissible at authoritative schema boundary | **CLOSED** | Added `seenRefusalIds = new Set()` in [schemaValidator.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/storage/schemaValidator.js#L479-L505) (`validateWorkspaceSchema`). Rejects duplicate refusal IDs authoritatively at the schema boundary, preventing corrupted storage envelopes, imports, or restores. Verified with `R59-P1-C` (pass). |
| **R59-P1-04** (Gate C) | **P1** | Identity guard fails to detect concurrent modification of an unchanged ID | **CLOSED** | Captured baseline ledgers (`this.baseAbsences`, `this.baseRefusals`) on modal `open()`. Forwarded to [_commitCanonicalProposal](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/app.js#L341-L430). In storage commit, compare latest verified committed records to baseline; reject concurrent modification attempts on changed records with `{ success: false, error: 'Stale edit conflict: ...' }` without mutating storage or runtime state. Verified with `R59-P1-D` (pass; storage untouched). |
| **R59-P2-05** (Gate D) | **P2** | Missing `asOfDate` applies cross-year / lifetime refusal bonuses | **CLOSED** | Enforced strict fail-closed contract in [getStaffRefusalCount](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/absences.js#L170-L215) (`absences.js`): require `if (!asOfDate || typeof asOfDate !== 'string' || !isRealYmd(asOfDate)) return 0;`. Missing or malformed decision date context yields zero refusal bonus. Verified with `R59-P2-E` (pass; undefined asOfDate returns 0). |

---

## Detailed Finding Dispositions

### 1. Finding R59-P0-01 (Gate A — P0): Undeclared Single-Absence Deletion Fallback

#### Root Cause
In `js/app.js:1083–1093`, `saveAbsenceAndRefusalData()` had a fallback originally added as a compatibility bridge for an older test fixture. The fallback automatically populated `authAbs = [this.state.absences[0].id]` whenever `updatedAbsences = []`, `this.state.absences.length === 1`, and `updatedRefusals.length > 0`. This allowed callers with no explicit deletion options to delete a single remaining absence as long as refusals were retained, bypassing the strict deletion allowlist guard.

#### Remediation Applied
1. Completely removed lines 1083–1093 from [saveAbsenceAndRefusalData](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/app.js#L1074-L1110) in `js/app.js`. No implicit authority is granted. Only explicit IDs in `options.deletedAbsenceIds` are authorized.
2. Modernized test harness fixtures (`review57_independent_regressions.cjs:61` and `scripts/test_stage3_absence_persistence_contract.cjs:395`) to declare explicit removal intent:
   `saveAbsenceAndRefusalData([], stored.refusalHistory, { deletedAbsenceIds: ['absence-1'], deletedRefusalIds: [] })`.
3. Verified via Review 59 independent probes:
   - `R59-P0-A`: `app.saveAbsenceAndRefusalData([], refusalHistory)` without options returns `{ success: false }`, committed storage retains absence, and storage writes remain 0 (**PASS**).
   - `R59-BASELINE`: `app.saveAbsenceAndRefusalData([], refusalHistory, { deletedAbsenceIds: ['A1'], deletedRefusalIds: [] })` succeeds and cleanly removes the absence (**PASS**).

---

### 2. Finding R59-P1-02 (Gate B — P1): Canonical Refusal Date & Gregorian Validation

#### Root Cause
While `absences.js` contained logic to validate dates during fair-share scoring, the canonical Schema v2 workspace validator in `js/utils/storage/schemaValidator.js` only checked for string `id` and `staffId`. It did not check for `date` presence or Gregorian date validity, allowing records with missing dates or impossible calendar dates (such as `2026-02-30`) to pass schema validation and enter committed storage. Additionally, `js/utils/absences.js:69` had a malformed error message typo (`YYYY-MM-DDi-`).

#### Remediation Applied
1. Updated [validateWorkspaceSchema](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/storage/schemaValidator.js#L479-L505) in `schemaValidator.js`:
   ```javascript
   if (!rh.date || typeof rh.date !== 'string' || !this.isRealYmd(rh.date)) {
     return { valid: false, error: 'Refusal history entry at index ' + rhIdx + ' missing or invalid date (must be YYYY-MM-DD).' };
   }
   ```
   This gates `validateWorkspaceSchema`, `validateCurrentV2ForBoundary`, `createWorkspaceEnvelope`, `saveWorkspace`, `importWorkspaceJson`, and storage recovery.
2. Corrected typo in [validateRefusalRecord](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/absences.js#L58-L72) (`js/utils/absences.js` line 69) to `(must be YYYY-MM-DD).`.
3. Verified via Review 59 independent probes:
   - `R59-P1-B missing refusal date rejected by canonical schema` (**PASS**).
   - `R59-P1-B invalid refusal date rejected by canonical schema` (`2026-02-30`) (**PASS**).

---

### 3. Finding R59-P1-03 (Gate B — P1): Authoritative Duplicate Refusal ID Protection

#### Root Cause
`schemaValidator.js` did not maintain identity uniqueness across `refusalHistory` elements. While the application commit guard checked for duplicates in runtime proposals, workspaces loaded from external backup imports, migration boundaries, or direct storage envelopes could contain duplicate refusal IDs without triggering a validation error.

#### Remediation Applied
1. Added `seenRefusalIds = new Set()` in [schemaValidator.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/storage/schemaValidator.js#L479-L505) within `validateWorkspaceSchema`.
2. Any duplicate refusal identity encountered during schema inspection immediately returns `{ valid: false, error: 'Refusal history entry at index ' + rhIdx + ' duplicate id "' + rh.id + '".' }`.
3. Gated all storage drivers, import modals, and boundary wrappers through this authoritative schema check.
4. Verified via Review 59 probe `R59-P1-C duplicate refusal identifiers rejected by canonical schema` (**PASS**).

---

### 4. Finding R59-P1-04 (Gate C — P1): Stale Modal Edit Protection

#### Root Cause
When the modal opened, it cloned working ledgers. If another tab or concurrent operation modified and committed changes to a record under the same ID, the modal saving its old cloned record would overwrite the newly committed revision, because the previous guard checked only whether IDs were dropped, not whether their contents had changed.

#### Remediation Applied
1. In [staffAbsenceModal.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/components/staffAbsenceModal.js#L30-L55):
   - On `open(staffId)`, capture verified baseline ledgers:
     `this.baseAbsences = JSON.parse(JSON.stringify(state.absences || []));`
     `this.baseRefusals = JSON.parse(JSON.stringify(state.refusalHistory || []));`
   - On `close()`, reset base references to null.
   - On `save()`, forward `{ baseAbsences: this.baseAbsences, baseRefusals: this.baseRefusals, ... }` in options to `saveAbsenceAndRefusalData`.
2. In [js/app.js](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/app.js#L341-L430) `_commitCanonicalProposal`:
   - Extracted baseline records (`baseAbs`, `baseRef`) from proposal or current state.
   - For every record in `proposedAbsences` and `proposedRefusals`:
     Check if the record exists in latest verified committed storage (`commRec`) and in baseline (`baseRec`).
     If `JSON.stringify(commRec) !== JSON.stringify(baseRec)` (committed version modified since baseline) AND `JSON.stringify(proposedRec) !== JSON.stringify(commRec)` (proposed record attempts to overwrite the committed revision):
     Fail closed immediately with `{ success: false, error: 'Stale edit conflict: ...' }` and storage status `'save_failed'`, preventing any storage mutation or in-memory state degradation.
3. Verified via Review 59 probe `R59-P1-D stale modal edit cannot silently overwrite more recently committed record with same ID` (**PASS**; committed revision untouched, storage writes=0).

---

### 5. Finding R59-P2-05 (Gate D — P2): Date-Bounded Refusal Scoring

#### Root Cause
In `js/utils/absences.js:getStaffRefusalCount`, the date check `if (asOfDate) { ... }` was only applied when `asOfDate` was truthy. When called without an `asOfDate` (or with `undefined`), all records with valid dates—including out-of-scope past years (2025) and future years (2027)—were counted, awarding unbounded lifetime refusal bonuses.

#### Remediation Applied
1. In [getStaffRefusalCount](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner/js/utils/absences.js#L170-L215) (`absences.js`):
   Enforced strict fail-closed requirement:
   ```javascript
   if (!asOfDate || typeof asOfDate !== 'string' || !isRealYmd(asOfDate)) {
     return 0;
   }
   ```
2. Any call lacking a valid Gregorian decision date context fails closed and returns 0. No silent substitution of `new Date()` is performed; lifetime bonuses without temporal bounds are eliminated.
3. Call sites in `candidateModel.js` and `engine.js` supply the shift date context; test fixtures updated to pass explicit shift date bounds.
4. Verified via Review 59 probe `R59-P2-E missing as-of date does not apply lifetime refusal bonuses` (**PASS**; returns 0).

---

## Complete Verification Evidence

```bash
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
# Output: 0 observable departures from stated conservative safety expectations (exit 0)

# Review 56 Resolved Probes
node test_review56_resolved.cjs
# Output: ALL 5 REVIEW 56 DEFECT PROBES VERIFIED RESOLVED (100% OK) (exit 0)

# Stage 3 Master Gates
node scripts/run_all_stage3_gates.cjs
# Output: TOTAL: 6 PASSED, 0 FAILED (of 6 gates) (exit 0)

# Single File Build Parity
node scripts/build_single_file.cjs
sha256sum index.html dist/hort_ops_offline_planner.html
# Output: Both match SHA256: d7e8cd10976149d2d3b9babbc5f4f4f79ee803c4110dea17bdc1e7da65bf0adf

# Playwright Browser Smoke Test
NODE_PATH=/usr/local/lib/node_modules node scripts/test_stage3_browser_smoke.cjs
# Output: ALL 7 STAGE 3 BROWSER VERIFICATION CHECKS PASSED (100% OK) (exit 0)
```
