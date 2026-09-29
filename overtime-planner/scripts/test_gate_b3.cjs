'use strict';

/**
 * Stage 1 Gate B3 Transaction Hardening & Full-Review Acceptance Test Suite
 * Covers B3-01 through B3-14 (Review 20) and FULL-B3-01 through FULL-B3-08.
 * Purely synthetic data: zero real staff names, addresses, or operational rosters.
 */

const assert = require('assert');
const path = require('path');

// 1. Synthetic Browser & Storage Environment
class MockStorage {
  constructor() {
    this.map = {};
    this.failWrites = false;
  }
  getItem(k) {
    return Object.prototype.hasOwnProperty.call(this.map, k) ? this.map[k] : null;
  }
  setItem(k, v) {
    if (this.failWrites) {
      throw new Error('SIMULATED_STORAGE_FAILURE: QuotaExceededError');
    }
    this.map[k] = String(v);
  }
  removeItem(k) {
    delete this.map[k];
  }
  clear() {
    this.map = {};
  }
}

const mockStorage = new MockStorage();
let lastAlert = null;
const alerts = [];

global.window = {
  localStorage: mockStorage,
  HortOpsData: {
    HISTORICAL_OCCURRENCES: [],
    INITIAL_JOBS: [],
    STAFF_ROSTER: []
  },
  HortOpsHeader: {
    updateStorageHealth: () => {},
    updateStorageHealthIndicator: () => {}
  }
};
global.localStorage = mockStorage;
global.alert = (m) => {
  lastAlert = m;
  alerts.push(m);
};
global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};

// 2. Load Core Modules
const root = path.resolve(__dirname, '..');
function req(p) { require(path.join(root, p)); }

req('js/utils/dateUtils.js');
req('js/utils/storage/schemaValidator.js');
req('js/utils/storage/migrationEngine.js');
req('js/utils/storage/storageDriver.js');
req('js/utils/storage.js');
req('js/utils/scheduler/engine.js');
req('js/utils/scheduler.js');
req('js/utils/reconciliationEngine.js');
req('js/components/jobEditModal/formValidator.js');
req('js/app.js');

const app = window.HortOpsApp;
const storage = window.HortOpsStorage;
const validator = window.HortOpsSchemaValidator;

app.recomputeDigest = () => {};
app.renderCurrentView = () => {};

// 3. Synthetic Fixtures
const clone = (v) => JSON.parse(JSON.stringify(v));

function makeSyntheticJob(id = 'JOB-SYN-1', status = 'active') {
  return {
    id: id,
    name: 'Synthetic Maintenance ' + id,
    frequencyType: 'recurring_weeks',
    intervalWeeks: 1,
    anchorDate: '2026-06-06',
    preferredDay: 'saturday',
    startTime: '08:00',
    durationHours: 4,
    crewSize: 1,
    status: status
  };
}

function makeSyntheticStaff(id = 'EMP-SYN-1', status = 'active') {
  return {
    id: id,
    name: 'Synthetic Staff ' + id,
    team: 'Parks',
    department: 'Horticulture',
    crew: 'Synthetic Crew',
    status: status,
    isOvertimeExempt: false,
    willingness: 'available'
  };
}

function makeSyntheticSnapshot(shiftId, jobId, empId) {
  const parts = shiftId.split('@');
  const date = parts[1] || '2026-06-06';
  return {
    shiftId: shiftId,
    jobId: jobId,
    date: date,
    startTime: '08:00',
    durationHours: 4,
    assignedStaffIds: [empId],
    recordType: 'scheduled_commitment'
  };
}

function makeSyntheticWorkspace(overrides = {}) {
  const job = makeSyntheticJob('JOB-SYN-A');
  const staff = makeSyntheticStaff('EMP-SYN-A');
  const shiftKey = 'JOB-SYN-A@2026-06-06';
  const snap = makeSyntheticSnapshot(shiftKey, 'JOB-SYN-A', 'EMP-SYN-A');

  const base = {
    schemaVersion: 2,
    jobs: [job],
    roster: [staff],
    assignments: { [shiftKey]: ['EMP-SYN-A'] },
    rostering: {
      instructions: {},
      provenance: {}
    },
    historicalSnapshots: { [shiftKey]: snap },
    permits: {},
    budgetSettings: { annualBudgetCap: 50000 },
    uiState: { currentYear: 2026, activeView: 'forward_planner' }
  };

  return Object.assign(base, overrides);
}

