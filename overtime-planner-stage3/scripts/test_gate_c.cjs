'use strict';

/**
 * Stage 1 Gate C Test Suite: Development Seed Isolation & Clean-Slate Verification
 *
 * Assertions:
 *   C-01: Zero prototype personal data in compiled release bundles (no @adelaidecitycouncil.com, no real names).
 *   C-02: Absolute clean-slate boot structure: Schema v2 envelope, non-recovery, healthy status.
 *   C-03: All six views render error-free on zero-job / zero-staff workspace.
 *   C-04: Operational CRUD on clean-slate: saveJob, importStaffMembers, atomic persistence, round-trip reload.
 *   C-05: Non-destruction of established user workspace upon load.
 *   C-06: Verified obsolete write-path deprecation (updateShiftStaff fail-closed).
 *   C-07: Single-file distribution byte-identical build parity.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('=== RUNNING STAGE 1 GATE C ACCEPTANCE TEST SUITE ===');

const offlineDir = path.resolve(__dirname, '..');

// 1. Mock Storage Environment
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

global.window = {
  localStorage: mockStorage,
  HortOpsHeader: {
    updateStorageHealth: () => {},
    updateStorageHealthIndicator: () => {}
  }
};
global.localStorage = mockStorage;
global.alert = () => {};
global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};

// 2. Load Modules
function req(p) { require(path.join(offlineDir, p)); }

req('js/data/holidays.js');
req('js/data/initialJobs.js');
req('js/data/staffRoster.js');
req('js/data/historicalOccurrences.js');
req('js/utils/icons.js');
req('js/utils/securityUtils.js');
req('js/utils/dateUtils.js');
req('js/utils/storage/schemaValidator.js');
req('js/utils/storage/migrationEngine.js');
req('js/utils/storage/storageDriver.js');
req('js/utils/storage.js');
req('js/utils/eligibilityEngine.js');
req('js/utils/rostering/engine.js');
req('js/utils/rostering/commitmentPlanner.js');
req('js/utils/scheduler/costCalculator.js');
req('js/utils/scheduler/engine.js');
req('js/utils/scheduler.js');
req('js/utils/userCsvParser.js');
req('js/utils/reconciliationEngine.js');
req('js/components/jobEditModal/formValidator.js');
req('js/components/forwardPlanner.js');
req('js/components/calendarView.js');
req('js/components/jobRegistry.js');
req('js/components/staffRegistry.js');
req('js/components/peakWeekends.js');
req('js/components/analytics.js');
req('js/app.js');

const app = window.HortOpsApp;
const storage = window.HortOpsStorage;

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// -------------------------------------------------------------
// Test C-01: Privacy & Development Seed Isolation in Bundles
// -------------------------------------------------------------
const indexPath = path.join(offlineDir, 'index.html');
const distPath = path.join(offlineDir, 'dist', 'hort_ops_offline_planner.html');
assert(fs.existsSync(indexPath), 'index.html must exist');
assert(fs.existsSync(distPath), 'dist/hort_ops_offline_planner.html must exist');

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const distHtml = fs.readFileSync(distPath, 'utf8');

// Non-identifying privacy & hygiene pattern checks (R23-P1 / GC-PRIVACY)
const forbiddenDomainRegex = /@adelaidecitycouncil\.com/i;
assert(!forbiddenDomainRegex.test(indexHtml), 'index.html must not contain council email domains');
assert(!forbiddenDomainRegex.test(distHtml), 'dist HTML must not contain council email domains');

// Structural check: confirm all rostered fixtures adhere strictly to synthetic identities
const staffFixture = require('../js/data/staffRoster.js');
const rosterList = window.HortOpsData.STAFF_ROSTER || [];
assert(rosterList.length === 253, 'Expected 253 staff records in fixture');
for (const s of rosterList) {
  assert(/^Synthetic (John )?Operative \d+$/.test(s.name), `Staff member ${s.id} does not use synthetic name pattern`);
  assert(/@synthetic(\.council)?\.local$/.test(s.email), `Staff member ${s.id} does not use synthetic email pattern`);
}

// Development and sample operational masters must not exist in distribution root
assert(!fs.existsSync(path.join(offlineDir, 'User_table.csv')), 'User_table.csv must not exist in distribution root');
assert(!fs.existsSync(path.join(offlineDir, 'sample-overtime-source.json')), 'sample-overtime-source.json must not exist in distribution root');
console.log('  [PASS] C-01: Zero prototype personal data and council email addresses in compiled distribution bundles.');

// -------------------------------------------------------------
// Test C-02: Clean-Slate Boot Structure & Schema v2 Invariant
// -------------------------------------------------------------
mockStorage.clear();
const cleanSlateWs = storage.loadWorkspace([], [], window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS);
assert.strictEqual(cleanSlateWs.schemaVersion, 2, 'Clean-slate boot must produce Schema 2');
assert.strictEqual(cleanSlateWs.recoveryRequired, false, 'Clean-slate boot must not enter recovery');
assert.strictEqual(Array.isArray(cleanSlateWs.jobs), true, 'Clean-slate jobs must be an array');
assert.strictEqual(cleanSlateWs.jobs.length, 0, 'Clean-slate jobs must be empty');
assert.strictEqual(Array.isArray(cleanSlateWs.roster), true, 'Clean-slate roster must be an array');
assert.strictEqual(cleanSlateWs.roster.length, 0, 'Clean-slate roster must be empty');
assert.strictEqual(typeof cleanSlateWs.historicalSnapshots, 'object', 'Clean-slate historicalSnapshots must be an object');
assert.strictEqual(Object.keys(cleanSlateWs.historicalSnapshots).length, 0, 'Clean-slate historicalSnapshots must be empty');
console.log('  [PASS] C-02: Absolute clean-slate boot structure: Schema v2 envelope with zero inherited operational data.');

// -------------------------------------------------------------
// Test C-03: View Rendering Robustness on Zero-Entity Workspace
// -------------------------------------------------------------
app.state = {
  schemaVersion: 2,
  jobs: [],
  staffList: [],
  customAssignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  customPermits: {},
  budgetSettings: { annualBudgetCap: 50000 },
  allShifts: [],
  clashCount: 0,
  activeView: 'forward_planner',
  currentYear: 2026,
  storageStatus: 'saved'
};

const views = ['forward_planner', 'calendar', 'job_manager', 'staff_registry', 'peak_weekends', 'analytics'];
for (const v of views) {
  app.state.activeView = v;
  assert.doesNotThrow(() => {
    app.renderCurrentView();
  }, `View "${v}" must render error-free on empty clean-slate state`);
}
console.log('  [PASS] C-03: All six views render error-free on zero-job / zero-staff workspace.');

// -------------------------------------------------------------
// Test C-04: Clean-Slate Operational CRUD & State Round-Trip
// -------------------------------------------------------------
mockStorage.clear();
app.init();
assert.strictEqual(app.state.jobs.length, 0, 'App init on clean storage starts with 0 jobs');
assert.strictEqual(app.state.staffList.length, 0, 'App init on clean storage starts with 0 staff');

const synthJob = {
  id: 'job-clean-101',
  name: 'Parklands Weekend Care',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorWeek: 1,
  anchorDate: '2026-01-03',
  targetDate: '2026-01-03',
  startTime: '07:00 AM',
  durationHours: 6,
  crewSize: 1,
  crewSizeRequired: 1,
  preferredDay: 'saturday',
  status: 'active',
  category: 'Inspection',
  color: '#10b981',
  defaultDepartment: 'Horticulture',
  primaryDepartment: 'Horticulture'
};

const jobRes = app.saveJob(synthJob);
assert.strictEqual(jobRes.success, true, 'Saving a valid Job on clean-slate must succeed');
assert.strictEqual(app.state.jobs.length, 1, 'Live jobs must reflect newly added Job');

const synthStaff = [
  {
    id: 'STAFF-SYN-001',
    name: 'Synthetic Operative One',
    department: 'Horticulture',
    team: 'Parklands',
    crew: 'Parklands Team A',
    status: 'active',
    role: 'Operational Staff',
    isPlantOperator: false
  }
];

const staffRes = app.importStaffMembers(synthStaff);
assert.strictEqual(staffRes.success, true, 'Importing synthetic staff on clean-slate must succeed');
assert.strictEqual(app.state.staffList.length, 1, 'Live roster must reflect imported staff');

// Verify committed bytes
const committed = storage.readVerifiedCommittedV2();
assert.strictEqual(committed.ok, true, 'Storage baseline must be verified readable');
assert.strictEqual(committed.data.jobs.length, 1, 'Committed storage must have 1 job');
assert.strictEqual(committed.data.roster.length, 1, 'Committed storage must have 1 staff member');

// Reload app and verify persistence integrity
app.init();
assert.strictEqual(app.state.jobs.length, 1, 'Reloaded state must retain saved job');
assert.strictEqual(app.state.staffList.length, 1, 'Reloaded state must retain saved staff member');
assert.strictEqual(app.state.jobs[0].id, 'job-clean-101');
assert.strictEqual(app.state.staffList[0].id, 'STAFF-SYN-001');
console.log('  [PASS] C-04: Clean-slate operational CRUD: saveJob, importStaffMembers, atomic persistence and reload.');

// -------------------------------------------------------------
// Test C-05: Non-Destruction of Established User Workspace
// -------------------------------------------------------------
const establishedEnvelope = storage.createWorkspaceEnvelope({
  schemaVersion: 2,
  jobs: [{ id: 'est-job-1', name: 'Established Job', status: 'active', frequencyType: 'recurring_weeks', intervalWeeks: 2, anchorWeek: 1, anchorDate: '2026-01-03', preferredDay: 'saturday', startTime: '08:00 AM', durationHours: 4, crewSize: 1 }],
  roster: [{ id: 'est-staff-1', name: 'Established Staff', department: 'Horticulture', team: 'Parks', crew: 'Team 1', status: 'active', role: 'Worker' }],
  assignments: { 'est-job-1@2026-01-03': ['est-staff-1'] },
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: { 'est-job-1@2026-01-03': { jobId: 'est-job-1', shiftId: 'est-job-1@2026-01-03', date: '2026-01-03', startTime: '08:00 AM', durationHours: 4, assignedStaff: ['est-staff-1'] } },
  permits: {},
  budgetSettings: { annualBudgetCap: 75000 },
  uiState: { activeView: 'calendar', currentYear: 2026 }
});

storage.saveWorkspace(establishedEnvelope);
app.init();

assert.strictEqual(app.state.jobs.length, 1, 'Established jobs must remain untouched');
assert.strictEqual(app.state.jobs[0].id, 'est-job-1');
assert.strictEqual(app.state.staffList.length, 1, 'Established staff must remain untouched');
assert.strictEqual(app.state.historicalSnapshots['est-job-1@2026-01-03'].jobId, 'est-job-1');
assert.strictEqual(app.state.activeView, 'calendar');
console.log('  [PASS] C-05: Established user workspaces are loaded faithfully without destruction or forced reset.');

// -------------------------------------------------------------
// Test C-06: Verified Obsolete Write-Side Deprecation
// -------------------------------------------------------------
assert.strictEqual(typeof app.updateShiftStaff, 'function', 'updateShiftStaff must exist as deprecated stub');
assert.strictEqual(app.updateShiftStaff('any-shift', ['any-staff']), false, 'updateShiftStaff must fail-closed');
console.log('  [PASS] C-06: Obsolete write-side updateShiftStaff strictly deprecated and fails closed.');

// -------------------------------------------------------------
// Test C-07: Single-File Distribution Parity & Byte Identity
// -------------------------------------------------------------
const hashIndex = sha256File(indexPath);
const hashDist = sha256File(distPath);
assert.strictEqual(hashIndex, hashDist, 'index.html and dist/hort_ops_offline_planner.html must have identical SHA-256');
console.log(`  [PASS] C-07: Single-file distribution verified byte-identical (SHA-256: ${hashIndex}).`);

console.log('\n================================================================');
console.log(' ALL STAGE 1 GATE C ACCEPTANCE TESTS PASSED (100%)');
console.log('================================================================\n');
