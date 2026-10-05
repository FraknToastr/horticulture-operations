# Stage 1 Gate B2 — Change and Evidence Report (Review 19 Final Planner Contract Microclosure)

**Date:** 2026-09-25  
**Package:** `HortOps-Stage1-GateB2-PR19.zip`  
**Evaluation Scope:** Resolution of Review 19 Findings (`GEMINI_GATE_B2_FINAL_PLANNER_CONTRACT_PROMPT_REVIEW19.md`)  
**Baseline Artifact:** `HortOps-Stage1-GateB2-PR18.zip` (SHA-256: `649dadbd145097a4c5f88a7fe441d1e09183d3486a39986df697da4e7a244f73`)  
**Governance Ledger Amendment:** `ST1-GATE-B2-015`  
**Current Governance Status:** Gate A Accepted (Review 12); Gate B1 Accepted (Review 17); Gate B2 PR18 Reviewed / PR19 Corrective Delivery Complete; Awaiting Independent Peer Review 20. Gate B3 Deferred; Gate C / Stage 2 Unauthorized.

---

## 1. Executive Summary & Review 19 Context

Independent Peer Review 19 evaluated `HortOps-Stage1-GateB2-PR18.zip`. The review verified that PR18 successfully resolved all seven Review 18 findings in the actual modal and application runtime paths (`REVIEW18_FOCUSED_REPRO.cjs` 7/7 PASS), and confirmed that the existing regression battery passed 100%.

However, Review 19's direct trust-boundary probing of the publicly exported `commitmentPlanner.js` API (`REVIEW19_PLANNER_BOUNDARY_REPRO.cjs`) revealed three contract causes (resulting in an initial 6 failures across 8 boundary scenarios):
1. **Permissive `todayKey` Expression (`B2-R19-01`, P1):** In direct planner invocations lacking `input.todayKey`, `todayKey` silently resolved to `null`, disabling the conditional historical snapshot guard (`row.date < todayKey`) and permitting historical commitment removal.
2. **Optional & Contradictory Descendant Removal Branches (`B2-R19-02`, P1):** In `canAuthoriseFutureRemoval()`, missing `afterRostering.provenance` or `prunedProvenance` inputs permitted bypassing engine pruning checks. Furthermore, an internally contradictory record where `oldProv.sourceShiftId` did not match `operation.sourceShiftId` could succeed if the referenced instruction pointed to the edited source.
3. **Caller Operation Mutation (`B2-R19-03`, P3):** Setting `operation.todayKey = todayKey` in-place mutated the caller-owned `input.operation` object, violating functional purity.

All three findings have been resolved in **PR19** via a minimal, targeted ES5 update to `commitmentPlanner.js`, verified against both the unchanged reviewer-supplied discriminator (`REVIEW19_PLANNER_BOUNDARY_REPRO.cjs`: **8/8 PASS, 0 gaps**) and the full existing regression suite.

---

## 2. Review 19 Baseline Discriminator Verification

### 2.1 Submitted Baseline (PR18 Before Fixes)
Running `scripts/REVIEW19_PLANNER_BOUNDARY_REPRO.cjs` against the PR18 baseline yielded:
```
FAIL B19-01 missing injected local todayKey must fail closed, not remove past snapshot: {"ok":true,"removed":["JOB-R19@2020-01-04"]}
FAIL B19-02 malformed todayKey must fail closed even for otherwise permitted future removal: {"ok":true,"removed":["JOB-R19@2028-01-01"]}
FAIL B19-03 descendant removal requires afterRostering provenance proof: {"ok":true,"removed":["JOB-R19@2028-01-01"]}
FAIL B19-04 descendant removal requires actual engine-pruned provenance proof: {"ok":true,"removed":["JOB-R19@2028-01-01"]}
PASS B19-05 genuine future descendant removal with complete ownership proof remains allowed
FAIL B19-06 unrelated manual/another source provenance cannot authorize deletion
PASS B19-07 valid explicit current/future source unassignment remains allowed
FAIL B19-08 pure planner does not mutate caller-owned operation metadata: input.operation acquired hidden todayKey
REVIEW19 CONTRACT GAPS 6/8 (2 passed)
```

