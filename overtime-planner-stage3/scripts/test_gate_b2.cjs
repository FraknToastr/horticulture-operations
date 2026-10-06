/**
 * Stage 1 Gate B2 — Targeted Linked Lifecycle Acceptance Suite
 * File: scripts/test_gate_b2.cjs
 *
 * Exercises the 6 linked lifecycle scenarios specified in Review 17 Prompt Section 6:
 * Scenario 1: Source and descendants (Manual, Fixed, Rotation cross-year, vacancy handling)
 * Scenario 2: Reconciliation (Repeat reduction, Fixed->Manual, staff replacement, idempotency)
 * Scenario 3: Date and parent mutation (Year rollover, parent timing change, archive suppression, rest-gap rule)
 * Scenario 4: Unverified historical data and forbidden deletion (fail-closed unverified, unauthorised deletion blocked)
 * Scenario 5: Authorised future unassignment and failure atomicity (Explicit cancellation, validation & write failure rollback)
 * Scenario 6: Complete round trip (Save, verified reload, checked JSON backup and restore, zero leakage)
 */

const assert = require('assert');
const path = require('path');

// ============================================================================
// 1. Mock Browser Environment
// ============================================================================
class MockLocalStorage {
  constructor() {
    this.store = {};
    this.throwOnSet = false;
  }
  getItem(key) {
    return this.store.hasOwnProperty(key) ? this.store[key] : null;
  }
  setItem(key, value) {
    if (this.throwOnSet) {
      throw new Error('QuotaExceededError: simulated localStorage write failure');
    }
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

let lastAlertMessage = null;
global.window = {
  localStorage: new MockLocalStorage(),
  alert: function(msg) { lastAlertMessage = msg; },
  HortOpsHeader: { render: function() { return ''; } },
  HortOpsForwardPlanner: { render: function() { return ''; } }
};
global.localStorage = global.window.localStorage;
global.alert = function(msg) { lastAlertMessage = msg; };
global.document = {
  getElementById: function() { return null; },
  addEventListener: function() {}
};

// ============================================================================
// 2. Load Modular Dependencies in Canonical Order
// ============================================================================
require('../js/data/holidays.js');
require('../js/data/initialJobs.js');
require('../js/data/staffRoster.js');
require('../js/data/historicalOccurrences.js');
require('../js/utils/dateUtils.js');
require('../js/utils/securityUtils.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/storage/migrationEngine.js');
require('../js/utils/storage/storageDriver.js');
require('../js/utils/storage.js');
require('../js/utils/eligibilityEngine.js');
require('../js/utils/rostering/engine.js');
require('../js/utils/rostering/commitmentPlanner.js');
require('../js/utils/scheduler/costCalculator.js');
require('../js/utils/scheduler/engine.js');
require('../js/utils/scheduler.js');
require('../js/components/staffAssignModal/candidateModel.js');
require('../js/components/staffAssignModal.js');
require('../js/app.js');
require('../js/components/exportModal.js');
require('../js/components/importModal.js');

console.log('=== RUNNING GATE B2 AUTHORITATIVE COMMITMENT LIFECYCLE ACCEPTANCE SUITE ===\n');

// Standard test jobs and roster compliant with Schema v2
const testJobs = [
  {
    id: 'JOB-MANUAL-1',
    name: 'Manual Test Job',
    frequencyType: 'one_off',
    targetDate: '2026-06-06',
    status: 'active',
    primaryTeam: 'Parks',
    crewSize: 1,
    requiredStaff: 1,
    startTime: '08:00',
    durationHours: 8,
    plantOperatorRequired: false
  },
  {
    id: 'JOB-FIXED-CROSS',
    name: 'Fixed Cross-Year Job',
    frequencyType: 'annual',
        targetMonth: 6,
        annualRule: {kind:'weekday',startYear:2026,month:6,ordinal:2,weekday:6},
    status: 'active',
    primaryTeam: 'Parks',
    crewSize: 1,
    requiredStaff: 1,
    startTime: '07:00',
    durationHours: 8,
    plantOperatorRequired: false,
    anchorWeek: 23,
    preferredDay: 'saturday'
  },
  {
    id: 'JOB-ROT-CROSS',
    name: 'Rotation Cross-Year Job',
    frequencyType: 'recurring_weeks',
    intervalWeeks: 13, // quarterly
    anchorDate: '2026-06-27',
    anchorWeek: 26,
    status: 'active',
    primaryTeam: 'Parks',
    crewSize: 1,
    requiredStaff: 1,
    startTime: '07:00',
    durationHours: 8,
    plantOperatorRequired: false,
    preferredDay: 'saturday'
  }
];

const testRoster = [
  { id: 'EMP-001', name: 'Alice Smith', team: 'Parks', status: 'active', isPlantOperator: true },
  { id: 'EMP-002', name: 'Bob Jones', team: 'Parks', status: 'active', isPlantOperator: false },
  { id: 'EMP-003', name: 'Charlie Brown', team: 'Parks', status: 'active', isPlantOperator: false }
];

// Injected test date: start of 2026 so all June+ occurrences are future
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-01-01'; };

function resetWorkspaceState() {
  window.localStorage.clear();
  window.localStorage.throwOnSet = false;
  lastAlertMessage = null;
  window.HortOpsApp.state = {
    jobs: JSON.parse(JSON.stringify(testJobs)),
    staffList: JSON.parse(JSON.stringify(testRoster)),
    customAssignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    customPermits: {},
    budgetSettings: {},
    activeView: 'forward_planner',
    currentYear: 2026,
    allShifts: []
  };
  window.HortOpsApp._authoritativeSnapshotCount = 0;
  window.HortOpsApp.recomputeDigest();

  // Save clean initial envelope
  const env = window.HortOpsStorage.createWorkspaceEnvelope({
    schemaVersion: 2,
    jobs: window.HortOpsApp.state.jobs,
    roster: window.HortOpsApp.state.staffList,
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    permits: {},
    budgetSettings: {},
    uiState: { activeView: 'forward_planner', currentYear: 2026 }
  });
  window.HortOpsStorage.saveWorkspace(env);
  window.HortOpsApp._authoritativeSnapshotCount = 0;
}

// ============================================================================
// SCENARIO 1: Source and Descendants (Manual, Fixed, Rotation cross-year, vacancy)
// ============================================================================
console.log('>>> [SCENARIO 1] Source and Descendant Scheduled Commitment Capture');
resetWorkspaceState();

// 1.1 Manual Assignment
const manualShift = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-MANUAL-1');
assert(manualShift, 'Scenario 1.1: manualShift must exist in digest');
window.HortOpsStaffAssignModal.activeShiftId = manualShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-001'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-001': { mode: 'manual', repeatCount: 1 }
};
window.HortOpsStaffAssignModal.saveAllocation();

assert(window.HortOpsApp.state.historicalSnapshots[manualShift.shiftId],
  'Scenario 1.1: Snapshot must be created for manual assignment target');
const snapManual = window.HortOpsApp.state.historicalSnapshots[manualShift.shiftId];
assert.strictEqual(snapManual.startTime, '08:00', 'Scenario 1.1: Recorded startTime must match occurrence');
assert.strictEqual(snapManual.durationHours, 8, 'Scenario 1.1: Recorded durationHours must match occurrence');
assert.deepStrictEqual(snapManual.assignedStaffIds, ['EMP-001'], 'Scenario 1.1: Recorded staff must match assignment');
assert.strictEqual(snapManual.recordType, 'scheduled_commitment', 'Scenario 1.1: Record type must be scheduled_commitment');
console.log('  [PASS] 1.1: Manual allocation snapshots committed target with recorded timing and assigned staff.');

// 1.2 Fixed Instruction across Calendar Year
const fixedShift = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-FIXED-CROSS');
assert(fixedShift, 'Scenario 1.2: fixedShift must exist in digest');
const fixedJob = window.HortOpsApp.state.jobs.find(j => j.id === 'JOB-FIXED-CROSS');
const fixedOccurrences = window.HortOpsRosteringEngine.resolveRemainingOccurrences(
  fixedShift.shiftId,
  window.HortOpsApp.state.allShifts,
  fixedJob,
  2,
  window.HortOpsApp.state.jobs
);
assert.strictEqual(fixedOccurrences.length, 2, 'Scenario 1.2: Must resolve 2 occurrences across calendar years');
const fixedSourceId = fixedOccurrences[0].shiftId;
const fixedDescendantId = fixedOccurrences[1].shiftId;
assert(fixedDescendantId.indexOf('2027') !== -1, 'Scenario 1.2: Second occurrence must be in year 2027');

window.HortOpsStaffAssignModal.activeShiftId = fixedShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-002'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-002': { mode: 'fixed', repeatCount: 2 }
};
window.HortOpsStaffAssignModal.saveAllocation();

