'use strict';
/**
 * Review 29 Comprehensive Verification Suite:
 * 1. P0 Negative canonical-input matrix across all authoritative and metadata domains.
 * 2. P0 Allocation shift-contract probe (missing-jobName repeat reduction resilience).
 */
const assert = require('assert');
const path = require('path');

// Setup clean DOM / Window Mock
const storageStore = {};
global.window = {
  localStorage: {
    getItem: (k) => (k in storageStore ? storageStore[k] : null),
    setItem: (k, v) => { storageStore[k] = String(v); },
    removeItem: (k) => { delete storageStore[k]; },
    clear: () => { for (const k in storageStore) delete storageStore[k]; }
  },
  alert: (msg) => { console.log('  [ALERT FULL]:', String(msg)); },
    scrollTo: () => {}
};
global.localStorage = global.window.localStorage;
global.alert = global.window.alert;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Load dependencies
require('../js/data/holidays.js');
require('../js/utils/icons.js');
require('../js/utils/securityUtils.js');
require('../js/utils/dateUtils.js');
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
require('../js/utils/userCsvParser.js');
require('../js/utils/reconciliationEngine.js');
require('../js/utils/warningUtils.js');
require('../js/utils/modalUtils.js');
require('../js/app.js');
require('../js/components/staffAssignModal.js');

const app = window.HortOpsApp;
const storage = window.HortOpsStorage;
const STORAGE_KEY = 'hort_ops_planner_workspace_v2';

console.log('================================================================');
console.log(' REVIEW 29 VERIFICATION: NEGATIVE CANONICAL DOMAIN MATRIX & SHIFT RESILIENCE');
console.log('================================================================\n');