### 2.2 Corrected Verification (PR19)
Running `scripts/REVIEW19_PLANNER_BOUNDARY_REPRO.cjs` after applying the PR19 microclosure yields:
```
PASS B19-01 missing injected local todayKey must fail closed, not remove past snapshot
PASS B19-02 malformed todayKey must fail closed even for otherwise permitted future removal
PASS B19-03 descendant removal requires afterRostering provenance proof
PASS B19-04 descendant removal requires actual engine-pruned provenance proof
PASS B19-05 genuine future descendant removal with complete ownership proof remains allowed
PASS B19-06 unrelated manual/another source provenance cannot authorize deletion
PASS B19-07 valid explicit current/future source unassignment remains allowed
PASS B19-08 pure planner does not mutate caller-owned operation metadata
REVIEW19 CONTRACT GAPS 0/8 (8 passed)
```

### 2.3 Review 19 Discriminators Matrix

| Check ID | Focus / Invariant | PR18 Baseline | PR19 Corrected | Verification Detail |
| :--- | :--- | :--- | :--- | :--- |
| **B19-01** | Missing injected `todayKey` fails closed | FAIL | **PASS** | Valid caller-injected local date key required; fails closed without internal clock fallback. |
| **B19-02** | Malformed calendar date fails closed | FAIL | **PASS** | `resolveValidator().isRealYmd('2026-99-99')` returns false; planner returns `ok: false`. |
| **B19-03** | Missing `afterRostering` provenance rejected | FAIL | **PASS** | `afterRostering.provenance` must be a valid object map; returns `false`. |
| **B19-04** | Missing `prunedProvenance` array rejected | FAIL | **PASS** | `Array.isArray(prunedProvenance)` is mandatory; missing array returns `false`. |
| **B19-05** | Genuine future descendant removal allowed | PASS | **PASS** | Complete cumulative ownership and pruning proof authorises snapshot deletion. |
| **B19-06** | Contradictory / unrelated provenance rejected | FAIL | **PASS** | Both `oldProv.sourceShiftId` and `inst.sourceShiftId` must match `operation.sourceShiftId`. |
| **B19-07** | Explicit source unassignment preserved | PASS | **PASS** | Direct source unassignment remains permitted and date-guarded. |
| **B19-08** | Input operation non-mutation | FAIL | **PASS** | Caller's `input.operation` is copied via own-property enumeration; prior object strictly unmutated. |

---

## 3. Source Code Modifications & Semantic Diffs

### `js/utils/rostering/commitmentPlanner.js`

1. **Mandatory, Verified, Caller-Injected `todayKey`:**
```javascript
// Before (permissive null fallback):
var todayKey = input.todayKey || ((typeof window !== 'undefined' && window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
  ? window.HortOpsDateUtils.getLocalDateKey()
  : null);

// After (fail-closed canonical validation):
var validator = resolveValidator();
var todayKey = input.todayKey;
if (!validator || typeof validator.isRealYmd !== 'function' ||
    !validator.isRealYmd(todayKey)) {
  return fail('Valid caller-injected todayKey and canonical date validator are required.');
}
```

2. **Strict Cumulative Descendant Removal Proof:**
```javascript
// Before (optional maps and partial ownership checks):
if (!beforeRostering || !beforeRostering.provenance) return false;
...
if (oldProv.sourceShiftId && oldProv.sourceShiftId === operation.sourceShiftId) {
  isOwned = true;
} else if (oldProv.instructionId && ...) { ... }
...
if (prunedProvenance) { ... }

// After (mandatory map shapes, matching sourceShiftIds, mandatory engine pruning):
if (!isObject(beforeRostering) || !isObject(beforeRostering.provenance) ||
    !isObject(beforeRostering.instructions) || !isObject(afterRostering) ||
    !isObject(afterRostering.provenance) || !Array.isArray(prunedProvenance)) {
  return false;
}
...
var inst = (oldProv && oldProv.instructionId) ?
  beforeRostering.instructions[oldProv.instructionId] : null;
var isOwned = oldProv.source === 'rostering-rule' && !!inst &&
  oldProv.sourceShiftId === operation.sourceShiftId &&
  inst.sourceShiftId === operation.sourceShiftId;
if (!isOwned) return false;
if (own.call(afterRostering.provenance, pKey)) return false;
if (prunedProvenance.indexOf(pKey) === -1) return false;
```