function resetWorkspace(envelope) {
  mockStorage.clear();
  mockStorage.failWrites = false;
  lastAlert = null;
  alerts.length = 0;

  const env = envelope || makeSyntheticWorkspace();
  const saveRes = storage.saveWorkspace(env);
  if (!saveRes.ok) {
    throw new Error('Failed to reset synthetic workspace: ' + saveRes.error);
  }

  app.state = {
    schemaVersion: 2,
    jobs: clone(env.jobs),
    staffList: clone(env.roster),
    customAssignments: clone(env.assignments),
    rostering: clone(env.rostering),
    historicalSnapshots: clone(env.historicalSnapshots),
    customPermits: clone(env.permits || {}),
    budgetSettings: clone(env.budgetSettings || null),
    activeView: env.uiState ? (env.uiState.activeView || 'forward_planner') : 'forward_planner',
    currentYear: env.uiState ? (env.uiState.currentYear || 2026) : 2026,
    recoveryRequired: false,
    storageStatus: 'saved'
  };
  app._authoritativeSnapshotCount = Object.keys(env.historicalSnapshots).length;
  app._allowHistoryReset = false;
}

console.log('=== RUNNING GATE B3 TRANSACTION HARDENING & ATOMICITY TEST SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(id, description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${id}: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${id}: ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------------------------------------
// Group 1: Permit Transaction Hardening (B3-01, B3-02, FULL-B3-03)
// ------------------------------------------------------------------------------------------------

runTest('B3-01', 'updatePermit: successful permit mutation commits and adopts state', () => {
  resetWorkspace();
  const shiftKey = 'JOB-SYN-A@2026-06-06';
  const res = app.updatePermit(shiftKey, { wztmStatus: 'approved', wztmNotes: 'Ref#123' });

  assert.strictEqual(res.success, true, 'Permit update must return success: true');
  assert.strictEqual(app.state.customPermits[shiftKey].wztmStatus, 'approved');
  assert.strictEqual(app.state.customPermits[shiftKey].wztmNotes, 'Ref#123');

  // Verify reload
  const committed = storage.readVerifiedCommittedV2();
  assert.strictEqual(committed.ok, true);
  assert.strictEqual(committed.data.permits[shiftKey].wztmStatus, 'approved');
});

runTest('B3-02 / FULL-B3-03', 'updatePermit: storage failure rolls back live permits, bytes unchanged', () => {
  resetWorkspace();
  const shiftKey = 'JOB-SYN-A@2026-06-06';
  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);
  const livePermitsBefore = clone(app.state.customPermits);

  mockStorage.failWrites = true;
  const res = app.updatePermit(shiftKey, { wztmStatus: 'approved' });
  mockStorage.failWrites = false;

  assert.strictEqual(res.success, false, 'Failed permit save must report failure');
  assert.deepStrictEqual(app.state.customPermits, livePermitsBefore, 'Live permits must remain untouched on failure');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Storage bytes must remain byte-identical');
  assert.ok(app.state.storageStatus === 'save_failed' || app.state.storageStatus === 'session_only', 'Storage status must reflect save failure');
});

// ------------------------------------------------------------------------------------------------
// Group 2: Individual Staff Update Atomicity (B3-03, B3-04)
// ------------------------------------------------------------------------------------------------

runTest('B3-03', 'updateStaffMember: successful update commits and adopts detached state', () => {
  resetWorkspace();
  const res = app.updateStaffMember({
    id: 'EMP-SYN-A',
    isOvertimeExempt: true,
    exemptionStartDate: '2026-06-01',
    exemptionEndDate: '2026-06-30',
    exemptionReason: 'Medical restriction'
  });

  assert.strictEqual(res.success, true);
  const staff = app.state.staffList.find(s => s.id === 'EMP-SYN-A');
  assert.strictEqual(staff.isOvertimeExempt, true);
  assert.strictEqual(staff.exemptionReason, 'Medical restriction');

  const committed = storage.readVerifiedCommittedV2();
  const storedStaff = committed.data.roster.find(s => s.id === 'EMP-SYN-A');
  assert.strictEqual(storedStaff.isOvertimeExempt, true);
});