assert(window.HortOpsApp.state.historicalSnapshots[fixedSourceId],
  'Scenario 1.2: Snapshot must exist for Fixed source shift: ' + fixedSourceId);
assert(window.HortOpsApp.state.historicalSnapshots[fixedDescendantId],
  'Scenario 1.2: Snapshot must exist for Fixed cross-year descendant shift: ' + fixedDescendantId);
const snapFixed2027 = window.HortOpsApp.state.historicalSnapshots[fixedDescendantId];
assert.strictEqual(snapFixed2027.startTime, '07:00', 'Scenario 1.2: Cross-year descendant timing must match resolved occurrence');
assert.deepStrictEqual(snapFixed2027.assignedStaffIds, ['EMP-002'], 'Scenario 1.2: Cross-year descendant assigned staff must be EMP-002');
console.log('  [PASS] 1.2: Fixed propagation captures source and cross-year descendant snapshots.');

// 1.3 Rotation Instruction with Genuine Candidate and Vacancy (No fabricated snapshot on vacancy)
const rotShift = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-ROT-CROSS');
assert(rotShift, 'Scenario 1.3: rotShift must exist in digest');
const rotJob = window.HortOpsApp.state.jobs.find(j => j.id === 'JOB-ROT-CROSS');
const rotOccurrences = window.HortOpsRosteringEngine.resolveRemainingOccurrences(
  rotShift.shiftId,
  window.HortOpsApp.state.allShifts,
  rotJob,
  2,
  window.HortOpsApp.state.jobs
);
const rotSourceId = rotOccurrences[0].shiftId;
const rotDescendantId = rotOccurrences[1].shiftId;

window.HortOpsStaffAssignModal.activeShiftId = rotShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-001'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-001': { mode: 'rotation', repeatCount: 2 }
};
window.HortOpsStaffAssignModal.saveAllocation();

assert(window.HortOpsApp.state.historicalSnapshots[rotSourceId],
  'Scenario 1.3: Rotation source snapshot must exist: ' + rotSourceId);