3. **Pure Function Input Preservation:**
```javascript
// Before (in-place mutation):
var operation = input.operation || { type: 'allocation_reconciliation' };
if (todayKey && !operation.todayKey) {
  operation.todayKey = todayKey;
}

// After (ES5 own-property copy):
var operationInput = input.operation || { type: 'allocation_reconciliation' };
var operation = {};
for (var opKey in operationInput) {
  if (own.call(operationInput, opKey)) operation[opKey] = operationInput[opKey];
}
operation.todayKey = todayKey;
```

---

## 4. Full Verification Battery & Test Output

All commands executed in Ubuntu 24.04 WSL2 with Node.js v22.23.2:

```bash
cd /home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner

# 1. Independent Review 19 Repro Discriminator (8/8 PASS, 0 gaps)
node scripts/REVIEW19_PLANNER_BOUNDARY_REPRO.cjs

# 2. Independent Review 18 Repro Discriminator (7/7 PASS, 0 gaps)
node scripts/REVIEW18_FOCUSED_REPRO.cjs

# 3. Gate B2 Authoritative Commitment Lifecycle Suite (100% PASS across Scenarios 1-6, R18 & R19)
node scripts/test_gate_b2.cjs

# 4. Gate B1 Canonical Persistence Suite (100% PASS across Assertions 1-11)
node scripts/test_gate_b1.cjs

# 5. Normal Save Snapshots Matrix (100% PASS across Groups 1-3)
node scripts/test_normal_save_snapshots.cjs

# 6. Persistence & Architecture Contracts (100% PASS across Sections 1-31 and 6 Contracts)
node scripts/test_persistence.cjs

# 7. Single-File Standalone Build & Hash Verification
node scripts/build_single_file.cjs
sha256sum index.html dist/hort_ops_offline_planner.html
# 45b215002cf2aee12b02ace1b6ca8b0623ac93aba2355a656f62b8c9940a3767  index.html
# 45b215002cf2aee12b02ace1b6ca8b0623ac93aba2355a656f62b8c9940a3767  dist/hort_ops_offline_planner.html
```

---

## 5. Design Challenge B2 Adjudication

`DESIGN_CHALLENGE_B2.md` identified the product policy choice regarding active recurring job retirement:
- **Option 1 (Current Tested Contract):** Retain fail-closed rejection when retiring a Job that has active future rostering instructions (`test_gate_b2.cjs` Scenario 3.2). Requires the operator to explicitly end active instructions before archiving.
- **Option 2 (One-Step Auto-Retirement):** Implement transactional future instruction/commitment cancellation directly inside Job Registry save.

**Adjudication per Review 19:** Option 1 is preserved as the strict interim safety contract for Gate B2. Option 2 is recorded as **pending user decision for Gate B3 product design**. No unauthorized cascade retirement was introduced.

---

## 6. Checksum Manifest (PR19 Package)

The delivery archive `HortOps-Stage1-GateB2-PR19.zip` contains strictly modified, updated, and built files:

| File Path | SHA-256 Checksum |
| :--- | :--- |
| `js/utils/rostering/commitmentPlanner.js` | `374b77f9754f766324835a74ff9179d63ebcaeb3b1bb85e94b0561578351bebf` |
| `scripts/test_gate_b2.cjs` | `7be465c404646702c2e0b50302fb0c9f131a4369e8b7c7b0dafa9ec046fb0cbb` |
| `index.html` | `45b215002cf2aee12b02ace1b6ca8b0623ac93aba2355a656f62b8c9940a3767` |
| `dist/hort_ops_offline_planner.html` | `45b215002cf2aee12b02ace1b6ca8b0623ac93aba2355a656f62b8c9940a3767` |
| `STAGE1_GOVERNANCE_TRANSITION_REGISTER.md` | *(Computed upon manifest generation)* |
| `STAGE1_GATE_A_PEER_REVIEW_CONTINUITY.md` | *(Computed upon manifest generation)* |
| `GATE_B2_CHANGE_AND_EVIDENCE_REPORT.md` | *(Computed upon manifest generation)* |
| `HANDOFF_GATE_B2_PR19.md` | *(Computed upon manifest generation)* |
| `MANIFEST.sha256.txt` | *(Computed upon manifest generation)* |
