# Design Challenge B2 — Active Job Retirement vs. Future Rostering Cancellation Policy

**Date:** 2026-09-25  
**Stage / Gate:** Stage 1 Gate B2 (Review 18 Resolution)  
**Author:** AI Pair Programmer (Antigravity)  
**Status:** SUBMITTED FOR REVIEWER / USER DECISION  
**Preserved Baseline:** Gate A (Accepted, Review 12); Gate B1 (Accepted, Review 17)

---

## 1. Challenged Source Functions & Exact Line Anchors

1. **`js/components/jobEditModal/formValidator.js:250–275` (`validateSchedulingCompatibility`)**
   ```javascript
   if (!isStillValid) {
     if (isStatusDeactivating) {
       return {
         valid: false,
         message: 'This Job has active future rostering and cannot be made inactive until that rostering is ended or revised.'
       };
     }
     return {
       valid: false,
       message: 'This Job has active future rostering based on its current schedule. End or revise that rostering before changing the Job schedule.'
     };
   }
   ```
2. **`js/utils/storage/migrationEngine.js:98–105` (Schema v2 Envelope Validator)**
   ```javascript
   if (inst.status === 'active' && job && (job.status === 'inactive' || job.status === 'archived')) {
     throw new Error('Active rostering instruction "' + instId + '" belongs to non-active Job "' + inst.jobId + '" (status: "' + job.status + '").');
   }
   ```
3. **`js/app.js:270–315` (`saveJob`)**
   Attempts in-memory job mutation, calls `saveCurrentWorkspace()`, and rolls back in-memory job mutation if envelope creation fails.

---

## 2. Actual Runtime Payload & Minimal Deterministic Reproduction

```javascript
// Setup active recurring Job with future cross-year descendant assignment and snapshot
const job = {
  id: 'JOB-FIXED-CROSS',
  name: 'Fixed Cross-Year Job',
  frequencyType: 'annual',
  targetMonth: 6,
  status: 'active',
  anchorWeek: 23,
  preferredDay: 'saturday',
  startTime: '07:00',
  durationHours: 8
};
// Active instruction exists:
// rostering.instructions['ROSTER-JOB-FIXED-CROSS-2026-06-13-slot-0'] = { status: 'active', ... }
// Snapshot exists: historicalSnapshots['JOB-FIXED-CROSS@2027-06-05']

// Attempt to archive the job directly via HortOpsApp.saveJob():
const res = window.HortOpsApp.saveJob(Object.assign({}, job, { status: 'archived' }));

// Result:
// res.success === false
// res.error === 'Workspace save failed. Job edit rolled back.'
// (Encountered error in migrationEngine: 'Active rostering instruction ... belongs to non-active Job ...')
```

---

## 3. Exact Competing Existing Invariants

- **Invariant A (Schema v2 Relational Consistency):**  
  A non-active job (`archived` or `inactive`) cannot possess `status: 'active'` rostering instructions. The canonical constructor (`createWorkspaceEnvelope`) strictly throws an error to prevent dangling active instructions for retired jobs.
- **Invariant B (Zero-Loss & Historical Immutability):**  
  Retiring a parent job must never silently destroy historical actuals or committed evidence. Any deletion of future commitments must be explicitly authorised and traceable.
- **Invariant C (Operator Intent & Workflow Ergonomics):**  
  When an operator retires a job, they expect future shifts to cease appearing on the calendar and operational digest, without needing to hunt down every future recurrence across years to manually unassign slots first.

---

## 4. Source-Grounded Design Options & Tradeoffs

### Option 1: Strict Fail-Closed with Explicit Prior Cancellation (Current Implementation)
- **Mechanism:** `HortOpsApp.saveJob` refuses to archive or deactivate any job that has active future rostering instructions or future scheduled commitments. The operator is required to explicitly end or unassign the rostering instruction in the Staff Assignment Modal before the Job Registry permits archiving.
- **Persistence & Recovery Effects:**
  - Zero possibility of accidental cascade deletion.
  - Fully conforms to existing Schema v2 constructor without code changes in `migrationEngine.js`.
  - Live state and storage remain 100% unmutated if archiving is attempted prematurely.
- **Tradeoff:** Requires a two-step workflow for the user (first unassign/end future rostering in calendar/planner, then open Job Registry to archive).

### Option 2: Transactional Auto-Retirement of Future Rostering Instructions in `saveJob`
- **Mechanism:** When `HortOpsApp.saveJob` receives `status: 'archived'` or `status: 'inactive'`:
  1. Identifies all instructions for that `jobId`.
  2. For future occurrences, automatically marks instructions as `status: 'historical'` (or seals them) and calls `HortOpsCommitmentPlanner.plan` with an explicit `job_retirement` operation to authorise removal of future unworked descendant snapshots.
  3. Preserves all historical snapshots (`date < todayKey`) verbatim.
  4. Bundles the mutated job, updated instructions, and pruned future snapshots into a single atomic envelope.
- **Persistence & Recovery Effects:**
  - One-click archiving from Job Registry.
  - Cleanly satisfies Schema v2 constraint because instructions transition from `'active'` to `'historical'` (or retired).
- **Tradeoff:** Substantially expands `saveJob` scope in Stage 1 Gate B2, coupling the Job Registry directly to the Commitment Planner, whereas Gate B3 was scheduled to address Job Registry reconciliation.

---

## 5. Recommended ES5 Implementation

**Recommendation:** Maintain **Option 1 (Fail-Closed)** for Stage 1 Gate B2. It strictly enforces zero unverified deletions, requires zero invasive coupling between `app.js` and `commitmentPlanner.js`, and protects both live state and persisted storage. Option 2 should be considered during **Gate B3** when the Job Registry is formally aligned with the canonical Schema v2 persistence transaction model.

---

## 6. Two Discriminating Tests

1. **Negative Probe (Active Rostering Blocks Retirement):**
   - Setup: Active recurring job with future assigned snapshot and active instruction.
   - Action: Call `HortOpsApp.saveJob({ ...job, status: 'archived' })`.
   - Assert: `res.success === false`, `job.status` in `state.jobs` remains `'active'`, raw storage bytes remain completely unmutated.
2. **Positive Control (Clean Retirement After Rostering Cleared):**
   - Action: Operator unassigns future descendant / ends instruction, then calls `HortOpsApp.saveJob({ ...job, status: 'archived' })`.
   - Assert: `res.success === true`, `job.status` becomes `'archived'`, 2027 operational digest suppresses future shifts, and 2026 historical snapshot timing remains 100% preserved.

---

## 7. One Decision Required from Independent Reviewer / User

> **Decision Point:**  
> Confirm whether **Option 1 (Fail-Closed: Operator must explicitly clear/end active future rostering before retiring a job)** is accepted as the permanent policy for Gate B2, with automated cascade retirement deferred to Gate B3; **OR** whether automated cascade retirement (Option 2) is required within Gate B2.