if (window.HortOpsApp.state.customAssignments[rotDescendantId] && window.HortOpsApp.state.customAssignments[rotDescendantId].length > 0) {
  assert(window.HortOpsApp.state.historicalSnapshots[rotDescendantId],
    'Scenario 1.3: Populated rotation descendant must have snapshot: ' + rotDescendantId);
  assert.strictEqual(window.HortOpsApp.state.historicalSnapshots[rotDescendantId].assignedStaffIds.length, 1);
}
// Any shift that is unassigned/vacant must NOT receive a fabricated snapshot
const vacantShifts = window.HortOpsApp.state.allShifts.filter(s =>
  !window.HortOpsApp.state.customAssignments[s.shiftId] || window.HortOpsApp.state.customAssignments[s.shiftId].length === 0
);
vacantShifts.forEach(vs => {
  assert.strictEqual(window.HortOpsApp.state.historicalSnapshots[vs.shiftId], undefined,
    'Scenario 1.3: Vacant shift must never have a fabricated snapshot: ' + vs.shiftId);
});
console.log('  [PASS] 1.3: Rotation committed targets snapshotted; vacant descendants receive no fabricated snapshot.');

// ============================================================================
// SCENARIO 2: Reconciliation (Repeat reduction, Fixed->Manual, staff change, idempotency)
// ============================================================================
console.log('\n>>> [SCENARIO 2] Reconciliation and Targeted Ownership Pruning');

// 2.1 Repeat Reduction
// Reduce Fixed instruction from repeatCount 2 to 1 (pruning 2027 descendant)
window.HortOpsStaffAssignModal.activeShiftId = fixedShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-002'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-002': { mode: 'fixed', repeatCount: 1 }
};
window.HortOpsStaffAssignModal.saveAllocation();

assert.strictEqual(window.HortOpsApp.state.historicalSnapshots[fixedDescendantId], undefined,
  'Scenario 2.1: Pruned 2027 descendant snapshot must be removed upon repeat reduction');
assert(window.HortOpsApp.state.historicalSnapshots[fixedSourceId],
  'Scenario 2.1: Retained source Fixed shift must keep its snapshot');
assert(window.HortOpsApp.state.historicalSnapshots[manualShift.shiftId],
  'Scenario 2.1: Unrelated manual assignment must remain completely untouched');
console.log('  [PASS] 2.1: Repeat reduction prunes only instruction-owned future allocations/snapshots.');

// 2.2 Source Employee Replacement
// Replace EMP-001 with EMP-003 on Manual Job
const recordedAtBefore = window.HortOpsApp.state.historicalSnapshots[manualShift.shiftId].recordedAt;
window.HortOpsStaffAssignModal.activeShiftId = manualShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-003'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-003': { mode: 'manual', repeatCount: 1 }
};
window.HortOpsStaffAssignModal.saveAllocation();

const snapManualAfter = window.HortOpsApp.state.historicalSnapshots[manualShift.shiftId];
assert.deepStrictEqual(snapManualAfter.assignedStaffIds, ['EMP-003'],
  'Scenario 2.2: Assigned staff updated to EMP-003');
assert.strictEqual(snapManualAfter.startTime, '08:00',
  'Scenario 2.2: Original startTime must be preserved verbatim');
assert.strictEqual(snapManualAfter.durationHours, 8,
  'Scenario 2.2: Original durationHours must be preserved verbatim');
assert.strictEqual(snapManualAfter.recordedAt, recordedAtBefore,
  'Scenario 2.2: Original recordedAt must be preserved without rewriting');
console.log('  [PASS] 2.2: Source employee replacement updates membership while preserving timing and recordedAt.');

// 2.3 Idempotent Re-save
const snapsBeforeResave = JSON.parse(JSON.stringify(window.HortOpsApp.state.historicalSnapshots));
const assignsBeforeResave = JSON.parse(JSON.stringify(window.HortOpsApp.state.customAssignments));
window.HortOpsStaffAssignModal.activeShiftId = manualShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-003'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-003': { mode: 'manual', repeatCount: 1 }
};
window.HortOpsStaffAssignModal.saveAllocation();

assert.deepStrictEqual(window.HortOpsApp.state.historicalSnapshots, snapsBeforeResave,
  'Scenario 2.3: Re-saving identical instruction makes zero record changes to historicalSnapshots');
assert.deepStrictEqual(window.HortOpsApp.state.customAssignments, assignsBeforeResave,
  'Scenario 2.3: Re-saving identical instruction makes zero record changes to customAssignments');
console.log('  [PASS] 2.3: Idempotent re-save generates 0 record churn (snapshot-map and assignment equality).');

// ============================================================================
// SCENARIO 3: Date and Parent Mutation (Rollover, Parent Timing Change, Archive, Rest-Gap)
// ============================================================================
console.log('\n>>> [SCENARIO 3] Date Rollover, Parent Job Mutation, and Rest-Gap Enforcement');

// Ensure recurring fixed job has future cross-year allocation established in 2026
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-01-01'; };
window.HortOpsStaffAssignModal.activeShiftId = fixedShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-002'];
window.HortOpsStaffAssignModal.stagedSlots = [];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-002': { mode: 'fixed', repeatCount: 2 }
};
window.HortOpsStaffAssignModal.saveAllocation();

// Advance clock to 2027-01-01 (making 2026 shifts historical, 2027 shifts future)
window.HortOpsDateUtils.getLocalDateKey = function() { return '2027-01-01'; };

// Mutate still-active parent job timing
const manualJobInState = window.HortOpsApp.state.jobs.find(j => j.id === 'JOB-MANUAL-1');
manualJobInState.startTime = '15:00';
manualJobInState.durationHours = 3;

// Resolve shift timing for historical occurrence
const histTiming = window.HortOpsScheduler.resolveShiftHistoricalTiming(
  manualShift.shiftId,
  manualShift.jobId,
  manualShift.date,
  window.HortOpsApp.state.historicalSnapshots
);
assert(histTiming.found, 'Scenario 3.1: Authoritative snapshot must be found');
assert.strictEqual(histTiming.startTime, '08:00',
  'Scenario 3.1: Historical shift must resolve original recorded startTime (08:00), NOT mutated job startTime (15:00)');