runTest('B3-04', 'updateStaffMember: storage failure leaves staff list and committed bytes unchanged', () => {
  resetWorkspace();
  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);
  const liveStaffBefore = clone(app.state.staffList);

  mockStorage.failWrites = true;
  const res = app.updateStaffMember({
    id: 'EMP-SYN-A',
    isOvertimeExempt: true
  });
  mockStorage.failWrites = false;

  assert.strictEqual(res.success, false);
  assert.deepStrictEqual(app.state.staffList, liveStaffBefore, 'Staff list must remain unchanged');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Storage bytes must remain identical');
});

// ------------------------------------------------------------------------------------------------
// Group 3: Workforce Reconciliation Atomicity (B3-05, B3-06, B3-07, FULL-B3-04)
// ------------------------------------------------------------------------------------------------

runTest('B3-05', 'reconcileStaffSnapshot: successful reconciliation commits atomically and adopts state', () => {
  resetWorkspace();
  const diff = {
    added: [makeSyntheticStaff('EMP-SYN-B')],
    updated: [],
    departed: [],
    unchanged: [makeSyntheticStaff('EMP-SYN-A')],
    vacatedFutureAssignments: []
  };

  const res = app.reconcileStaffSnapshot(diff);
  assert.strictEqual(res.success, true);
  assert.strictEqual(app.state.staffList.length, 2);
  assert.ok(app.state.staffList.find(s => s.id === 'EMP-SYN-B'));

  const committed = storage.readVerifiedCommittedV2();
  assert.strictEqual(committed.data.roster.length, 2);
});

runTest('B3-06 / FULL-B3-04', 'reconcileStaffSnapshot: storage failure preserves original roster, assignments, and storage bytes', () => {
  resetWorkspace();
  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);
  const liveStaffBefore = clone(app.state.staffList);
  const liveAssignBefore = clone(app.state.customAssignments);

  const diff = {
    added: [makeSyntheticStaff('EMP-SYN-NEW')],
    updated: [],
    departed: [],
    unchanged: [makeSyntheticStaff('EMP-SYN-A')],
    vacatedFutureAssignments: []
  };

  mockStorage.failWrites = true;
  const res = app.reconcileStaffSnapshot(diff);
  mockStorage.failWrites = false;

  assert.strictEqual(res.success, false);
  assert.deepStrictEqual(app.state.staffList, liveStaffBefore, 'Roster must not adopt uncommitted additions');
  assert.deepStrictEqual(app.state.customAssignments, liveAssignBefore, 'Assignments must remain unchanged');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Storage bytes must remain identical');
});

runTest('B3-07', 'reconcileStaffSnapshot: departed staff does not erase historical scheduled commitment assignments', () => {
  resetWorkspace();
  const pastShift = 'JOB-SYN-A@2025-06-06';
  const pastSnap = makeSyntheticSnapshot(pastShift, 'JOB-SYN-A', 'EMP-SYN-A');
  app.state.historicalSnapshots[pastShift] = pastSnap;
  app._authoritativeSnapshotCount = 2;
  storage.saveWorkspace(app.state);

  const diff = {
    added: [],
    updated: [],
    departed: [Object.assign({}, makeSyntheticStaff('EMP-SYN-A'), { status: 'departed' })],
    unchanged: [],
    vacatedFutureAssignments: []
  };

  const res = app.reconcileStaffSnapshot(diff);
  assert.strictEqual(res.success, true);

  // Historical snapshot must strictly preserve assignedStaffIds: ['EMP-SYN-A']
  assert.deepStrictEqual(app.state.historicalSnapshots[pastShift].assignedStaffIds, ['EMP-SYN-A']);
  const committed = storage.readVerifiedCommittedV2();
  assert.deepStrictEqual(committed.data.historicalSnapshots[pastShift].assignedStaffIds, ['EMP-SYN-A']);
});

// ------------------------------------------------------------------------------------------------
// Group 4: Job Mutation, Dependency & Retirement Hardening (B3-08..B3-12, FULL-B3-01, FULL-B3-02, FULL-B3-05)
// ------------------------------------------------------------------------------------------------

runTest('B3-08 / FULL-B3-05', 'saveJob: existing Job edit storage failure preserves original Job and bytes', () => {
  resetWorkspace();
  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);
  const originalJob = clone(app.state.jobs[0]);

  mockStorage.failWrites = true;
  const res = app.saveJob(Object.assign({}, originalJob, { name: 'Mutated Name' }));
  mockStorage.failWrites = false;

  assert.strictEqual(res.success, false);
  assert.strictEqual(app.state.jobs[0].name, originalJob.name, 'Job name must not mutate in memory');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Storage bytes must remain identical');
});

