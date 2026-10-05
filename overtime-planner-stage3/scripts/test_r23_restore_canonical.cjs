'use strict';

const assert = require('assert');
const path = require('path');
const offlineDir = path.resolve(__dirname, '..');

// 1. Setup Mock DOM & Environment
class MockStorage {
  constructor() {
    this.store = {};
    this.failWrites = false;
  }
  getItem(k) { return this.store.hasOwnProperty(k) ? this.store[k] : null; }
  setItem(k, v) {
    if (this.failWrites) throw new Error('SIMULATED_STORAGE_FAILURE: QuotaExceededError');
    this.store[k] = String(v);
  }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

const mockStorage = new MockStorage();
global.window = {
  HortOpsData: {},
  HortOpsScheduler: {
    DEFAULT_BUDGET_SETTINGS: { hourlyBaseRate: 44.50, mealAllowance: 24.80 },
    clearBoundaryCache: () => {}
  },
  HortOpsHeader: {
    updateStorageHealth: () => {},
    updateStorageHealthIndicator: () => {}
  },
  localStorage: mockStorage
};
global.localStorage = mockStorage;
global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};

// 2. Load Core Modules
require(path.join(offlineDir, 'js/data/holidays.js'));
require(path.join(offlineDir, 'js/utils/dateUtils.js'));
require(path.join(offlineDir, 'js/utils/storage/schemaValidator.js'));
require(path.join(offlineDir, 'js/utils/storage/migrationEngine.js'));
require(path.join(offlineDir, 'js/utils/storage/storageDriver.js'));
require(path.join(offlineDir, 'js/utils/storage.js'));
require(path.join(offlineDir, 'js/utils/scheduler/engine.js'));
require(path.join(offlineDir, 'js/utils/scheduler.js'));
require(path.join(offlineDir, 'js/utils/userCsvParser.js'));
require(path.join(offlineDir, 'js/utils/reconciliationEngine.js'));
require(path.join(offlineDir, 'js/app.js'));

const app = window.HortOpsApp;
const storage = window.HortOpsStorage;

app.recomputeDigest = () => {};
app.renderCurrentView = () => {};

console.log('=== RUNNING R23-B3 RESTORE CANONICAL EQUIVALENCE TEST ===');

// Setup established initial workspace
app.init();
assert.strictEqual(app.state.jobs.length, 0);

// Provide a partial current-v2 restore payload (omits budgetSettings and uiState)
const partialRestore = {
  schemaVersion: 2,
  jobs: [{
    id: 'JOB-R23-1',
    name: 'R23 Tree Trimming',
    type: 'overtime',
    status: 'active',
    frequencyType: 'one_off',
    targetDate: '2026-07-18',
    startTime: '07:00',
    durationHours: 8,
    crewSize: 1
  }],
  roster: [{
    id: 'EMP-R23-1',
    name: 'Synthetic Operative 999',
    userType: 'Worker',
    email: 'op999@synthetic.local',
    department: 'Horticulture',
    team: 'Arboriculture',
    role: 'Operational Staff',
    isContractor: false,
    isPlantOperator: false,
    status: 'active'
  }],
  assignments: {},
  permits: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {}
  // budgetSettings and uiState deliberately omitted
};

// 1. Perform partial restore
const restoreRes = app.restoreWorkspaceJson(partialRestore);
assert.strictEqual(restoreRes, true, 'Partial restore should succeed');

// 2. Verify Live State has canonical defaults
assert.strictEqual(app.state.jobs.length, 1);
assert.strictEqual(app.state.jobs[0].id, 'JOB-R23-1');
assert.strictEqual(app.state.budgetSettings.hourlyBaseRate, 44.50);
assert.strictEqual(app.state.activeView, 'forward_planner');
assert.strictEqual(app.state.currentYear, 2026);
console.log('  [PASS] Live state adopted canonical defaults for omitted domains');

// 3. Verify readVerifiedCommittedV2 has exact matching canonical defaults in committed bytes
const committed = storage.readVerifiedCommittedV2();
assert.strictEqual(committed.ok, true, 'Storage read should be ok');
assert.strictEqual(committed.data.jobs.length, 1);
assert.strictEqual(committed.data.budgetSettings.hourlyBaseRate, 44.50, 'Committed storage must contain canonical budgetSettings');
assert.strictEqual(committed.data.uiState.activeView, 'forward_planner', 'Committed storage must contain canonical uiState');
assert.strictEqual(committed.data.uiState.currentYear, 2026);
console.log('  [PASS] Committed bytes match live state canonical defaults exactly');

// 4. Verify Cold app.init() reload yields exact same budgetSettings and uiState
app.state = {}; // clear live memory
app.init(); // cold reload from storage
assert.strictEqual(app.state.jobs.length, 1);
assert.strictEqual(app.state.jobs[0].id, 'JOB-R23-1');
assert.strictEqual(app.state.budgetSettings.hourlyBaseRate, 44.50, 'Cold reload must have canonical hourlyBaseRate');
assert.strictEqual(app.state.activeView, 'forward_planner');
assert.strictEqual(app.state.currentYear, 2026);
console.log('  [PASS] Cold app.init() reload is canonically equivalent to live state');

// 5. Verify exported canonical envelope round-trip matches live and storage
const exportProjection = {
  schemaVersion: 2,
  jobs: app.state.jobs,
  roster: app.state.staffList,
  assignments: app.state.customAssignments,
  rostering: app.state.rostering,
  permits: app.state.customPermits,
  budgetSettings: app.state.budgetSettings,
  historicalSnapshots: app.state.historicalSnapshots,
  uiState: {
    activeView: app.state.activeView,
    currentYear: app.state.currentYear
  }
};
const exportEnvelope = storage.createWorkspaceEnvelope(exportProjection);
assert(exportEnvelope, 'Canonical export envelope should be built');
assert.strictEqual(exportEnvelope.budgetSettings.hourlyBaseRate, 44.50);
assert.strictEqual(exportEnvelope.uiState.activeView, 'forward_planner');
console.log('  [PASS] Canonical export envelope preserves canonical defaults');

// 6. Verify persistence write failure leaves prior live state and prior storage bytes untouched
const preFailLiveJobs = JSON.parse(JSON.stringify(app.state.jobs));
const preFailRawBytes = mockStorage.getItem('hort_ops_workspace_v2');

mockStorage.failWrites = true;
const invalidRestorePayload = {
  schemaVersion: 2,
  jobs: [{
    id: 'JOB-FAIL-1',
    name: 'Should Not Persist',
    type: 'overtime',
    status: 'active',
    frequencyType: 'one_off',
    targetDate: '2026-07-18',
    startTime: '07:00',
    durationHours: 8,
    crewSize: 1
  }],
  roster: [],
  assignments: {},
  permits: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {}
};

const failRes = app.restoreWorkspaceJson(invalidRestorePayload);
mockStorage.failWrites = false;

assert.strictEqual(failRes, false, 'Restore must fail when storage throws');
assert.deepStrictEqual(app.state.jobs, preFailLiveJobs, 'Prior live state must remain untouched on write failure');
assert.strictEqual(mockStorage.getItem('hort_ops_workspace_v2'), preFailRawBytes, 'Prior storage bytes must remain untouched on write failure');
console.log('  [PASS] Persistence failure leaves prior live state and storage bytes untouched');

console.log('\n================================================================');
console.log(' ALL R23-B3 RESTORE CANONICAL EQUIVALENCE CHECKS PASSED (100%)');
console.log('================================================================\n');