assert.strictEqual(histTiming.durationHours, 8,
  'Scenario 3.1: Historical shift must resolve original durationHours (8), NOT mutated job duration (3)');
console.log('  [PASS] 3.1: Clock rollover preserves original historical timing despite active parent job mutation.');

// 3.2 Attempt to archive recurring Job with active future rostering must fail closed
const fixedJobInState = window.HortOpsApp.state.jobs.find(j => j.id === 'JOB-FIXED-CROSS');
assert(fixedJobInState, 'Scenario 3.2: Fixed job must exist');
const futureFixedSnapshot = window.HortOpsApp.state.historicalSnapshots[fixedDescendantId];
assert(futureFixedSnapshot, 'Scenario 3.2: Recurring fixed job must be proven to have a future snapshot');

// Attempt to archive recurring job via HortOpsApp.saveJob()
const rawStorageBeforeArchive = window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);
const archiveCandidate = Object.assign({}, fixedJobInState, { status: 'archived' });
const archiveRes = window.HortOpsApp.saveJob(archiveCandidate);
assert.strictEqual(archiveRes.success, false,
  'Scenario 3.2: Archiving a job with active future rostering must be prohibited by schedule compatibility validator');
assert(archiveRes.error,
  'Scenario 3.2: Rejection message must indicate error');
assert.strictEqual(fixedJobInState.status, 'active',
  'Scenario 3.2: Live job status must remain unmutated (active)');
const rawStorageAfterArchive = window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);
assert.strictEqual(rawStorageAfterArchive, rawStorageBeforeArchive,
  'Scenario 3.2: Storage must remain 100% unmutated on rejected job status transition');

// Archive parent job JOB-MANUAL-1 (which has historical snapshot on 2026-06-06 and no active future rostering)
const manualCandidate = Object.assign({}, manualJobInState, { status: 'archived' });
const manualArchiveRes = window.HortOpsApp.saveJob(manualCandidate);
assert.strictEqual(manualArchiveRes.success, true,
  'Scenario 3.2: Archiving parent job without active future rostering succeeds');
const archivedManualJob = window.HortOpsApp.state.jobs.find(j => j.id === 'JOB-MANUAL-1');
assert.strictEqual(archivedManualJob.status, 'archived',
  'Scenario 3.2: Live status updated to archived');

// Operational digest in 2027 suppresses future shifts for archived job
const digest2027 = window.HortOpsScheduler.generateOperationalDigest(
  window.HortOpsApp.state.jobs,
  2027,
  true,
  window.HortOpsApp.state.customAssignments,
  window.HortOpsApp.state.staffList,
  window.HortOpsApp.state.customPermits,
  window.HortOpsApp.state.historicalSnapshots
);
const futureArchivedShifts = digest2027.allShifts.filter(s => s.jobId === 'JOB-MANUAL-1' && s.date >= '2027-01-01');
assert.strictEqual(futureArchivedShifts.length, 0,
  'Scenario 3.2: Future operational shifts for archived job must be suppressed');
console.log('  [PASS] 3.2: Archived parent job suppresses future shifts; active future rostering retirement fails closed.');

// Eligibility rest gap enforcement (10h rest rule from preserved evidence)
// Test shift ending at 23:00 on 2026-12-31, next shift at 07:00 on 2027-01-01 (8h gap < 10h)
const lateShift2026 = {
  shiftId: 'JOB-LATE@2026-12-31',
  jobId: 'JOB-FIXED-CROSS',
  date: '2026-12-31',
  startTime: '15:00',
  durationHours: 8, // finishes at 23:00
  assignedStaffIds: ['EMP-001'],
  isHistorical: true
};
const nextMorningShift2027 = {
  shiftId: 'JOB-EARLY@2027-01-01',
  jobId: 'JOB-FIXED-CROSS',
  date: '2027-01-01',
  startTime: '07:00', // starts 8h later (< 10h required)
  durationHours: 8,
  assignedStaffIds: []
};
const emp1 = window.HortOpsApp.state.staffList.find(s => s.id === 'EMP-001');
const evalRest = window.HortOpsEligibilityEngine.validateStaffEligibility(
  emp1,
  nextMorningShift2027,
  testJobs[1],
  [lateShift2026, nextMorningShift2027],
  []
);
assert.strictEqual(evalRest.eligible, false,
  'Scenario 3.3: Eligibility must enforce 10h rest rule from preserved historical evidence');
assert(evalRest.reasons.indexOf('INSUFFICIENT_REST') !== -1,
  'Scenario 3.3: Reason must include INSUFFICIENT_REST');
console.log('  [PASS] 3.3: 10-hour rest rule strictly enforced across year boundary using preserved evidence.');

// Reset date for remaining scenarios
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-01-01'; };

// ============================================================================
// SCENARIO 4: Unverified Historical Data and Forbidden Deletion
// ============================================================================
console.log('\n>>> [SCENARIO 4] Unverified Historical Data Fail-Closed & Forbidden Deletion');
resetWorkspaceState();

// 4.1 Past assignment with missing timing snapshot
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-07-01'; };
const pastShiftId = 'JOB-PAST@2026-05-16';
window.HortOpsApp.state.customAssignments[pastShiftId] = ['EMP-001'];
delete window.HortOpsApp.state.historicalSnapshots[pastShiftId];