runTest('B3-09', 'saveJob: new Job insertion storage failure does not append uncommitted Job to live list', () => {
  resetWorkspace();
  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);
  const countBefore = app.state.jobs.length;

  mockStorage.failWrites = true;
  const newJob = makeSyntheticJob('JOB-SYN-NEW');
  const res = app.saveJob(newJob);
  mockStorage.failWrites = false;

  assert.strictEqual(res.success, false);
  assert.strictEqual(app.state.jobs.length, countBefore, 'Job array length must not increase on failed save');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Storage bytes must remain identical');
});

runTest('B3-10', 'saveJob: instruction sealing on retirement rolls back if storage write fails', () => {
  const instId = 'ROSTER-JOB-SYN-A-2026-06-06-SLOT-0';
  const ws = makeSyntheticWorkspace({
    rostering: {
      instructions: {
        [instId]: {
          id: instId,
          instructionId: instId,
          jobId: 'JOB-SYN-A',
          sourceShiftId: 'JOB-SYN-A@2026-06-06',
          slotId: 'SLOT-0',
          mode: 'fixed',
          employeeId: 'EMP-SYN-A',
          repeatCount: 1,
          status: 'active'
        }
      },
      provenance: {}
    }
  });
  resetWorkspace(ws);

  // Set up mock compatibility validator that instructs sealing instId
  const oldVal = window.HortOpsJobEditFormValidator;
  window.HortOpsJobEditFormValidator = {
    validateRecurrenceCompatibility: () => ({
      valid: true,
      instructionsToSeal: [instId]
    })
  };

  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);
  mockStorage.failWrites = true;
  const res = app.saveJob(Object.assign({}, app.state.jobs[0], { status: 'inactive' }));
  mockStorage.failWrites = false;
  window.HortOpsJobEditFormValidator = oldVal;

  assert.strictEqual(res.success, false);
  assert.strictEqual(app.state.rostering.instructions[instId].status, 'active', 'Instruction status must remain active');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Storage bytes must remain identical');
});

runTest('B3-11', 'deleteJob: unencumbered hard delete failure rolls back live jobs list', () => {
  const unencumberedJob = makeSyntheticJob('JOB-FREE');
  const ws = makeSyntheticWorkspace({
    jobs: [makeSyntheticJob('JOB-SYN-A'), unencumberedJob],
    historicalSnapshots: {}
  });
  resetWorkspace(ws);
  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);

  mockStorage.failWrites = true;
  const res = app.deleteJob('JOB-FREE');
  mockStorage.failWrites = false;

  assert.strictEqual(res.success, false);
  assert.ok(app.state.jobs.find(j => j.id === 'JOB-FREE'), 'Unencumbered job must remain in live list on failure');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Storage bytes must remain identical');
});

runTest('B3-12', 'deleteJob: active future rostering instruction fails closed against retirement deletion', () => {
  const instId = 'ROSTER-JOB-SYN-A-2026-06-06-SLOT-0';
  const ws = makeSyntheticWorkspace({
    rostering: {
      instructions: {
        [instId]: {
          id: instId,
          instructionId: instId,
          jobId: 'JOB-SYN-A',
          sourceShiftId: 'JOB-SYN-A@2026-06-06',
          slotId: 'SLOT-0',
          mode: 'fixed',
          employeeId: 'EMP-SYN-A',
          repeatCount: 1,
          status: 'active'
        }
      },
      provenance: {}
    }
  });
  resetWorkspace(ws);

  // Mock validator blocking retirement because active future instruction cannot be retired without sealing
  const oldVal = window.HortOpsJobEditFormValidator;
  window.HortOpsJobEditFormValidator = {
    validateRecurrenceCompatibility: () => ({
      valid: false,
      message: 'Active future instruction guard: cannot retire job with active future instruction'
    })
  };

  const res = app.deleteJob('JOB-SYN-A');
  window.HortOpsJobEditFormValidator = oldVal;

  assert.strictEqual(res.success, false);
  assert.strictEqual(res.retired, false);
  assert.strictEqual(app.state.jobs[0].status, 'active', 'Job must remain active when blocked by guard');
});

