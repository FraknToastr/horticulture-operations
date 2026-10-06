// Gate B1 Focused Verification Suite: Canonical V2 Persistence & Scheduled-Commitment Validation
// Run natively: node scripts/test_gate_b1.cjs

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// 1. Mock LocalStorage Environment
// ============================================================================
class MockLocalStorage {
  constructor() {
    this.store = {};
    this.throwOnSet = false;
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
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
}

global.window = {
  localStorage: new MockLocalStorage()
};
global.localStorage = global.window.localStorage;

// ============================================================================
// 2. Load Modular Dependencies in Canonical Order
// ============================================================================
require('../js/data/holidays.js');
require('../js/data/initialJobs.js');
require('../js/data/staffRoster.js');
require('../js/data/historicalOccurrences.js');
require('../js/utils/icons.js');
require('../js/utils/securityUtils.js');
require('../js/utils/dateUtils.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/storage/migrationEngine.js');
require('../js/utils/storage/storageDriver.js');
require('../js/utils/storage.js');
require('../js/utils/eligibilityEngine.js');
require('../js/utils/rostering/engine.js');
require('../js/utils/scheduler/costCalculator.js');
require('../js/utils/scheduler/engine.js');
require('../js/utils/scheduler.js');
require('../js/app.js');
require('../js/components/exportModal.js');

const app = window.HortOpsApp;
const storage = window.HortOpsStorage;
const validator = window.HortOpsSchemaValidator;
const exporter = window.HortOpsExportModal;
const STORAGE_KEY = storage.WORKSPACE_STORAGE_KEY;

console.log('=== RUNNING GATE B1 CANONICAL V2 PERSISTENCE & SCHEDULED-COMMITMENT SUITE ===\n');

// ============================================================================
// ASSERTION 1: Fresh Explicit-Empty V2 Workspace Full Lifecycle
// ============================================================================
console.log('>>> [ASSERTION 1] Fresh Explicit-Empty V2 Workspace Full Lifecycle');
localStorage.clear();

const freshEmpty = {
  schemaVersion: 2,
  lastSaved: new Date().toISOString(),
  jobs: [],
  roster: [],
  assignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  permits: {},
  budgetSettings: { annualBudgetCap: 500000, contingencyPercent: 10 },
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};

const emptySaveRes = storage.saveWorkspace(freshEmpty);
assert.strictEqual(emptySaveRes.ok, true, 'Assertion 1.1: Explicit-empty v2 save must succeed');
const emptyStoredBytes = localStorage.getItem(STORAGE_KEY);
assert.ok(emptyStoredBytes, 'Assertion 1.2: Empty workspace bytes must be persisted');

app.init();
assert.strictEqual(app.state.recoveryRequired, false, 'Assertion 1.3: Empty workspace must not trigger recovery mode');
assert.strictEqual(app.state.jobs.length, 0, 'Assertion 1.4: Jobs must be empty array');
assert.deepStrictEqual(app.state.historicalSnapshots, {}, 'Assertion 1.5: historicalSnapshots must be empty map');

let downloadedEmpty = null;
const origDownload = exporter.downloadFile;
exporter.downloadFile = function(content) { downloadedEmpty = content; };

const emptyExportRes = exporter.exportBackupJson();
assert.strictEqual(emptyExportRes, true, 'Assertion 1.6: exportBackupJson must succeed on empty workspace');
assert.ok(downloadedEmpty, 'Assertion 1.7: Backup JSON must be downloaded');

const prepEmptyRes = storage.prepareWorkspaceJsonImport(downloadedEmpty);
assert.strictEqual(prepEmptyRes.success, true, 'Assertion 1.8: prepareWorkspaceJsonImport must succeed');
const restoreEmptyRes = app.restoreWorkspaceJson(prepEmptyRes.data);
assert.strictEqual(restoreEmptyRes, true, 'Assertion 1.9: restoreWorkspaceJson must succeed');
assert.deepStrictEqual(app.state.historicalSnapshots, {}, 'Assertion 1.10: Restored state must retain empty snapshots');

console.log('  [PASS] Assertion 1: Fresh explicit-empty v2 workspace successfully executes save -> reload -> export -> restore.\n');

// ============================================================================
// ASSERTION 2: Real Current-V2 Scheduled Commitments with Observed Time Formats
// ============================================================================
console.log('>>> [ASSERTION 2] Real Current-V2 Commitments with Observed Time Formats');
localStorage.clear();

const instId = 'ROSTER-job-parks-1-2026-06-06-SLOT-0';

const validObservedBase = {
  schemaVersion: 2,
  lastSaved: '2026-06-06T12:00:00Z',
  jobs: [
    { id: 'job-parks-1', name: 'Parks Main', category: 'Parks', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-06-06', preferredDay: 'saturday', startTime: '08:00 PM', durationHours: 8, crewSize: 2, status: 'active' },
    { id: 'job-irrigation-2', name: 'Irrigation Check', category: 'Irrigation', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-06-07', preferredDay: 'sunday', startTime: '05:00 AM', durationHours: 4, crewSize: 1, status: 'active' },
    { id: 'job-street-3', name: 'Streetscape Sweeping', category: 'Streetscapes', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-06-08', preferredDay: 'monday', startTime: '14:30', durationHours: 6, crewSize: 2, status: 'active' },
    { id: 'job-trees-4', name: 'Tree Pruning', category: 'Trees', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-04-03', preferredDay: 'friday', startTime: '5:00', durationHours: 5, crewSize: 1, status: 'active' },
    { id: 'job-night-5', name: 'Night Works', category: 'Civil', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-06-13', preferredDay: 'saturday', startTime: '22:00', durationHours: 7, crewSize: 3, status: 'active' }
  ],
  roster: [
    { id: 'emp-b1-1', name: 'Alice Smith', role: 'Gardener', primaryTeam: 'Parks', status: 'active', isPlantOperator: false },
    { id: 'emp-b1-2', name: 'Bob Jones', role: 'Operator', primaryTeam: 'Civil', status: 'active', isPlantOperator: true }
  ],
  assignments: {
    'job-parks-1@2026-06-06': ['emp-b1-1', 'emp-b1-2']
  },
  rostering: {
    instructions: {
      [instId]: { id: instId, instructionId: instId, jobId: 'job-parks-1', sourceShiftId: 'job-parks-1@2026-06-06', status: 'historical', mode: 'fixed', employeeId: 'emp-b1-1', slotId: 'SLOT-0', repeatCount: 1 }
    },
    provenance: {
      'job-parks-1@2026-06-06:emp-b1-1': { targetShiftId: 'job-parks-1@2026-06-06', employeeId: 'emp-b1-1', source: 'manual', slotId: 'SLOT-0' }
    }
  },
  historicalSnapshots: {
    'job-parks-1@2026-06-06': {
      shiftId: 'job-parks-1@2026-06-06',
      jobId: 'job-parks-1',
      date: '2026-06-06',
      startTime: '08:00 PM',
      durationHours: 8,
      crewSize: 2,
      assignedStaffIds: ['emp-b1-1', 'emp-b1-2'],
      recordedAt: '2026-06-06T12:00:00Z',
      recordType: 'scheduled_commitment'
    },
    'job-irrigation-2@2026-06-07': {
      shiftId: 'job-irrigation-2@2026-06-07',
      jobId: 'job-irrigation-2',
      date: '2026-06-07',
      startTime: '05:00 AM',
      durationHours: 4,
      crewSize: 1,
      assignedStaffIds: ['emp-b1-1'],
      recordedAt: '2026-06-07T05:00:00Z',
      recordType: 'scheduled_commitment'
    },
    'job-street-3@2026-06-08': {
      shiftId: 'job-street-3@2026-06-08',
      jobId: 'job-street-3',
      date: '2026-06-08',
      startTime: '14:30',
      durationHours: 6,
      crewSize: 2,
      assignedStaffIds: ['emp-b1-2'],
      recordType: 'scheduled_commitment'
    },
    'job-trees-4@2026-06-05': {
      shiftId: 'job-trees-4@2026-06-05',
      jobId: 'job-trees-4',
      date: '2026-06-05',
      startTime: '5:00',
      durationHours: 5,
      crewSize: 1,
      assignedStaffIds: ['emp-b1-1'],
      recordType: 'scheduled_commitment'
    },
    'job-night-5@2026-06-13': {
      shiftId: 'job-night-5@2026-06-13',
      jobId: 'job-night-5',
      date: '2026-06-13',
      startTime: '22:00',
      durationHours: 7,
      crewSize: 3,
      assignedStaffIds: ['emp-b1-1', 'emp-b1-2'],
      recordType: 'historical'
    }
  },
  permits: {},
  budgetSettings: { annualBudgetCap: 500000, contingencyPercent: 10 },
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};

const observedSaveRes = storage.saveWorkspace(validObservedBase);
assert.strictEqual(observedSaveRes.ok, true, 'Assertion 2.1: Valid observed production commitments must pass saveWorkspace');
const observedPersistedBytes = localStorage.getItem(STORAGE_KEY);
assert.ok(observedPersistedBytes, 'Assertion 2.2: Workspace must be persisted');

app.init();
assert.strictEqual(Object.keys(app.state.historicalSnapshots).length, 5, 'Assertion 2.3: All 5 snapshots must reload into app.state');
assert.strictEqual(app.state.historicalSnapshots['job-parks-1@2026-06-06'].startTime, '08:00 PM');
assert.strictEqual(app.state.historicalSnapshots['job-irrigation-2@2026-06-07'].startTime, '05:00 AM');
assert.strictEqual(app.state.historicalSnapshots['job-street-3@2026-06-08'].startTime, '14:30');
assert.strictEqual(app.state.historicalSnapshots['job-trees-4@2026-06-05'].startTime, '5:00');
assert.strictEqual(app.state.historicalSnapshots['job-night-5@2026-06-13'].startTime, '22:00');

let downloadedObserved = null;
exporter.downloadFile = function(c) { downloadedObserved = c; };
assert.strictEqual(exporter.exportBackupJson(), true, 'Assertion 2.4: Exporter must succeed');
assert.ok(downloadedObserved, 'Assertion 2.5: Exported JSON must exist');

const prepObserved = storage.prepareWorkspaceJsonImport(downloadedObserved);
assert.strictEqual(prepObserved.success, true, 'Assertion 2.6: Import preparation must succeed');
assert.strictEqual(app.restoreWorkspaceJson(prepObserved.data), true, 'Assertion 2.7: Restore must succeed');

// Verify byte-for-byte fidelity of all 5 commitment snapshots
const restoredSnapshots = app.state.historicalSnapshots;
assert.strictEqual(Object.keys(restoredSnapshots).length, 5);
assert.deepStrictEqual(restoredSnapshots['job-parks-1@2026-06-06'], validObservedBase.historicalSnapshots['job-parks-1@2026-06-06']);
assert.deepStrictEqual(restoredSnapshots['job-irrigation-2@2026-06-07'], validObservedBase.historicalSnapshots['job-irrigation-2@2026-06-07']);
assert.deepStrictEqual(restoredSnapshots['job-street-3@2026-06-08'], validObservedBase.historicalSnapshots['job-street-3@2026-06-08']);
assert.deepStrictEqual(restoredSnapshots['job-trees-4@2026-06-05'], validObservedBase.historicalSnapshots['job-trees-4@2026-06-05']);
assert.deepStrictEqual(restoredSnapshots['job-night-5@2026-06-13'], validObservedBase.historicalSnapshots['job-night-5@2026-06-13']);

console.log('  [PASS] Assertion 2: All 5 observed production time formats verified through full save -> reload -> export -> restore pipeline.\n');

// ============================================================================
// ASSERTION 3: Strict Validation Rejection on Impossible / Malformed Records
// ============================================================================
console.log('>>> [ASSERTION 3] Strict Validation Rejection on Impossible / Malformed Records');
const baselineBytesBeforeNeg = localStorage.getItem(STORAGE_KEY);

function assertRejectedCommitment(name, mutateFn, expectedErrorRegex) {
  const badEnv = JSON.parse(baselineBytesBeforeNeg);
  const targetKey = 'job-parks-1@2026-06-06';
  mutateFn(badEnv.historicalSnapshots[targetKey], badEnv.historicalSnapshots, badEnv);

  const valRes = validator.validateWorkspaceSchema(badEnv);
  assert.strictEqual(valRes.valid, false, name + ': validateWorkspaceSchema must reject');
  if (expectedErrorRegex) {
    assert.ok(expectedErrorRegex.test(valRes.error), name + ': Error "' + valRes.error + '" must match ' + expectedErrorRegex);
  }

  const saveRes = storage.saveWorkspace(badEnv);
  assert.strictEqual(saveRes.ok, false, name + ': saveWorkspace must reject invalid commitment');
  assert.strictEqual(localStorage.getItem(STORAGE_KEY), baselineBytesBeforeNeg, name + ': Storage bytes must remain 100% unmutated');
}

// 3.1 Impossible calendar dates
assertRejectedCommitment('3.1a: Non-leap year Feb 29 (2026-02-29)', (snap, snaps) => {
  delete snaps['job-parks-1@2026-06-06'];
  snaps['job-parks-1@2026-02-29'] = Object.assign({}, snap, { shiftId: 'job-parks-1@2026-02-29', date: '2026-02-29' });
}, /invalid calendar date/i);

assertRejectedCommitment('3.1b: April 31 (2026-04-31)', (snap, snaps) => {
  delete snaps['job-parks-1@2026-06-06'];
  snaps['job-parks-1@2026-04-31'] = Object.assign({}, snap, { shiftId: 'job-parks-1@2026-04-31', date: '2026-04-31' });
}, /invalid calendar date/i);

assertRejectedCommitment('3.1c: June 31 (2026-06-31)', (snap, snaps) => {
  delete snaps['job-parks-1@2026-06-06'];
  snaps['job-parks-1@2026-06-31'] = Object.assign({}, snap, { shiftId: 'job-parks-1@2026-06-31', date: '2026-06-31' });
}, /invalid calendar date/i);

assertRejectedCommitment('3.1d: Month 13 (2026-13-01)', (snap, snaps) => {
  delete snaps['job-parks-1@2026-06-06'];
  snaps['job-parks-1@2026-13-01'] = Object.assign({}, snap, { shiftId: 'job-parks-1@2026-13-01', date: '2026-13-01' });
}, /invalid calendar date/i);

// 3.2 Invalid clock strings
assertRejectedCommitment('3.2a: Hour 25 (25:00)', (snap) => { snap.startTime = '25:00'; }, /invalid startTime/i);
assertRejectedCommitment('3.2b: Minute 60 (12:60)', (snap) => { snap.startTime = '12:60'; }, /invalid startTime/i);
assertRejectedCommitment('3.2c: Hour 0 in 12-hour clock (00:30 AM)', (snap) => { snap.startTime = '00:30 AM'; }, /invalid startTime/i);
assertRejectedCommitment('3.2d: Hour 13 in 12-hour clock (13:00 PM)', (snap) => { snap.startTime = '13:00 PM'; }, /invalid startTime/i);
assertRejectedCommitment('3.2e: Garbage clock string ("not_a_time")', (snap) => { snap.startTime = 'not_a_time'; }, /invalid startTime/i);
assertRejectedCommitment('3.2f: Missing startTime', (snap) => { delete snap.startTime; }, /missing or invalid startTime/i);

// 3.3 Non-positive or non-finite duration
assertRejectedCommitment('3.3a: Zero duration (0)', (snap) => { snap.durationHours = 0; }, /invalid durationHours/i);
assertRejectedCommitment('3.3b: Negative duration (-5)', (snap) => { snap.durationHours = -5; }, /invalid durationHours/i);
assertRejectedCommitment('3.3c: NaN duration', (snap) => { snap.durationHours = NaN; }, /invalid durationHours/i);

// 3.4 Inconsistent key, shiftId, jobId, date identities
assertRejectedCommitment('3.4a: Key does not match shiftId', (snap) => { snap.shiftId = 'other-job@2026-06-06'; }, /does not match shiftId/i);
assertRejectedCommitment('3.4b: jobId does not match shiftId prefix', (snap) => { snap.jobId = 'mismatched-job'; }, /does not match shiftId prefix/i);
assertRejectedCommitment('3.4c: date does not match shiftId date suffix', (snap) => { snap.date = '2026-06-07'; }, /does not match shiftId date/i);

// 3.5 Malformed assigned staff IDs
assertRejectedCommitment('3.5a: Duplicate staff IDs in assignment array', (snap) => {
  snap.assignedStaffIds = ['emp-b1-1', 'emp-b1-1'];
}, /duplicate assigned staff ID/i);

assertRejectedCommitment('3.5b: Non-string staff ID', (snap) => {
  snap.assignedStaffIds = [12345];
}, /invalid staff ID/i);

assertRejectedCommitment('3.5c: Empty string staff ID', (snap) => {
  snap.assignedStaffIds = ['   '];
}, /invalid staff ID/i);

// 3.6 Invalid crewSize
assertRejectedCommitment('3.6a: Negative crewSize', (snap) => { snap.crewSize = -1; }, /invalid crewSize/i);
assertRejectedCommitment('3.6b: Non-integer crewSize (2.5)', (snap) => { snap.crewSize = 2.5; }, /invalid crewSize/i);

console.log('  [PASS] Assertion 3: All 18 negative malformed commitment scenarios strictly rejected; storage preserved.\n');

// ============================================================================
// ASSERTION 4: Mandatory Evidence Maps & Recognized V1 Migration Intact
// ============================================================================
console.log('>>> [ASSERTION 4] Mandatory Evidence Maps & Recognized V1 Migration');
const validCurrentV2 = JSON.parse(baselineBytesBeforeNeg);

// Missing historicalSnapshots rejects direct save
const missingSnaps = JSON.parse(JSON.stringify(validCurrentV2));
delete missingSnaps.historicalSnapshots;
const missingSnapsSave = storage.saveWorkspace(missingSnaps);
assert.strictEqual(missingSnapsSave.ok, false, 'Assertion 4.1: Missing historicalSnapshots must fail save');
assert.strictEqual(localStorage.getItem(STORAGE_KEY), baselineBytesBeforeNeg, 'Assertion 4.2: Storage untouched');

// Startup with missing historicalSnapshots enters quarantine
localStorage.setItem(STORAGE_KEY, JSON.stringify(missingSnaps));
app.init();
assert.strictEqual(app.state.recoveryRequired, true, 'Assertion 4.3: Missing snapshots on startup must trigger recoveryRequired');
assert.strictEqual(localStorage.getItem(STORAGE_KEY), JSON.stringify(missingSnaps), 'Assertion 4.4: Raw storage bytes quarantined untouched');

// Recognized v1 migration succeeds through prepareWorkspaceJsonImport
localStorage.setItem(STORAGE_KEY, baselineBytesBeforeNeg);
app.init();

const validV1Json = JSON.stringify({
  schemaVersion: 1,
  jobs: [{ id: 'v1-job', name: 'Legacy Job', category: 'Parks', frequencyType: 'recurring_weeks', intervalWeeks: 1, anchorDate: '2026-06-06', preferredDay: 'saturday', startTime: '08:00 AM', durationHours: 6, crewSize: 1, status: 'active' }],
  roster: [{ id: 'v1-emp', name: 'Legacy Employee', role: 'Gardener', status: 'active' }],
  assignments: { 'v1-job@2026-06-06': ['v1-emp'] }
});

const v1Prep = storage.prepareWorkspaceJsonImport(validV1Json);
assert.strictEqual(v1Prep.success, true, 'Assertion 4.5: Recognized v1 JSON import preparation must succeed');
assert.strictEqual(v1Prep.migrated, true, 'Assertion 4.6: Migration flag must be true');
assert.strictEqual(v1Prep.data.schemaVersion, 2, 'Assertion 4.7: Converted schemaVersion must be 2');
assert.deepStrictEqual(v1Prep.data.historicalSnapshots, {}, 'Assertion 4.8: Converted v1 must have canonical empty historicalSnapshots');
assert.deepStrictEqual(v1Prep.data.rostering, { instructions: {}, provenance: {} }, 'Assertion 4.9: Converted v1 must have canonical empty rostering');

console.log('  [PASS] Assertion 4: Mandatory evidence maps strictly enforced; recognized v1 migration verified intact.\n');

// ============================================================================
// ASSERTION 5: Exporter Mandatory Retention Check & Save-Then-Export
// ============================================================================
console.log('>>> [ASSERTION 5] Exporter Mandatory Retention Check & Save-Then-Export');
localStorage.setItem(STORAGE_KEY, baselineBytesBeforeNeg);
app.init();

// 5.1 Missing checkEvidenceKeyRetention fails closed with 0 downloads
let testDownloads = [];
exporter.downloadFile = function(s) { testDownloads.push(s); };

const origRetentionChecker = validator.checkEvidenceKeyRetention;
validator.checkEvidenceKeyRetention = undefined;

const missingRetentionRes = exporter.exportBackupJson();
assert.strictEqual(missingRetentionRes, false, 'Assertion 5.1: Missing retention checker must return false');
assert.strictEqual(testDownloads.length, 0, 'Assertion 5.2: Exactly 0 downloads must be triggered');
assert.strictEqual(localStorage.getItem(STORAGE_KEY), baselineBytesBeforeNeg, 'Assertion 5.3: Storage preserved');

validator.checkEvidenceKeyRetention = origRetentionChecker;

// 5.2 Checked save-then-export includes unsaved live edits
testDownloads = [];
app.state.jobs[0].name = 'Gate B1 Unsaved Live Edit Name';
const exportWithEditRes = exporter.exportBackupJson();
assert.strictEqual(exportWithEditRes, true, 'Assertion 5.4: exportBackupJson must succeed with checked save');
assert.strictEqual(testDownloads.length, 1, 'Assertion 5.5: Exactly 1 download triggered');

const exportedBackupObj = JSON.parse(testDownloads[0]);
assert.strictEqual(exportedBackupObj.jobs[0].name, 'Gate B1 Unsaved Live Edit Name', 'Assertion 5.6: Exported file must contain live unsaved edit');
const storedAfterExportObj = JSON.parse(localStorage.getItem(STORAGE_KEY));
assert.strictEqual(storedAfterExportObj.jobs[0].name, 'Gate B1 Unsaved Live Edit Name', 'Assertion 5.7: Storage must be confirmed persisted');

console.log('  [PASS] Assertion 5: Mandatory retention checker fails closed; checked save-then-export verified.\n');

// ============================================================================
// ASSERTION 6: Failed Restore Non-Mutation & Valid Restore Detached Working Copy
// ============================================================================
console.log('>>> [ASSERTION 6] Failed Restore Non-Mutation & Valid Restore Detached Working Copy');
const storedBytesBeforeRestore = localStorage.getItem(STORAGE_KEY);
const appStateBeforeRestore = JSON.stringify(app.state);

// 6.1 Failed restore leaves storage and memory untouched
const badRestoreCandidate = JSON.parse(storedBytesBeforeRestore);
badRestoreCandidate.historicalSnapshots['job-parks-1@2026-06-06'].durationHours = -99; // invalid

const failedRestoreRes = app.restoreWorkspaceJson(badRestoreCandidate);
assert.strictEqual(failedRestoreRes, false, 'Assertion 6.1: Malformed restore candidate must fail');
assert.strictEqual(localStorage.getItem(STORAGE_KEY), storedBytesBeforeRestore, 'Assertion 6.2: Storage bytes must remain 100% untouched');
assert.strictEqual(JSON.stringify(app.state), appStateBeforeRestore, 'Assertion 6.3: Active app.state must remain 100% untouched');

// 6.2 Valid restore adopts detached working copies
const validIncomingEnvelope = JSON.parse(storedBytesBeforeRestore);
validIncomingEnvelope.budgetSettings.annualBudgetCap = 888888;
validIncomingEnvelope.uiState.activeView = 'analytics';

const validRestoreRes = app.restoreWorkspaceJson(validIncomingEnvelope);
assert.strictEqual(validRestoreRes, true, 'Assertion 6.4: Valid restore must succeed');
assert.strictEqual(app.state.budgetSettings.annualBudgetCap, 888888, 'Assertion 6.5: Live budget adopted');

// Mutate incoming caller envelope post-restore
validIncomingEnvelope.budgetSettings.annualBudgetCap = 111111;
validIncomingEnvelope.uiState.activeView = 'calendar';
assert.strictEqual(app.state.budgetSettings.annualBudgetCap, 888888, 'Assertion 6.6: Live budget must remain detached from caller mutation');
assert.strictEqual(app.state.activeView, 'analytics', 'Assertion 6.7: Live activeView must remain detached from caller mutation');

console.log('  [PASS] Assertion 6: Failed restore leaves state untouched; valid restore adopts detached data.\n');

// ============================================================================
// ASSERTION 7: Single-File HTML Standalone Hash Equivalence
// ============================================================================
console.log('>>> [ASSERTION 7] Single-File HTML Standalone Hash Equivalence');
const indexPath = path.resolve(__dirname, '..', 'index.html');
const distPath = path.resolve(__dirname, '..', 'dist', 'hort_ops_offline_planner.html');

assert.ok(fs.existsSync(indexPath), 'Assertion 7.1: index.html must exist');
assert.ok(fs.existsSync(distPath), 'Assertion 7.2: dist/hort_ops_offline_planner.html must exist');

const indexBytes = fs.readFileSync(indexPath);
const distBytes = fs.readFileSync(distPath);
const indexSha = crypto.createHash('sha256').update(indexBytes).digest('hex');
const distSha = crypto.createHash('sha256').update(distBytes).digest('hex');

assert.strictEqual(indexSha, distSha, 'Assertion 7.3: index.html and dist bundle must have 100% identical SHA-256');
assert.ok(indexBytes.length > 500000, 'Assertion 7.4: Compiled standalone bundle must be substantial (>500KB)');

console.log('  [PASS] Assertion 7: Both standalone HTML distributions match byte-for-byte (' + indexSha.slice(0, 16) + '...).\n');

// ============================================================================
// ASSERTION 8: Independent Peer Review 13 Discriminating Probes
// ============================================================================
console.log('>>> [ASSERTION 8] Independent Peer Review 13 Discriminating Probes');

const r13Shift = 'job-one@2026-09-26';
function r13Workspace() {
  return {
    schemaVersion: 2,
    lastSaved: '2026-09-25T11:00:00.000Z',
    jobs: [{ id: 'job-one', name: 'Test job', category: 'Parks', frequencyType: 'one_off', targetDate: '2026-09-26', preferredDay: 'saturday', startTime: '08:00 PM', durationHours: 8, crewSize: 1, status: 'active' }],
    roster: [],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    permits: {},
    budgetSettings: { annualBudgetCap: 10000, contingencyPercent: 10 },
    uiState: { activeView: 'forward_planner', currentYear: 2026 }
  };
}
function r13Snap() {
  return {
    shiftId: r13Shift,
    jobId: 'job-one',
    date: '2026-09-26',
    startTime: '08:00 PM',
    durationHours: 8,
    crewSize: 1,
    assignedStaffIds: ['person-one'],
    recordType: 'scheduled_commitment'
  };
}

assert.strictEqual(storage.saveWorkspace(r13Workspace()).ok, true, 'Review 13 base workspace fixture must save successfully');
const r13Before = localStorage.getItem(STORAGE_KEY);

// Probe 1: B1-01 public constructor must reject jobs:null instead of synthesizing []
const badJobs = r13Workspace();
badJobs.jobs = null;
assert.throws(function() { storage.createWorkspaceEnvelope(badJobs); }, /invalid|jobs|schema/i,
  'Probe 8.1: Public constructor must reject jobs:null instead of synthesizing []');
assert.strictEqual(localStorage.getItem(STORAGE_KEY), r13Before, 'Probe 8.1: Storage bytes must remain untouched');

// Probe 2: B1-01 actual application save must not erase existing jobs on jobs:null
app.init();
const r13PriorApp = localStorage.getItem(STORAGE_KEY);
app.state.jobs = null;
assert.strictEqual(app.saveCurrentWorkspace(), false, 'Probe 8.2: Invalid app state jobs:null must fail saveCurrentWorkspace()');
assert.strictEqual(localStorage.getItem(STORAGE_KEY), r13PriorApp, 'Probe 8.2: Existing jobs must not be erased on jobs:null');

// Reset valid storage
localStorage.setItem(STORAGE_KEY, r13Before);

// Probe 3: B1-02 explicit assignedStaffIds:null is invalid, not optional
const badStaffW = r13Workspace();
badStaffW.historicalSnapshots[r13Shift] = Object.assign(r13Snap(), { assignedStaffIds: null });
assert.strictEqual(validator.validateCurrentV2ForBoundary(badStaffW).valid, false,
  'Probe 8.3: Explicit assignedStaffIds:null must fail validation');
const priorBeforeBadStaff = localStorage.getItem(STORAGE_KEY);
assert.strictEqual(storage.saveWorkspace(badStaffW).ok, false, 'Probe 8.3: Direct save must fail on assignedStaffIds:null');
assert.strictEqual(localStorage.getItem(STORAGE_KEY), priorBeforeBadStaff, 'Probe 8.3: Storage untouched on bad staff save');

// Probe 4: B1-02 explicit crewSize:null is invalid on authoritative record
const badCrewW = r13Workspace();
badCrewW.historicalSnapshots[r13Shift] = Object.assign(r13Snap(), { crewSize: null });
assert.strictEqual(validator.validateCurrentV2ForBoundary(badCrewW).valid, false,
  'Probe 8.4: Explicit crewSize:null must fail validation');

// Probe 5: B1-02 unknown recordType must not authenticate a scheduled commitment
const badRecordTypeW = r13Workspace();
badRecordTypeW.historicalSnapshots[r13Shift] = Object.assign(r13Snap(), { recordType: 'banana' });
assert.strictEqual(validator.validateCurrentV2ForBoundary(badRecordTypeW).valid, false,
  'Probe 8.5: Unknown recordType ("banana") must fail validation');

// Probe 6: B1-03 unverifiedSchedule:true must never be accepted and then treated as verified
const unverifiedW = r13Workspace();
unverifiedW.historicalSnapshots[r13Shift] = Object.assign(r13Snap(), { unverifiedSchedule: true });
const unverifiedVal = validator.validateCurrentV2ForBoundary(unverifiedW);
assert.strictEqual(unverifiedVal.valid, false,
  'Probe 8.6: Authoritative snapshot with unverifiedSchedule:true must be rejected by persistence validator');

console.log('  [PASS] Assertion 8: All 6 Review 13 discriminating probes passed (0 gaps demonstrated).\n');

// ============================================================================
// ASSERTION 9: Independent Peer Review 14 Discriminating Probes (11 Checks)
// ============================================================================
console.log('>>> [ASSERTION 9] Independent Peer Review 14 Discriminating Probes (11 Checks)');

function blankR14() {
  return {
    schemaVersion: 2,
    jobs: [],
    roster: [],
    assignments: {},
    rostering: { instructions: {}, provenance: {} },
    historicalSnapshots: {},
    permits: {},
    budgetSettings: {},
    uiState: {}
  };
}

function illegalCtorR14(input) {
  try { storage.createWorkspaceEnvelope(input); return false; }
  catch(e) { return true; }
}

function rejectedR14(input) {
  try { return validator.validateCurrentV2ForBoundary(input).valid === false; }
  catch(e) { return false; }
}

function baselineR14() {
  localStorage.clear();
  var x = blankR14();
  x.assignments = { 'job-1@2027-01-02': ['staff-1'] };
  var res = storage.saveWorkspace(x);
  if (!res || !res.ok) throw new Error('baseline save failed');
  return localStorage.getItem(STORAGE_KEY);
}

// Probe 9.00: valid explicit-empty v2 accepted
assert.ok(validator.validateCurrentV2ForBoundary(blankR14()).valid && !illegalCtorR14(blankR14()),
  'Probe 9.00: Valid explicit-empty v2 must be accepted');

// Probe 9.01: constructor rejects absent and null assignments
var a91 = blankR14(), b91 = blankR14();
delete a91.assignments;
b91.assignments = null;
assert.ok(illegalCtorR14(a91) && illegalCtorR14(b91),
  'Probe 9.01: Constructor must reject absent and null assignments');

// Probe 9.02: raw save rejects absent and null assignments without byte loss
var orig92 = baselineR14(), a92 = blankR14(), b92 = blankR14();
delete a92.assignments;
b92.assignments = null;
assert.ok(!storage.saveWorkspace(a92).ok && !storage.saveWorkspace(b92).ok && localStorage.getItem(STORAGE_KEY) === orig92,
  'Probe 9.02: Raw save must reject absent and null assignments without byte loss');

// Probe 9.03: app.saveCurrentWorkspace rejects null assignments without byte loss
var orig93 = baselineR14();
app.init();
app.state.customAssignments = null;
assert.ok(app.saveCurrentWorkspace() === false && localStorage.getItem(STORAGE_KEY) === orig93,
  'Probe 9.03: app.saveCurrentWorkspace must reject null assignments without byte loss');

// Probe 9.04: JSON backup rejects null assignments and downloads nothing
var orig94 = baselineR14(), dlCount94 = 0;
app.init();
app.state.customAssignments = null;
exporter.downloadFile = function() { dlCount94++; };
var exportRes94 = exporter.exportBackupJson();
assert.ok(exportRes94 === false && dlCount94 === 0 && localStorage.getItem(STORAGE_KEY) === orig94,
  'Probe 9.04: JSON backup must reject null assignments with 0 downloads');

// Probe 9.05: load of current-v2 missing assignments enters Recovery Required unchanged
var x95 = blankR14();
delete x95.assignments;
localStorage.clear();
var raw95 = JSON.stringify(x95);
localStorage.setItem(STORAGE_KEY, raw95);
var loaded95 = storage.loadWorkspace([], [], {});
assert.ok(loaded95.recoveryRequired === true && localStorage.getItem(STORAGE_KEY) === raw95,
  'Probe 9.05: Stored v2 missing assignments must enter recovery mode without byte mutation');

// Probe 9.06: JSON import and real restore reject absent/null assignments without mutation
var before96 = baselineR14();
app.init();
var origState96 = JSON.stringify(app.state);
var no96 = blankR14();
delete no96.assignments;
var nul96 = blankR14();
nul96.assignments = null;
var impRes96 = storage.prepareWorkspaceJsonImport(JSON.stringify(no96));
var restRes96 = app.restoreWorkspaceJson(nul96);
assert.ok(impRes96.success === false && restRes96 === false &&
  localStorage.getItem(STORAGE_KEY) === before96 && JSON.stringify(app.state) === origState96,
  'Probe 9.06: Import and restore must reject absent/null assignments without state/storage mutation');

// Probe 9.07: reject malformed assignment-map values and IDs
var m1 = blankR14(), m2 = blankR14(), m3 = blankR14(), m4 = blankR14();
m1.assignments = { 'job-1@2027-01-02': 'text' };
m2.assignments = { 'job-1@2027-01-02': [12, null] };
m3.assignments = { 'job-1@2027-01-02': ['', 'emp-1'] };
m4.assignments = { 'job-1@2027-01-02': ['emp-1', 'emp-1'] };
assert.ok(rejectedR14(m1) && rejectedR14(m2) && rejectedR14(m3) && rejectedR14(m4),
  'Probe 9.07: Malformed assignment-map values and IDs must be rejected');

// Probe 9.08: recordType whitelist rejects inherited prototype keys
var k98 = 'job-1@2027-01-02';
var snap98 = { shiftId: k98, jobId: 'job-1', date: '2027-01-02', startTime: '08:00 PM', durationHours: 8, recordType: 'scheduled_commitment' };
assert.strictEqual(validator.validateScheduledCommitment(k98, snap98).valid, true, 'Probe 9.08: Valid scheduled_commitment accepted');
var badPrototypes = ['constructor', 'toString', '__proto__', 'valueOf'];
badPrototypes.forEach(function(protoKey) {
  var sBad = Object.assign({}, snap98, { recordType: protoKey });
  assert.strictEqual(validator.validateScheduledCommitment(k98, sBad).valid, false,
    'Probe 9.08: Inherited prototype key "' + protoKey + '" must be rejected');
});

// Probe 9.09: snapshot employee IDs use prototype-safe duplicate detection
var snap99 = { shiftId: k98, jobId: 'job-1', date: '2027-01-02', startTime: '08:00 PM', durationHours: 8, assignedStaffIds: ['toString'] };
assert.strictEqual(validator.validateScheduledCommitment(k98, snap99).valid, true,
  'Probe 9.09: Employee ID matching Object prototype property must be accepted as unique');

// Probe 9.10: null Job and roster entries reject with normal validation result, not throw
var nullJob = blankR14(), nullRoster = blankR14();
nullJob.jobs = [null];
nullRoster.roster = [null];
assert.ok(rejectedR14(nullJob) && rejectedR14(nullRoster),
  'Probe 9.10: Null Job and roster entries must return validation failure, not throw uncaught error');

console.log('  [PASS] Assertion 9: All 11 Review 14 discriminating probes passed (0 gaps demonstrated).\n');

// ============================================================================
// ASSERTION 10: Independent Peer Review 15 Discriminating Probes (Canonical vs Runtime)
// ============================================================================
console.log('>>> [ASSERTION 10] Independent Peer Review 15 Discriminating Probes (Canonical vs Runtime)');

var r15ShiftId = 'JOB-REVIEW@2027-01-02';

// Probe 10.1: Control canonical assignment persists and reloads
localStorage.clear();
var b10 = blankR14();
b10.assignments[r15ShiftId] = ['EMP-01'];
assert.strictEqual(storage.saveWorkspace(b10).ok, true, 'Probe 10.1: Canonical assignment save must succeed');
var load10 = storage.loadWorkspace([], [], {});
assert.strictEqual(load10.recoveryRequired, false, 'Probe 10.1: Reload must succeed without recovery');
assert.deepStrictEqual(load10.assignments[r15ShiftId], ['EMP-01'], 'Probe 10.1: Exact employee ID preserved');

// Probe 10.2: Alias-only current-v2 is rejected at public boundary
var a10_alias = blankR14();
delete a10_alias.assignments;
a10_alias.customAssignments = {};
a10_alias.customAssignments[r15ShiftId] = ['EMP-02'];
assert.strictEqual(validator.validateCurrentV2ForBoundary(a10_alias).valid, false,
  'Probe 10.2: Alias-only current-v2 must be rejected at public boundary');

// Probe 10.3: Direct save cannot commit unroundtrippable alias-only current v2
localStorage.clear();
var x10 = blankR14();
x10.assignments[r15ShiftId] = ['EMP-01'];
assert.strictEqual(storage.saveWorkspace(x10).ok, true, 'Probe 10.3: Baseline save ok');
var raw10Before = localStorage.getItem(STORAGE_KEY);
assert.strictEqual(storage.saveWorkspace(a10_alias).ok, false, 'Probe 10.3: Alias-only save must return ok:false');
assert.strictEqual(localStorage.getItem(STORAGE_KEY), raw10Before, 'Probe 10.3: Storage bytes must remain untouched');

// Probe 10.4: Contradictory dual assignment maps are rejected, never silently prioritised
var a10_dual = blankR14();
a10_dual.assignments[r15ShiftId] = ['EMP-01'];
a10_dual.customAssignments = {};
a10_dual.customAssignments[r15ShiftId] = ['EMP-02'];
assert.strictEqual(validator.validateCurrentV2ForBoundary(a10_dual).valid, false,
  'Probe 10.4: Contradictory dual assignment maps must be rejected');

// Probe 10.5: Canonical current v2 backup import still validates
var x10_canon = blankR14();
x10_canon.assignments[r15ShiftId] = ['EMP-01'];
assert.strictEqual(storage.prepareWorkspaceJsonImport(JSON.stringify(x10_canon)).success, true,
  'Probe 10.5: Canonical backup import must validate');

// Probe 10.6: Actual app save and backup with state.customAssignments projects to canonical-only
localStorage.clear();
app.init();
app.state.customAssignments = {};
app.state.customAssignments[r15ShiftId] = ['EMP-01'];
assert.strictEqual(app.saveCurrentWorkspace(), true, 'Probe 10.6: App save must succeed with runtime state');
var savedRaw10 = JSON.parse(localStorage.getItem(STORAGE_KEY));
assert.strictEqual(savedRaw10.assignments[r15ShiftId][0], 'EMP-01', 'Probe 10.6: Canonical assignments persisted');
assert.strictEqual(savedRaw10.customAssignments, undefined, 'Probe 10.6: Runtime alias must NOT be persisted in envelope');

// Probe 10.7: Actual backup produces canonical assignments and no customAssignments
var backupDownloaded10 = null;
var oldDl10 = exporter.downloadFile;
exporter.downloadFile = function(content, filename) { backupDownloaded10 = JSON.parse(content); };
assert.strictEqual(exporter.exportBackupJson(), true, 'Probe 10.7: Export backup must succeed');
assert.ok(backupDownloaded10 !== null, 'Probe 10.7: Backup content must be produced');
assert.deepStrictEqual(backupDownloaded10.assignments[r15ShiftId], ['EMP-01'], 'Probe 10.7: Exported backup contains canonical assignments');
assert.strictEqual(backupDownloaded10.customAssignments, undefined, 'Probe 10.7: Exported backup must NOT contain runtime alias');
exporter.downloadFile = oldDl10;

console.log('  [PASS] Assertion 10: All Review 15 discriminating probes and actual app runtime projection verified (0 gaps demonstrated).\n');

// ============================================================================
// ASSERTION 11: Review 16 Canonical Constructor Microclosure & V1 Migration
// ============================================================================
console.log('>>> [ASSERTION 11] Review 16 Canonical Constructor Microclosure & V1 Migration');

var sid16 = 'J01@2027-01-02';
var fresh16 = function() {
  return {
    schemaVersion: 2,
    jobs: [],
    roster: [],
    assignments: {},
    historicalSnapshots: {},
    rostering: { instructions: {}, provenance: {} },
    permits: {},
    budgetSettings: {},
    uiState: {}
  };
};

// Probe 11.1: Constructor rejects alias-only current-v2 input
var alias16 = fresh16();
delete alias16.assignments;
alias16.customAssignments = {};
alias16.customAssignments[sid16] = ['E2'];
assert.throws(function() {
  storage.createWorkspaceEnvelope(alias16);
}, /assignments|Ambiguous/, 'Probe 11.1: Constructor must reject alias-only input');

// Probe 11.2: Constructor rejects conflicting dual-map current-v2 input
var dual16 = fresh16();
dual16.assignments[sid16] = ['E1'];
dual16.customAssignments = {};
dual16.customAssignments[sid16] = ['E2'];
assert.throws(function() {
  storage.createWorkspaceEnvelope(dual16);
}, /Ambiguous current-v2 workspace: customAssignments is a runtime-only field/,
  'Probe 11.2: Constructor must reject conflicting dual-map input before projection');

// Probe 11.3: Constructor accepts canonical input and returns envelope with no runtime alias
var canon16 = fresh16();
canon16.assignments[sid16] = ['E1'];
var env16 = storage.createWorkspaceEnvelope(canon16);
assert.strictEqual(env16.schemaVersion, 2, 'Probe 11.3: Envelope schemaVersion 2');
assert.deepStrictEqual(env16.assignments[sid16], ['E1'], 'Probe 11.3: Canonical assignments retained');
assert.strictEqual(env16.customAssignments, undefined, 'Probe 11.3: Runtime alias must not be present');

// Probe 11.4: Schema v1 alias-only migration normalises to canonical assignments and deletes alias
var migEngine = window.HortOpsMigrationEngine;
var v1Alias16 = { schemaVersion: 1, jobs: [], roster: [], customAssignments: {} };
v1Alias16.customAssignments[sid16] = ['E1'];
var v1MigRes = migEngine.migrateWorkspaceV1toV2(v1Alias16);
assert.deepStrictEqual(v1MigRes.assignments[sid16], ['E1'], 'Probe 11.4: V1 alias migrated to assignments');
assert.strictEqual(v1MigRes.customAssignments, undefined, 'Probe 11.4: V1 alias removed from synthetic v2');

// Probe 11.5: Schema v1 dual-source conflict throws ambiguous recovery error
var v1Dual16 = { schemaVersion: 1, jobs: [], roster: [], assignments: {}, customAssignments: {} };
v1Dual16.assignments[sid16] = ['E1'];
v1Dual16.customAssignments[sid16] = ['E2'];
assert.throws(function() {
  migEngine.migrateWorkspaceV1toV2(v1Dual16);
}, /Ambiguous Schema v1 assignment sources require explicit recovery/,
  'Probe 11.5: V1 dual-source conflict must fail closed with recovery error');

console.log('  [PASS] Assertion 11: Review 16 constructor microclosure and v1 normalisation verified (0 gaps demonstrated).\n');

exporter.downloadFile = origDownload;

console.log('================================================================');
console.log(' ALL GATE B1 CANONICAL PERSISTENCE & VALIDATION TESTS PASSED (100%)');
console.log('================================================================');