const digestPast = window.HortOpsScheduler.generateOperationalDigest(
  window.HortOpsApp.state.jobs,
  2026,
  true,
  window.HortOpsApp.state.customAssignments,
  window.HortOpsApp.state.staffList,
  window.HortOpsApp.state.customPermits,
  window.HortOpsApp.state.historicalSnapshots
);

const pastShiftInDigest = digestPast.allShifts.find(s => s.shiftId === pastShiftId);
assert(pastShiftInDigest, 'Scenario 4.1: Past assignment must be included in digest');
assert.strictEqual(pastShiftInDigest.unverifiedSchedule, true,
  'Scenario 4.1: Missing timing snapshot must flag unverifiedSchedule');
assert.strictEqual(pastShiftInDigest.startTime, null,
  'Scenario 4.1: Unverified past commitment must have startTime: null');

// Eligibility fails closed for officer with unverified adjacent shift
const evalUnverified = window.HortOpsEligibilityEngine.validateStaffEligibility(
  emp1,
  { shiftId: 'JOB-NEXT@2026-05-16', date: '2026-05-16', startTime: '07:00', durationHours: 8 },
  testJobs[0],
  [pastShiftInDigest],
  []
);
assert.strictEqual(evalUnverified.eligible, false,
  'Scenario 4.1: Eligibility must fail closed for staff member with unverified adjacent commitment');
assert(evalUnverified.reasons.indexOf('ADJACENT_SCHEDULE_UNAVAILABLE') !== -1,
  'Scenario 4.1: Failure reason must be ADJACENT_SCHEDULE_UNAVAILABLE');
console.log('  [PASS] 4.1: Unverified historical commitment fails closed and blocks affected eligibility.');

// 4.2 Generic / Unauthorised save attempting to drop unrelated snapshot fails closed
const preservedShiftId = 'JOB-MANUAL-1@2026-08-01';
window.HortOpsApp.state.historicalSnapshots[preservedShiftId] = {
  shiftId: preservedShiftId,
  jobId: 'JOB-MANUAL-1',
  date: '2026-08-01',
  startTime: '08:00',
  durationHours: 8,
  assignedStaffIds: ['EMP-002'],
  recordType: 'scheduled_commitment'
};
// Persist established baseline
const baselineSaved = window.HortOpsApp.saveCurrentWorkspace();
assert.strictEqual(baselineSaved, true, 'Scenario 4.2: Baseline save must succeed');

// Attempt to drop unrelated snapshot on live state and save generically
delete window.HortOpsApp.state.historicalSnapshots[preservedShiftId];
const genericSaveOk = window.HortOpsApp.saveCurrentWorkspace();
assert.strictEqual(genericSaveOk, false,
  'Scenario 4.2: Generic save attempting to drop snapshot must fail closed');

// Verify stored snapshot still exists intact
const committedV2 = window.HortOpsStorage.readVerifiedCommittedV2();
assert(committedV2.data.historicalSnapshots[preservedShiftId],
  'Scenario 4.2: Committed storage must retain snapshot byte-for-byte');
console.log('  [PASS] 4.2: Unauthorised snapshot deletion blocked; committed storage preserved.');

// ============================================================================
// SCENARIO 5: Authorised Future Unassignment and Failure Atomicity
// ============================================================================
console.log('\n>>> [SCENARIO 5] Authorised Future Unassignment and Failure Atomicity');
resetWorkspaceState();
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-01-01'; };

// Setup future assignment on manualShift
window.HortOpsStaffAssignModal.activeShiftId = manualShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-001'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-001': { mode: 'manual', repeatCount: 1 }
};
window.HortOpsStaffAssignModal.saveAllocation();

assert(window.HortOpsApp.state.historicalSnapshots[manualShift.shiftId],
  'Scenario 5.1: Initial future assignment must be snapshotted');

// 5.1 Explicit Future Cancellation via designated modal workflow
window.HortOpsStaffAssignModal.activeShiftId = manualShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = []; // clear all staff
window.HortOpsStaffAssignModal.stagedSlots = [];
window.HortOpsStaffAssignModal.saveAllocation();

assert.strictEqual(window.HortOpsApp.state.historicalSnapshots[manualShift.shiftId], undefined,
  'Scenario 5.1: Explicit future cancellation removes only its correctly owned snapshot');
const committedAfterCancel = window.HortOpsStorage.readVerifiedCommittedV2();
assert.strictEqual(committedAfterCancel.data.historicalSnapshots[manualShift.shiftId], undefined,
  'Scenario 5.1: Removal successfully committed to storage');
console.log('  [PASS] 5.1: Explicit future unassignment removes only owned snapshot via designated operation.');

// 5.2 Failure Atomicity: Storage Write Failure
// Re-assign shift
window.HortOpsStaffAssignModal.activeShiftId = manualShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-001'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-001': { mode: 'manual', repeatCount: 1 }
};
window.HortOpsStaffAssignModal.saveAllocation();

// Capture exact pre-failure state
const preStateAssignments = JSON.parse(JSON.stringify(window.HortOpsApp.state.customAssignments));
const preStateSnapshots = JSON.parse(JSON.stringify(window.HortOpsApp.state.historicalSnapshots));
const preRawStorage = window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);

// Simulate storage-write failure
window.localStorage.throwOnSet = true;
lastAlertMessage = null;

window.HortOpsStaffAssignModal.activeShiftId = manualShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-002']; // Change to EMP-002
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-002': { mode: 'manual', repeatCount: 1 }
};
window.HortOpsStaffAssignModal.saveAllocation();

assert(lastAlertMessage, 'Scenario 5.2: Storage failure must trigger alert');
assert.deepStrictEqual(window.HortOpsApp.state.customAssignments, preStateAssignments,
  'Scenario 5.2: Live customAssignments must remain 100% UNMUTATED on persistence failure');