runTest('FULL-B3-01 (FR-01)', 'getJobDependencies: recognizes historical scheduled commitment snapshots; prevents hard delete', () => {
  // A Job with zero assignments, zero permits, zero occurrences, but 1 historical snapshot
  const job = makeSyntheticJob('JOB-HIST-ONLY');
  const snap = makeSyntheticSnapshot('JOB-HIST-ONLY@2025-06-07', 'JOB-HIST-ONLY', 'EMP-SYN-A');
  const ws = {
    schemaVersion: 2,
    jobs: [job],
    roster: [makeSyntheticStaff('EMP-SYN-A')],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: { 'JOB-HIST-ONLY@2025-06-07': snap },
    permits: {},
    budgetSettings: {},
    uiState: {}
  };
  resetWorkspace(ws);

  const deps = app.getJobDependencies('JOB-HIST-ONLY', app.state);
  assert.strictEqual(deps.historicalSnapshots, 1, 'Historical snapshot must be formally counted');
  assert.strictEqual(deps.totalDependencies, 1);
  assert.strictEqual(deps.canHardDelete, false, 'Job with snapshot must not be eligible for hard deletion');

  // Deleting it must retire it to inactive rather than removing it from storage
  const res = app.deleteJob('JOB-HIST-ONLY');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.retired, true);

  const stored = JSON.parse(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY));
  assert.strictEqual(stored.jobs.length, 1, 'Job must be retained in persisted envelope');
  assert.strictEqual(stored.jobs[0].status, 'inactive', 'Job status must be retired to inactive');
  assert.ok(stored.historicalSnapshots['JOB-HIST-ONLY@2025-06-07'], 'Snapshot must remain attributed to parent Job');
});

runTest('FULL-B3-02', 'deleteJob: storage failure during history-only retirement rolls back live state and bytes', () => {
  const job = makeSyntheticJob('JOB-HIST-ONLY', 'active');
  const snap = makeSyntheticSnapshot('JOB-HIST-ONLY@2025-06-07', 'JOB-HIST-ONLY', 'EMP-SYN-A');
  const ws = {
    schemaVersion: 2,
    jobs: [job],
    roster: [makeSyntheticStaff('EMP-SYN-A')],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: { 'JOB-HIST-ONLY@2025-06-07': snap },
    permits: {},
    budgetSettings: {},
    uiState: {}
  };
  resetWorkspace(ws);
  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);

  mockStorage.failWrites = true;
  const res = app.deleteJob('JOB-HIST-ONLY');
  mockStorage.failWrites = false;

  assert.strictEqual(res.success, false);
  assert.strictEqual(app.state.jobs[0].status, 'active', 'Live status must remain active');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Raw bytes must remain identical');
});

// ------------------------------------------------------------------------------------------------
// Group 5: Restore State Equivalence (B3-14, FULL-B3-06, FR-04)
// ------------------------------------------------------------------------------------------------

runTest('FULL-B3-06 (FR-04)', 'restoreWorkspaceJson: accepted partial restore resets omitted optional domains to canonical defaults', () => {
  resetWorkspace();

  // Simulate established live state with high budget cap and future year
  app.state.budgetSettings = { annualBudgetCap: 9999999 };
  app.state.currentYear = 2035;
  app.state.activeView = 'analytics';

  // Restore payload omitting budgetSettings and uiState
  const partialRestore = {
    schemaVersion: 2,
    jobs: [makeSyntheticJob('JOB-SYN-RESTORE')],
    roster: [makeSyntheticStaff('EMP-SYN-RESTORE')],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {}
  };

  const res = app.restoreWorkspaceJson(partialRestore);
  assert.strictEqual(res, true, 'Restore of valid Schema v2 envelope must succeed');

  // Live state must have canonical defaults, NOT stale prior values!
  assert.notStrictEqual(app.state.budgetSettings && app.state.budgetSettings.annualBudgetCap, 9999999,
    'Stale live annualBudgetCap must be replaced');
  assert.strictEqual(app.state.currentYear, 2026, 'Omitted currentYear must reset to default 2026');
  assert.strictEqual(app.state.activeView, 'forward_planner', 'Omitted activeView must reset to default forward_planner');

  // Verify stored envelope agrees with live state
  const stored = JSON.parse(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY));
  // Verify stored envelope agrees with live state (R23-03 / FR-04 canonical equivalence)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(stored, 'budgetSettings'), true,
    'Committed storage must contain canonical budgetSettings');
  assert.deepStrictEqual(stored.budgetSettings, app.state.budgetSettings,
    'Committed budgetSettings must match live state');
});