function resetValidWorkspace() {
  storageStore[STORAGE_KEY] = JSON.stringify({
    schemaVersion: 2,
    lastSaved: new Date().toISOString(),
    jobs: [
      { id: 'JOB-TEST-1', name: 'Test Job 1', status: 'active', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-06-06', targetDate: '2026-06-06', startTime: '08:00', durationHours: 8, crewSize: 1, category: 'Mowing' }
    ],
    roster: [
      { id: 'EMP-001', name: 'Synthetic Operative 1', role: 'Operator', isPlantOperator: true, active: true }
    ],
    assignments: {
      'JOB-TEST-1@2026-06-06': ['EMP-001']
    },
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {
      'JOB-TEST-1@2026-06-06': {
        shiftId: 'JOB-TEST-1@2026-06-06',
        jobId: 'JOB-TEST-1',
        date: '2026-06-06',
        startTime: '08:00',
        durationHours: 8,
        assignedStaffIds: ['EMP-001'],
        recordType: 'scheduled_commitment',
        recordedAt: '2026-06-01T00:00:00.000Z'
      }
    },
    permits: {},
    budgetSettings: { annualTarget: 50000, defaultStandardHoursPerShift: 8 },
    uiState: { activeView: 'forward_planner', currentYear: 2026 },
    recoveryRequired: false
  });
  app.init();
  app.state.staffList = Array.isArray(app.state.roster) ? app.state.roster : [];
}

// -----------------------------------------------------------------------------
// PART 1: NEGATIVE CANONICAL INPUT MATRIX (R29-01)
// -----------------------------------------------------------------------------
console.log('>>> [PART 1] Negative Canonical Input Matrix across all 8 Domains');

const testDomains = [
  { domain: 'jobs', invalidValues: [null, 'invalid_string', 12345, { foo: 'bar' }], isArray: true },
  { domain: 'roster', invalidValues: [null, 'invalid_string', 12345, { foo: 'bar' }], isArray: true },
  { domain: 'assignments', invalidValues: [null, 'invalid_string', 12345, [1, 2, 3]], isArray: false },
  { domain: 'rostering', invalidValues: [null, 'invalid_string', 12345, [1, 2, 3]], isArray: false },
  { domain: 'historicalSnapshots', invalidValues: [null, 'invalid_string', 12345, [1, 2, 3]], isArray: false },
  { domain: 'permits', invalidValues: [null, 'invalid_string', 12345, [1, 2, 3]], isArray: false },
  { domain: 'budgetSettings', invalidValues: [null, 'invalid_string', 12345, [1, 2, 3]], isArray: false },
  { domain: 'uiState', invalidValues: [null, 'invalid_string', 12345, [1, 2, 3]], isArray: false }
];

testDomains.forEach(td => {
  td.invalidValues.forEach(badVal => {
    resetValidWorkspace();
    const storedBefore = storageStore[STORAGE_KEY];
    const liveBefore = JSON.stringify(app.state);

    // Test 1: Live app.state corruption
    app.state[td.domain] = badVal;
    const saveRes = app.saveCurrentWorkspace();
    assert.strictEqual(saveRes, false, `Live app.state.${td.domain} = ${JSON.stringify(badVal)} must fail saveCurrentWorkspace()`);
    assert.strictEqual(storageStore[STORAGE_KEY], storedBefore, `Live app.state.${td.domain} failure must leave storage bytes untouched`);

    // Test 2: Explicit proposal override corruption
    resetValidWorkspace();
    const storedBefore2 = storageStore[STORAGE_KEY];
    const overridePayload = {};
    overridePayload[td.domain] = badVal;
    const propRes = app._commitCanonicalProposal(overridePayload);
    assert.strictEqual(propRes.success, false, `proposalOverrides.${td.domain} = ${JSON.stringify(badVal)} must fail _commitCanonicalProposal`);
    assert.strictEqual(storageStore[STORAGE_KEY], storedBefore2, `proposalOverrides failure must leave storage bytes untouched`);
  });
  console.log(`  [PASS] Domain '${td.domain}': all ${td.invalidValues.length} negative invalid/null inputs fail closed without storage mutation.`);
});

// -----------------------------------------------------------------------------
// PART 2: ALLOCATION SHIFT-CONTRACT PROBE (R29-02)
// -----------------------------------------------------------------------------
console.log('\n>>> [PART 2] Missing-JobName Allocation Resilience & Targeted Repeat Pruning');

window.HortOpsDateUtils.getLocalDateKey = function() { return '2026-01-01'; };
const testStaff = [
  { id: 'EMP-001', name: 'Alice Smith', team: 'Parks', status: 'active', isPlantOperator: true }
];
const testJobs = [
  { id: 'JOB-TEST-1', name: 'Test Job 1', status: 'active', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-06-06', targetDate: '2026-06-06', startTime: '08:00', durationHours: 8, crewSize: 1, category: 'Mowing', primaryTeam: 'Parks', plantOperatorRequired: false }
];

app.state = {
  jobs: JSON.parse(JSON.stringify(testJobs)),
  staffList: JSON.parse(JSON.stringify(testStaff)),
  customAssignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  customPermits: {},
  budgetSettings: {},
  activeView: 'forward_planner',
  currentYear: 2026,
  allShifts: []
};

// Save clean initial envelope
const initEnv = window.HortOpsStorage.createWorkspaceEnvelope({
  schemaVersion: 2,
  jobs: app.state.jobs,
  roster: app.state.staffList,
  assignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  permits: {},
  budgetSettings: {},
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
});
window.HortOpsStorage.saveWorkspace(initEnv);

// Seed a shift that lacks jobName in state.allShifts
const testShiftId = 'JOB-TEST-1@2026-06-06';
app.state.allShifts = [
  {
    shiftId: testShiftId,
    jobId: 'JOB-TEST-1',
    // jobName deliberately undefined to verify resilience
    date: '2026-06-06',
    startTime: '08:00',
    durationHours: 8,
    assignedStaffIds: ['EMP-001'],
    crewSize: 1
  }
];

window.HortOpsStaffAssignModal.activeShiftId = testShiftId;
window.HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-001'];
window.HortOpsStaffAssignModal.stagedSlotStrategies = {
  'EMP-001': { mode: 'fixed', repeatCount: 1 }
};

// Must NOT throw TypeError: Cannot read properties of undefined (reading 'toLowerCase')
assert.doesNotThrow(() => {
  window.HortOpsStaffAssignModal.saveAllocation();
}, 'saveAllocation must not throw when shift.jobName is missing/undefined');

assert(app.state.historicalSnapshots[testShiftId], 'Allocated shift must have snapshot preserved');
assert.strictEqual(app.state.historicalSnapshots[testShiftId].assignedStaffIds[0], 'EMP-001');
console.log('  [PASS] saveAllocation executed cleanly on missing-jobName shift, matched by stable jobId, and preserved snapshot.');

console.log('\n================================================================');
console.log(' ALL REVIEW 29 NEGATIVE DOMAIN & SHIFT RESILIENCE PROBES PASSED (100%)');
console.log('================================================================');