assert.deepStrictEqual(window.HortOpsApp.state.historicalSnapshots, preStateSnapshots,
  'Scenario 5.2: Live historicalSnapshots must remain 100% UNMUTATED on persistence failure');
window.localStorage.throwOnSet = false;
assert.strictEqual(window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY), preRawStorage,
  'Scenario 5.2: Raw storage bytes must remain 100% UNMUTATED on persistence failure');
console.log('  [PASS] 5.2: Persistence write failure leaves live state and committed storage completely unchanged.');

// ============================================================================
// SCENARIO 6: Complete Round Trip (Save, Verified Reload, Checked Backup & Restore, Zero Leakage)
// ============================================================================
console.log('\n>>> [SCENARIO 6] Full Persistence, Backup, and Cross-Workspace Restore');
resetWorkspaceState();
window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-01-01'; };

// Save assignment with source and cross-year descendant
window.HortOpsStaffAssignModal.activeShiftId = fixedShift.shiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-002'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-002': { mode: 'fixed', repeatCount: 2 }
};
window.HortOpsStaffAssignModal.saveAllocation();

// Verified reload from storage
const loaded = window.HortOpsStorage.readVerifiedCommittedV2();
assert(loaded.ok && loaded.exists, 'Scenario 6.1: Stored workspace must be verified readable');
assert(loaded.data.historicalSnapshots[fixedSourceId],
  'Scenario 6.1: Reloaded storage must contain source snapshot: ' + fixedSourceId);
assert(loaded.data.historicalSnapshots[fixedDescendantId],
  'Scenario 6.1: Reloaded storage must contain cross-year descendant snapshot: ' + fixedDescendantId);

// Backup export via real HortOpsExportModal.exportBackupJson()
let capturedExportJson = null;
window.HortOpsExportModal.downloadFile = function(raw, filename, mime) {
  capturedExportJson = raw;
};
const exportOk = window.HortOpsExportModal.exportBackupJson();
assert(exportOk, 'Scenario 6.2: Real HortOpsExportModal.exportBackupJson() must succeed');
assert(capturedExportJson, 'Scenario 6.2: Exported backup data must be captured');
const exportedEnvelope = JSON.parse(capturedExportJson);
assert.strictEqual(exportedEnvelope.schemaVersion, 2, 'Scenario 6.2: Backup envelope is Schema v2');

// Restore into a DIFFERENT, fresh workspace
const newStorage = new MockLocalStorage();
global.window.localStorage = newStorage;
global.localStorage = newStorage;

const restoreRes = window.HortOpsApp.restoreWorkspaceJson(exportedEnvelope);
assert(restoreRes, 'Scenario 6.3: Workspace backup must restore successfully into fresh workspace');

const reloadedNew = window.HortOpsStorage.readVerifiedCommittedV2();
assert(reloadedNew.ok && reloadedNew.exists, 'Scenario 6.3: Restored workspace must be verified readable');
assert.deepStrictEqual(reloadedNew.data.historicalSnapshots, loaded.data.historicalSnapshots,
  'Scenario 6.3: All source and descendant snapshots must survive backup/restore round-trip');
assert.deepStrictEqual(reloadedNew.data.assignments, loaded.data.assignments,
  'Scenario 6.3: Canonical assignments must survive backup/restore round-trip');

// Ensure zero leakage of foreign keys
assert.strictEqual(Object.keys(reloadedNew.data.historicalSnapshots).length, 2,
  'Scenario 6.3: Only restored snapshots exist; zero foreign evidence leakage');
console.log('  [PASS] 6.3: Save -> verified reload -> backup -> clean restore preserves all commitments with zero leakage.');

// Restore original mock storage
global.window.localStorage = window.localStorage;
global.localStorage = window.localStorage;


// ============================================================================
// REVIEW 18 BOUNDED DISCRIMINATORS (All 7 Independent Checks)
// ============================================================================
console.log('\n>>> [REVIEW 18 BOUNDED DISCRIMINATORS] Code-Integrity Baseline Suite');

function copyObj(x) { return JSON.parse(JSON.stringify(x)); }
function runModalSimple(shiftId, staff) {
  window.HortOpsStaffAssignModal.activeShiftId = shiftId;
  window.HortOpsStaffAssignModal.stagedAssignedStaffIds = staff.slice();
  window.HortOpsStaffAssignModal.stagedSlots = [];
  window.HortOpsStaffAssignModal.stagedSlotStrategies = {};
  staff.forEach(function(id) {
    window.HortOpsStaffAssignModal.stagedSlotStrategies[id] = { mode: 'manual', repeatCount: 1 };
  });
  lastAlertMessage = null;
  window.HortOpsStaffAssignModal.saveAllocation();
}

// Check 1: Baseline reader absent: modal must fail closed and must not erase established evidence
resetWorkspaceState();
let manR18 = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-MANUAL-1');
let fixedR18 = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-FIXED-CROSS');
runModalSimple(manR18.shiftId, ['EMP-001']);
let rawBeforeR18 = window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);
assert(JSON.parse(rawBeforeR18).historicalSnapshots[manR18.shiftId], 'R18-1: Baseline manual commitment must exist');

let savedReader = window.HortOpsStorage.readVerifiedCommittedV2;
delete window.HortOpsApp.state.historicalSnapshots[manR18.shiftId];
window.HortOpsStorage.readVerifiedCommittedV2 = undefined;
runModalSimple(fixedR18.shiftId, ['EMP-002']);
let rawAfterR18 = window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);
assert.strictEqual(rawAfterR18, rawBeforeR18, 'R18-1: Missing verified baseline reader must prevent modal overwrite');
assert(lastAlertMessage, 'R18-1: Alert must be triggered');
window.HortOpsStorage.readVerifiedCommittedV2 = savedReader;
console.log('  [PASS] R18-1: Missing verified baseline reader prevents modal overwrite.');