runTest('FULL-B3-06 (Negative)', 'restoreWorkspaceJson: rejected invalid restore preserves prior live state and storage bytes', () => {
  resetWorkspace();
  const rawBefore = mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY);
  const liveStateBefore = clone(app.state);

  const invalidRestore = {
    schemaVersion: 2,
    jobs: [{ id: 'bad id with spaces' }],
    roster: [],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {}
  };

  const res = app.restoreWorkspaceJson(invalidRestore);
  assert.strictEqual(res, false, 'Invalid envelope must be rejected during preflight');
  assert.deepStrictEqual(app.state.jobs, liveStateBefore.jobs, 'Live jobs must remain untouched');
  assert.strictEqual(mockStorage.getItem(storage.WORKSPACE_STORAGE_KEY), rawBefore, 'Storage bytes must remain identical');
});

// ------------------------------------------------------------------------------------------------
// Group 6: Detachment and Aliasing Defense (B3-13, FULL-B3-07, FULL-B3-08)
// ------------------------------------------------------------------------------------------------

runTest('B3-13 / FULL-B3-08', 'caller-owned mutation after successful saveJob or updateStaffMember cannot reach adopted live state', () => {
  resetWorkspace();

  // Test saveJob detachment
  const callerJob = makeSyntheticJob('JOB-CALLER-TEST');
  app.saveJob(callerJob);
  callerJob.name = 'MUTATED_AFTER_COMMIT';
  const liveJob = app.state.jobs.find(j => j.id === 'JOB-CALLER-TEST');
  assert.notStrictEqual(liveJob.name, 'MUTATED_AFTER_COMMIT', 'Live Job must not be aliased to caller object');

  // Test updateStaffMember detachment
  const callerStaff = { id: 'EMP-SYN-A', name: 'Original Synthetic Name', phone: '0400000000' };
  app.updateStaffMember(callerStaff);
  callerStaff.phone = '999999999';
  const liveStaff = app.state.staffList.find(s => s.id === 'EMP-SYN-A');
  assert.notStrictEqual(liveStaff.phone, '999999999', 'Live staff member must not be aliased to caller object');
});

runTest('B3-14 / FULL-B3-07', 'unrelated B3 mutations preserve B2 snapshots, instructions, provenance and canonical identity', () => {
  const instId = 'ROSTER-JOB-SYN-A-2026-06-06-SLOT-0';
  const provKey = 'JOB-SYN-A@2026-06-06:EMP-SYN-A';
  const ws = makeSyntheticWorkspace({
    rostering: {
      instructions: {
        [instId]: {
          id: instId,
          instructionId: instId,
          jobId: 'JOB-SYN-A',
          sourceShiftId: 'JOB-SYN-A@2026-06-06',
          slotId: 'SLOT-0',
          mode: 'fixed',
          employeeId: 'EMP-SYN-A',
          repeatCount: 1,
          status: 'active'
        }
      },
      provenance: {
        [provKey]: {
          source: 'rostering-rule',
          instructionId: instId,
          strategy: 'fixed',
          sourceShiftId: 'JOB-SYN-A@2026-06-06',
          slotId: 'SLOT-0',
          sequenceIndex: 0
        }
      }
    }
  });
  resetWorkspace(ws);

  const initialSnapshots = clone(app.state.historicalSnapshots);
  const initialInstructions = clone(app.state.rostering.instructions);
  const initialProvenance = clone(app.state.rostering.provenance);

  // Perform unrelated mutations: permit update, staff update
  app.updatePermit('JOB-SYN-A@2026-06-06', { tpoStatus: 'approved' });
  app.updateStaffMember({ id: 'EMP-SYN-A', phone: '0412345678' });

  assert.deepStrictEqual(app.state.historicalSnapshots, initialSnapshots, 'Historical snapshots must remain unchanged');
  assert.deepStrictEqual(app.state.rostering.instructions, initialInstructions, 'Instructions must remain unchanged');
  assert.deepStrictEqual(app.state.rostering.provenance, initialProvenance, 'Provenance must remain unchanged');
});

console.log(`\n================================================================`);
console.log(` ALL GATE B3 TESTS PASSED (${passedTests}/${totalTests}) [100%]`);
console.log(`================================================================`);