// Check 2: A corrupt committed baseline must stop the modal
resetWorkspaceState();
manR18 = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-MANUAL-1');
fixedR18 = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-FIXED-CROSS');
runModalSimple(manR18.shiftId, ['EMP-001']);
window.localStorage.setItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY, '{ CORRUPTED COMMITTED V2');
runModalSimple(fixedR18.shiftId, ['EMP-002']);
let corruptAfterR18 = window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY);
assert.strictEqual(corruptAfterR18, '{ CORRUPTED COMMITTED V2', 'R18-2: Unreadable committed bytes must remain quarantined');
assert(lastAlertMessage, 'R18-2: Alert must be triggered');
console.log('  [PASS] R18-2: Unreadable committed bytes remain quarantined in modal save.');

// Check 3: Mandatory engine absent: modal must not fall back to app.updateShiftStaff
resetWorkspaceState();
manR18 = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-MANUAL-1');
let savedEngine = window.HortOpsRosteringEngine;
window.HortOpsRosteringEngine = undefined;
runModalSimple(manR18.shiftId, ['EMP-001']);
window.HortOpsRosteringEngine = savedEngine;
let fallbackRaw = JSON.parse(window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY));
assert(!(fallbackRaw.assignments[manR18.shiftId] || []).length, 'R18-3: Absent rostering engine must not persist unsnapshotted assignment');
assert(lastAlertMessage, 'R18-3: Alert must be triggered');
console.log('  [PASS] R18-3: Absent rostering engine fails closed without unsnapshotted fallback.');

// Check 4: Public live direct writer must not persist unsnapshotted new commitments
resetWorkspaceState();
manR18 = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-MANUAL-1');
window.HortOpsApp.updateShiftStaff(manR18.shiftId, ['EMP-001']);
let directRaw = JSON.parse(window.localStorage.getItem(window.HortOpsStorage.WORKSPACE_STORAGE_KEY));
assert(!(directRaw.assignments[manR18.shiftId] || []).length, 'R18-4: Public updateShiftStaff must fail closed');
console.log('  [PASS] R18-4: Public updateShiftStaff fails closed.');

// Check 5: Pure planner must require source/provenance proof for unrelated descendant deletion
resetWorkspaceState();
manR18 = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-MANUAL-1');
fixedR18 = window.HortOpsApp.state.allShifts.find(s => s.jobId === 'JOB-FIXED-CROSS');
let existingSnapR18 = {
  shiftId: manR18.shiftId,
  jobId: manR18.jobId,
  date: manR18.date,
  startTime: manR18.startTime,
  durationHours: manR18.durationHours,
  assignedStaffIds: ['EMP-001'],
  recordType: 'scheduled_commitment',
  recordedAt: '2026-01-01T00:00:00.000Z'
};
let beforeA = {}; beforeA[manR18.shiftId] = ['EMP-001'];
let afterA = {}; afterA[manR18.shiftId] = [];
let beforeS = {}; beforeS[manR18.shiftId] = existingSnapR18;
let forgedJournal = {}; forgedJournal[manR18.shiftId] = manR18;
let deletionR18 = window.HortOpsCommitmentPlanner.plan({
  beforeAssignments: beforeA,
  afterAssignments: afterA,
  beforeSnapshots: beforeS,
  authoritativeOccurrences: forgedJournal,
  todayKey: '2026-01-01',
  operation: { type: 'allocation_reconciliation', sourceShiftId: fixedR18.shiftId }
});
assert.strictEqual(deletionR18.ok, false, 'R18-5: Planner must reject unrelated descendant deletion');
console.log('  [PASS] R18-5: Planner requires source/provenance proof for descendant deletion.');

// Check 6: Existing snapshot without recordedAt must not acquire fabricated audit time
let legacySnapR18 = copyObj(existingSnapR18);
delete legacySnapR18.recordedAt;
let updBefore = {}; updBefore[manR18.shiftId] = ['EMP-001'];
let updAfter = {}; updAfter[manR18.shiftId] = ['EMP-002'];
let originalLegacy = {}; originalLegacy[manR18.shiftId] = legacySnapR18;
let updateR18 = window.HortOpsCommitmentPlanner.plan({
  beforeAssignments: updBefore,
  afterAssignments: updAfter,
  beforeSnapshots: originalLegacy,
  authoritativeOccurrences: forgedJournal,
  todayKey: '2026-01-01',
  operation: { type: 'allocation_reconciliation', sourceShiftId: manR18.shiftId }
});
assert.strictEqual(updateR18.ok, true, 'R18-6: Update must succeed');
assert(!Object.prototype.hasOwnProperty.call(updateR18.snapshots[manR18.shiftId], 'recordedAt'),
  'R18-6: Existing record lacking recordedAt must not acquire fabricated audit time');
console.log('  [PASS] R18-6: Existing snapshot lacking recordedAt does not acquire fabricated audit time.');

// ============================================================================
// REVIEW 19 BOUNDED DISCRIMINATORS: Planner Input Contract & Pure Diff Negative Suite
// ============================================================================
console.log('\n>>> [REVIEW 19 PLANNER BOUNDARY CONTRACTS] Direct Negative Input Verification');

const sourceR19 = 'JOB-R19@2027-12-25';
const targetR19 = 'JOB-R19@2028-01-01';
const historicalR19 = 'JOB-R19@2020-01-04';
const empR19 = 'EMP-R19';
const pKeyR19 = targetR19 + ':' + empR19;

function snapshotR19(shiftId) {
  return {shiftId,jobId:'JOB-R19',date:shiftId.split('@')[1],startTime:'07:00',durationHours:8,assignedStaffIds:[empR19],recordType:'scheduled_commitment'};
}
function sourceRemovalR19(overrides) {
  let args = {beforeAssignments:{[historicalR19]:[empR19]},afterAssignments:{[historicalR19]:[]},beforeSnapshots:{[historicalR19]:snapshotR19(historicalR19)},operation:{type:'future_unassignment',sourceShiftId:historicalR19,targetShiftId:historicalR19}};
  return Object.assign(args,overrides || {});
}
function descendantR19(overrides) {
  let args = {
    beforeAssignments:{[targetR19]:[empR19]}, afterAssignments:{[targetR19]:[]},beforeSnapshots:{[targetR19]:snapshotR19(targetR19)},
    authoritativeOccurrences:{[targetR19]:{shiftId:targetR19,jobId:'JOB-R19',date:'2028-01-01',startTime:'07:00',durationHours:8}},
    beforeRostering:{instructions:{'INST-R19':{id:'INST-R19',sourceShiftId:sourceR19}},
                     provenance:{[pKeyR19]:{source:'rostering-rule',sourceShiftId:sourceR19,instructionId:'INST-R19'}}},
    afterRostering:{instructions:{},provenance:{}},prunedProvenance:[pKeyR19],
    todayKey:'2026-01-01',operation:{type:'allocation_reconciliation',sourceShiftId:sourceR19,targetShiftId:sourceR19}
  };
  return Object.assign(args, overrides || {});
}

// B19-01
const inpB19 = sourceRemovalR19();
const rB19_1 = window.HortOpsCommitmentPlanner.plan(inpB19);
assert.strictEqual(rB19_1.ok, false, 'B19-01: missing injected todayKey must fail closed');
assert(inpB19.beforeSnapshots[historicalR19]);
console.log('  [PASS] R19-1: Missing injected local todayKey fails closed, preventing past snapshot removal.');

// B19-02
const rB19_2 = window.HortOpsCommitmentPlanner.plan(descendantR19({todayKey:'2026-99-99'}));
assert.strictEqual(rB19_2.ok, false, 'B19-02: malformed todayKey must fail closed');
console.log('  [PASS] R19-2: Malformed todayKey fails closed even for otherwise permitted future removal.');

// B19-03
const rB19_3 = window.HortOpsCommitmentPlanner.plan(descendantR19({afterRostering:undefined}));
assert.strictEqual(rB19_3.ok, false, 'B19-03: descendant removal requires afterRostering provenance proof');
console.log('  [PASS] R19-3: Descendant removal requires afterRostering provenance proof.');

// B19-04
const rB19_4 = window.HortOpsCommitmentPlanner.plan(descendantR19({prunedProvenance:undefined}));
assert.strictEqual(rB19_4.ok, false, 'B19-04: descendant removal requires actual engine-pruned provenance proof');
console.log('  [PASS] R19-4: Descendant removal requires actual engine-pruned provenance proof.');

// B19-05
const rB19_5 = window.HortOpsCommitmentPlanner.plan(descendantR19());
assert.strictEqual(rB19_5.ok, true, rB19_5.error);
assert.deepStrictEqual(rB19_5.permittedSnapshotRemovals, [targetR19]);
assert.strictEqual(Object.prototype.hasOwnProperty.call(rB19_5.snapshots, targetR19), false);
console.log('  [PASS] R19-5: Genuine future descendant removal with complete ownership proof remains allowed.');

// B19-06
const beforeDescB19 = descendantR19().beforeRostering;
beforeDescB19.provenance[pKeyR19].sourceShiftId = 'OTHER-JOB@2027-12-25';
const rB19_6 = window.HortOpsCommitmentPlanner.plan(descendantR19({beforeRostering:beforeDescB19}));
assert.strictEqual(rB19_6.ok, false, 'B19-06: unrelated provenance cannot authorize deletion');
console.log('  [PASS] R19-6: Unrelated manual/another source provenance cannot authorize deletion.');

// B19-07
const futureB19 = 'JOB-R19@2028-06-06';
const snapB19 = snapshotR19(futureB19);
const rB19_7 = window.HortOpsCommitmentPlanner.plan({
  beforeAssignments: {[futureB19]: [empR19]},
  afterAssignments: {[futureB19]: []},
  beforeSnapshots: {[futureB19]: snapB19},
  todayKey: '2026-01-01',
  operation: {type: 'future_unassignment', sourceShiftId: futureB19, targetShiftId: futureB19}
});
assert.strictEqual(rB19_7.ok, true, rB19_7.error);
assert.deepStrictEqual(rB19_7.permittedSnapshotRemovals, [futureB19]);
console.log('  [PASS] R19-7: Valid explicit current/future source unassignment remains allowed.');

// B19-08
const argsB19 = descendantR19();
const priorB19 = JSON.stringify(argsB19.operation);
const rB19_8 = window.HortOpsCommitmentPlanner.plan(argsB19);
assert.strictEqual(rB19_8.ok, true, rB19_8.error);
assert.strictEqual(JSON.stringify(argsB19.operation), priorB19, 'input.operation acquired hidden todayKey');
console.log('  [PASS] R19-8: Pure planner does not mutate caller-owned operation metadata.');

console.log('\n================================================================');
console.log(' ALL GATE B2 & REVIEW 18/19 ACCEPTANCE SCENARIOS PASSED (100%)');
console.log('================================================================');
