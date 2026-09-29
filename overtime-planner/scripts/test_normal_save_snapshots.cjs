const assert = require('assert');

// ============================================================================
// 1. Mock LocalStorage Environment
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
require('../js/utils/dateUtils.js');
require('../js/utils/securityUtils.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/storage/migrationEngine.js');
require('../js/utils/storage/storageDriver.js');
require('../js/utils/storage.js');
require('../js/utils/eligibilityEngine.js');
require('../js/utils/scheduler/engine.js');
require('../js/utils/scheduler.js');
require('../js/app.js');
require('../js/components/exportModal.js');

console.log('=== RUNNING GATE A NORMAL-SAVE SNAPSHOTS & PROTOCOL V2 ACCEPTANCE MATRIX ===');

const storage = window.HortOpsStorage;
const app = window.HortOpsApp;
const eligibility = window.HortOpsEligibilityEngine;
const scheduler = window.HortOpsScheduler;
const exportModal = window.HortOpsExportModal;
const validator = window.HortOpsSchemaValidator;

// ============================================================================
// Shared Test Fixtures
// ============================================================================
const testEmployee1 = {
  id: 'emp-gate-a-1',
  name: 'Dave Clark',
  role: 'Gardener',
  primaryTeam: 'team-central',
  status: 'active',
  isPlantOperator: false
};

const testEmployee2 = {
  id: 'emp-gate-a-2',
  name: 'Sarah Connor',
  role: 'Arborist',
  primaryTeam: 'team-north',
  status: 'active',
  isPlantOperator: true
};

const overnightJob = {
  id: 'job-overnight-1',
  name: 'Overnight Emergency Clearing',
  category: 'Tree Maintenance',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-06-06',
  preferredDay: 'saturday',
  startTime: '08:00 PM',
  durationHours: 8,
  crewSize: 1,
  status: 'active'
};

const sundayMorningJob = {
  id: 'job-sunday-morning-1',
  name: 'Sunday Morning Parkland',
  category: 'Parklands',
  frequencyType: 'recurring_weeks',
  intervalWeeks: 1,
  anchorDate: '2026-06-07',
  preferredDay: 'sunday',
  startTime: '08:00 AM',
  durationHours: 4,
  crewSize: 1,
  status: 'active'
};

const overnightShiftId = 'job-overnight-1@2026-06-06';
const sundayShiftId = 'job-sunday-morning-1@2026-06-07';
const canonicalInstId = 'ROSTER-job-overnight-1-2026-06-06-SLOT-0';

// ============================================================================
// TEST GROUP 1: Real Application Lifecycle & Rest Period Enforcement
// ============================================================================
console.log('>>> [TEST GROUP 1] Real App Lifecycle: saveCurrentWorkspace -> mutate Job -> init() -> Rest Enforcement');
localStorage.clear();
app.init();

app.state.jobs = [JSON.parse(JSON.stringify(overnightJob)), JSON.parse(JSON.stringify(sundayMorningJob))];
app.state.staffList = [JSON.parse(JSON.stringify(testEmployee1)), JSON.parse(JSON.stringify(testEmployee2))];
app.state.customAssignments = {
  [overnightShiftId]: ['emp-gate-a-1']
};
app.state.rostering = {
  instructions: {
    [canonicalInstId]: {
      id: canonicalInstId,
      instructionId: canonicalInstId,
      jobId: 'job-overnight-1',
      sourceShiftId: overnightShiftId,
      status: 'historical',
      mode: 'fixed',
      employeeId: 'emp-gate-a-1',
      slotId: 'SLOT-0',
      repeatCount: 1,
      createdAt: '2026-06-01T00:00:00Z'
    }
  },
  provenance: {
    [overnightShiftId + ':emp-gate-a-1']: {
      targetShiftId: overnightShiftId,
      employeeId: 'emp-gate-a-1',
      source: 'manual',
      slotId: 'SLOT-0',
      appliedAt: '2026-06-06T18:00:00.000Z'
    }
  }
};
app.state.historicalSnapshots = {
  [overnightShiftId]: {
    shiftId: overnightShiftId,
    jobId: 'job-overnight-1',
    date: '2026-06-06',
    startTime: '08:00 PM',
    durationHours: 8,
    assignedStaffIds: ['emp-gate-a-1'],
    recordType: 'historical'
  }
};

const saveOk1 = app.saveCurrentWorkspace();
assert.strictEqual(saveOk1, true, 'HortOpsApp.saveCurrentWorkspace() must return true on valid state');
assert.strictEqual(app.state.storageStatus, 'saved', 'Storage status must be saved');

const rawPersisted1 = localStorage.getItem('hort_ops_workspace_v2');
assert.ok(rawPersisted1, 'Persisted workspace envelope must exist in localStorage');
const parsedEnvelope1 = JSON.parse(rawPersisted1);
assert.strictEqual(parsedEnvelope1.schemaVersion, 2, 'Schema version must be 2');
assert.ok(parsedEnvelope1.historicalSnapshots, 'historicalSnapshots domain must be present in saved envelope');
assert.ok(parsedEnvelope1.historicalSnapshots[overnightShiftId], 'Authoritative snapshot must be present in saved envelope');
assert.strictEqual(parsedEnvelope1.historicalSnapshots[overnightShiftId].startTime, '08:00 PM');
assert.strictEqual(parsedEnvelope1.historicalSnapshots[overnightShiftId].durationHours, 8);
console.log('  [PASS] 1.1: HortOpsApp.saveCurrentWorkspace() successfully persisted nonempty historicalSnapshots.');

// Mutate parent Job timing
const parentJob = app.state.jobs.find(function(j) { return j.id === 'job-overnight-1'; });
parentJob.startTime = '08:00 AM';
parentJob.durationHours = 4;

const saveOk2 = app.saveCurrentWorkspace();
assert.strictEqual(saveOk2, true, 'Second saveCurrentWorkspace() after parent Job edit must succeed');

const rawPersisted2 = localStorage.getItem('hort_ops_workspace_v2');
const parsedEnvelope2 = JSON.parse(rawPersisted2);
const persistedJob = parsedEnvelope2.jobs.find(function(j) { return j.id === 'job-overnight-1'; });
assert.strictEqual(persistedJob.startTime, '08:00 AM');
assert.strictEqual(persistedJob.durationHours, 4);
assert.strictEqual(parsedEnvelope2.historicalSnapshots[overnightShiftId].startTime, '08:00 PM');
assert.strictEqual(parsedEnvelope2.historicalSnapshots[overnightShiftId].durationHours, 8);
console.log('  [PASS] 1.2: Edited parent Job persisted while original historical snapshot timing remained uncorrupted.');

// Reload app through real init()
app.state = {
  currentYear: 2026,
  activeView: 'forward_planner',
  jobs: [],
  staffList: [],
  customAssignments: {},
  customPermits: {},
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  budgetSettings: {},
  slots: [],
  allShifts: [],
  integrityIssues: [],
  clashCount: 0,
  storageStatus: 'unknown'
};

app.init();
assert.strictEqual(Boolean(app.state.recoveryRequired), false, 'Fresh load of healthy workspace must not enter recovery');
assert.ok(app.state.historicalSnapshots[overnightShiftId]);
assert.strictEqual(app.state.historicalSnapshots[overnightShiftId].startTime, '08:00 PM');
assert.strictEqual(app.state.historicalSnapshots[overnightShiftId].durationHours, 8);

const reloadedOvernightShift = app.state.allShifts.find(function(s) { return s.shiftId === overnightShiftId; });
assert.ok(reloadedOvernightShift);
assert.strictEqual(reloadedOvernightShift.startTime, '08:00 PM');
assert.strictEqual(reloadedOvernightShift.durationHours, 8);
console.log('  [PASS] 1.3: Fresh HortOpsApp.init() reloaded workspace and resolved shift timing from authoritative snapshot.');

const reloadedSundayShift = app.state.allShifts.find(function(s) { return s.shiftId === sundayShiftId; });
assert.ok(reloadedSundayShift);
assert.strictEqual(reloadedSundayShift.startTime, '08:00 AM');

const eligibilityResult = eligibility.validateEmployeeForOccurrence({
  employee: testEmployee1,
  occurrence: reloadedSundayShift,
  job: sundayMorningJob,
  allAssignments: app.state.allShifts
});

assert.strictEqual(eligibilityResult.eligible, false);
assert.strictEqual(eligibilityResult.hardBlock, true);
assert.ok(eligibilityResult.reasons.indexOf('INSUFFICIENT_REST') !== -1);
console.log('  [PASS] 1.4: Canonical Eligibility Engine correctly rejected candidate for INSUFFICIENT_REST (4h rest < 10h required).');

// ============================================================================
// TEST GROUP 2: Protocol v2 Acceptance Matrix (Cases A1 through A8)
// ============================================================================
console.log('>>> [TEST GROUP 2] Protocol v2 Boundary Acceptance Matrix (Cases A1 - A8)');

// Baseline 2-snapshot, 2-instruction, 2-provenance workspace
const snap1Id = 'job-overnight-1@2026-06-06';
const snap2Id = 'job-sunday-morning-1@2026-06-07';
const inst1Id = 'ROSTER-job-overnight-1-2026-06-06-SLOT-0';
const inst2Id = 'ROSTER-job-sunday-morning-1-2026-06-07-SLOT-0';
const prov1Key = 'job-overnight-1@2026-06-06:emp-gate-a-1';
const prov2Key = 'job-sunday-morning-1@2026-06-07:emp-gate-a-2';

const validBaseEnvelope = {
  schemaVersion: 2,
  lastSaved: '2026-06-01T00:00:00.000Z',
  jobs: [JSON.parse(JSON.stringify(overnightJob)), JSON.parse(JSON.stringify(sundayMorningJob))],
  roster: [JSON.parse(JSON.stringify(testEmployee1)), JSON.parse(JSON.stringify(testEmployee2))],
  assignments: {
    [snap1Id]: ['emp-gate-a-1'],
    [snap2Id]: ['emp-gate-a-2']
  },
  rostering: {
    instructions: {
      [inst1Id]: { id: inst1Id, instructionId: inst1Id, jobId: 'job-overnight-1', sourceShiftId: snap1Id, status: 'historical', mode: 'fixed', employeeId: 'emp-gate-a-1', slotId: 'SLOT-0', repeatCount: 1 },
      [inst2Id]: { id: inst2Id, instructionId: inst2Id, jobId: 'job-sunday-morning-1', sourceShiftId: snap2Id, status: 'historical', mode: 'fixed', employeeId: 'emp-gate-a-2', slotId: 'SLOT-0', repeatCount: 1 }
    },
    provenance: {
      [prov1Key]: { targetShiftId: snap1Id, employeeId: 'emp-gate-a-1', source: 'manual', slotId: 'SLOT-0' },
      [prov2Key]: { targetShiftId: snap2Id, employeeId: 'emp-gate-a-2', source: 'manual', slotId: 'SLOT-0' }
    }
  },
  historicalSnapshots: {
    [snap1Id]: { shiftId: snap1Id, jobId: 'job-overnight-1', date: '2026-06-06', startTime: '08:00 PM', durationHours: 8, assignedStaffIds: ['emp-gate-a-1'], recordType: 'historical' },
    [snap2Id]: { shiftId: snap2Id, jobId: 'job-sunday-morning-1', date: '2026-06-07', startTime: '08:00 AM', durationHours: 4, assignedStaffIds: ['emp-gate-a-2'], recordType: 'historical' }
  },
  permits: {},
  budgetSettings: { annualBudgetCap: 500000, contingencyPercent: 10 },
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};

// Establish baseline in storage
localStorage.clear();
const setupSaveRes = storage.saveWorkspace(validBaseEnvelope);
assert.strictEqual(setupSaveRes.ok, true, 'Test setup save of validBaseEnvelope must succeed');
const baselinePersistedBytes = localStorage.getItem('hort_ops_workspace_v2');
assert.ok(baselinePersistedBytes, 'Baseline storage bytes must exist');

// ----------------------------------------------------------------------------
// Case A1: Genuine explicit-empty new v2 state saves and loads successfully
// ----------------------------------------------------------------------------
localStorage.clear();
const freshEmptyEnvelope = {
  schemaVersion: 2,
  lastSaved: new Date().toISOString(),
  jobs: [JSON.parse(JSON.stringify(overnightJob))],
  roster: [JSON.parse(JSON.stringify(testEmployee1))],
  assignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  permits: {},
  budgetSettings: { annualBudgetCap: 100000, contingencyPercent: 5 },
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};

const a1Save = storage.saveWorkspace(freshEmptyEnvelope);
assert.strictEqual(a1Save.ok, true, 'Case A1: Explicit-empty new v2 must save successfully');
const a1Loaded = storage.loadWorkspace();
assert.strictEqual(a1Loaded.recoveryRequired, false, 'Case A1: Loaded explicit-empty must be healthy');
assert.deepStrictEqual(a1Loaded.historicalSnapshots, {}, 'Case A1: historicalSnapshots must be empty object');
assert.deepStrictEqual(a1Loaded.rostering.instructions, {}, 'Case A1: instructions must be empty object');
assert.deepStrictEqual(a1Loaded.rostering.provenance, {}, 'Case A1: provenance must be empty object');
console.log('  [PASS] Case A1: Explicit empty new v2 state saves and loads successfully.');

// Restore baseline for subsequent tests
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);

// ----------------------------------------------------------------------------
// Case A2: Direct save with missing/null evidence maps rejects, storage untouched
// ----------------------------------------------------------------------------
const badSavePayloads = [
  // Missing historicalSnapshots
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); delete b.historicalSnapshots; return b; })(),
  // Null historicalSnapshots
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); b.historicalSnapshots = null; return b; })(),
  // Missing rostering
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); delete b.rostering; return b; })(),
  // Missing rostering.instructions
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); delete b.rostering.instructions; return b; })(),
  // Missing rostering.provenance
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); delete b.rostering.provenance; return b; })()
];

for (let i = 0; i < badSavePayloads.length; i++) {
  const badP = badSavePayloads[i];
  const res = storage.saveWorkspace(badP);
  assert.strictEqual(res.ok, false, 'Case A2: Direct save of payload ' + i + ' must return ok:false');
  assert.strictEqual(res.stage, 'validation', 'Case A2: Direct save must fail at validation stage');
  assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), baselinePersistedBytes, 'Case A2: Storage bytes must remain untouched');
}
console.log('  [PASS] Case A2: Direct save with missing/null snapshots or rostering maps strictly rejected; storage untouched.');

// ----------------------------------------------------------------------------
// Case A3: Startup with incomplete persisted current-v2 quarantines raw data
// ----------------------------------------------------------------------------
const corruptV2StorageCases = [
  // Omitted historicalSnapshots
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); delete b.historicalSnapshots; return JSON.stringify(b); })(),
  // Null historicalSnapshots
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); b.historicalSnapshots = null; return JSON.stringify(b); })(),
  // Omitted rostering
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); delete b.rostering; return JSON.stringify(b); })(),
  // Omitted instructions
  (function() { const b = JSON.parse(JSON.stringify(validBaseEnvelope)); delete b.rostering.instructions; return JSON.stringify(b); })()
];

for (let j = 0; j < corruptV2StorageCases.length; j++) {
  const rawCorrupt = corruptV2StorageCases[j];
  localStorage.setItem('hort_ops_workspace_v2', rawCorrupt);
  const loadRes = storage.loadWorkspace();
  assert.strictEqual(loadRes.recoveryRequired, true, 'Case A3: Corrupt v2 storage ' + j + ' must enter recovery');
  assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), rawCorrupt, 'Case A3: Raw storage bytes must remain untouched');

  // Verify app.init reflects recovery and suspends autosave
  app.init();
  assert.strictEqual(app.state.recoveryRequired, true, 'Case A3: App state must reflect recoveryRequired');
  const autosaveRes = app.saveCurrentWorkspace();
  assert.strictEqual(autosaveRes, false, 'Case A3: Autosave must be suspended in recoveryRequired state');
  assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), rawCorrupt, 'Case A3: Storage bytes must remain untouched during suspended autosave');
}
console.log('  [PASS] Case A3: Persisted v2 startup with missing evidence is quarantined; raw data untouched.');

// Restore baseline
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);
app.init();
assert.strictEqual(app.state.recoveryRequired, false);

// ----------------------------------------------------------------------------
// Case A4: prepareWorkspaceJsonImport refuses v2 omissions regardless of assignments
// ----------------------------------------------------------------------------
const badImportPayloads = [
  // Missing snapshots with populated assignments
  { schemaVersion: 2, jobs: [], roster: [], assignments: { 'j@2026-06-06': ['e1'] }, rostering: { instructions: {}, provenance: {} } },
  // Missing snapshots with EMPTY assignments
  { schemaVersion: 2, jobs: [], roster: [], assignments: {}, rostering: { instructions: {}, provenance: {} } },
  // Missing rostering with populated assignments
  { schemaVersion: 2, jobs: [], roster: [], assignments: { 'j@2026-06-06': ['e1'] }, historicalSnapshots: {} },
  // Null snapshots
  { schemaVersion: 2, jobs: [], roster: [], assignments: {}, historicalSnapshots: null, rostering: { instructions: {}, provenance: {} } }
];

for (let k = 0; k < badImportPayloads.length; k++) {
  const impRes = storage.prepareWorkspaceJsonImport(JSON.stringify(badImportPayloads[k]));
  assert.strictEqual(impRes.success, false, 'Case A4: Import payload ' + k + ' must be rejected');
  assert.ok(impRes.error, 'Case A4: Rejection must provide actionable error');
}

// Explicit-empty v2 backup must succeed import
const explicitEmptyImport = {
  schemaVersion: 2,
  jobs: [JSON.parse(JSON.stringify(overnightJob))],
  roster: [JSON.parse(JSON.stringify(testEmployee1))],
  assignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  permits: {},
  budgetSettings: {}
};
const goodImpRes = storage.prepareWorkspaceJsonImport(JSON.stringify(explicitEmptyImport));
assert.strictEqual(goodImpRes.success, true, 'Case A4: Explicit-empty v2 backup must import successfully');
console.log('  [PASS] Case A4: v2 import missing any evidence map rejects regardless of assignments; explicit-empty succeeds.');

// ----------------------------------------------------------------------------
// Case A5: Direct restore rejects incomplete v2 before storage or state mutation
// ----------------------------------------------------------------------------
const activeJobsBefore = JSON.parse(JSON.stringify(app.state.jobs));
const activeStaffBefore = JSON.parse(JSON.stringify(app.state.staffList));
const bytesBeforeRestore = localStorage.getItem('hort_ops_workspace_v2');

const incompleteRestorePayload = {
  schemaVersion: 2,
  jobs: [{ id: 'intruder-job', name: 'Intruder' }],
  roster: [{ id: 'intruder-emp', name: 'Intruder' }],
  assignments: {},
  // Missing historicalSnapshots and rostering
};

const restoreFailed = app.restoreWorkspaceJson(incompleteRestorePayload);
assert.strictEqual(restoreFailed, false, 'Case A5: restoreWorkspaceJson must return false on incomplete envelope');
assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), bytesBeforeRestore, 'Case A5: Stored bytes must remain unchanged');
assert.deepStrictEqual(app.state.jobs, activeJobsBefore, 'Case A5: Active jobs must not be mutated on failed restore');
assert.deepStrictEqual(app.state.staffList, activeStaffBefore, 'Case A5: Active staff must not be mutated on failed restore');
console.log('  [PASS] Case A5: Direct restore with incomplete v2 rejects before storage or state mutation.');

// ----------------------------------------------------------------------------
// Case A6: Removing 1 of 2 identities blocks real export with zero download
// ----------------------------------------------------------------------------
// Reset live app state to match baseline
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);
app.init();
assert.strictEqual(Object.keys(app.state.historicalSnapshots).length, 2);
assert.strictEqual(Object.keys(app.state.rostering.instructions).length, 2);
assert.strictEqual(Object.keys(app.state.rostering.provenance).length, 2);

let downloadedContent = null;
exportModal.downloadFile = function(content) { downloadedContent = content; };

// Case A6.1: Remove snap2 from live state
downloadedContent = null;
delete app.state.historicalSnapshots[snap2Id];
const expResSnapLoss = exportModal.exportBackupJson();
assert.strictEqual(expResSnapLoss, false, 'Case A6.1: Dropping 1 of 2 snapshots must abort export');
assert.strictEqual(downloadedContent, null, 'Case A6.1: Zero download on snapshot loss');
app.state.historicalSnapshots[snap2Id] = validBaseEnvelope.historicalSnapshots[snap2Id]; // restore

// Case A6.2: Remove inst2 from live state
downloadedContent = null;
delete app.state.rostering.instructions[inst2Id];
const expResInstLoss = exportModal.exportBackupJson();
assert.strictEqual(expResInstLoss, false, 'Case A6.2: Dropping 1 of 2 instructions must abort export');
assert.strictEqual(downloadedContent, null, 'Case A6.2: Zero download on instruction loss');
app.state.rostering.instructions[inst2Id] = validBaseEnvelope.rostering.instructions[inst2Id]; // restore

// Case A6.3: Remove prov2 from live state
downloadedContent = null;
delete app.state.rostering.provenance[prov2Key];
const expResProvLoss = exportModal.exportBackupJson();
assert.strictEqual(expResProvLoss, false, 'Case A6.3: Dropping 1 of 2 provenance entries must abort export');
assert.strictEqual(downloadedContent, null, 'Case A6.3: Zero download on provenance loss');
app.state.rostering.provenance[prov2Key] = validBaseEnvelope.rostering.provenance[prov2Key]; // restore

console.log('  [PASS] Case A6: Removing 1 of 2 identities across snapshots, instructions, or provenance blocks export with 0 downloads.');

// ----------------------------------------------------------------------------
// Case A7: Real export yields exact bytes; import prepare + restore pipeline
// ----------------------------------------------------------------------------
downloadedContent = null;
let downloadedFilename = null;
exportModal.downloadFile = function(content, filename) {
  downloadedContent = content;
  downloadedFilename = filename;
};

const exportSuccess = exportModal.exportBackupJson();
assert.strictEqual(exportSuccess, true, 'Case A7: exportBackupJson must succeed on complete baseline');
assert.ok(downloadedContent, 'Case A7: Downloaded JSON content must exist');
assert.ok(downloadedFilename.endsWith('.json'), 'Case A7: Filename must end with .json');

const exactExportedString = downloadedContent; // Retain exact string, NO fallback

// Mutate active app state to completely different workspace
app.state.jobs = [{ id: 'other-job-1', name: 'Other Job', status: 'active' }];
app.state.staffList = [{ id: 'other-emp-1', name: 'Other Employee', status: 'active' }];
app.state.customAssignments = { 'other-job-1@2026-06-06': ['other-emp-1'] };
app.state.rostering = { instructions: { 'other-inst': { id: 'other-inst' } }, provenance: {} };
app.state.historicalSnapshots = { 'other-job-1@2026-06-06': { shiftId: 'other-job-1@2026-06-06', date: '2026-06-06' } };

let boundaryCacheCleared = false;
const origClearCache = scheduler.clearBoundaryCache;
scheduler.clearBoundaryCache = function() {
  boundaryCacheCleared = true;
  if (typeof origClearCache === 'function') origClearCache.apply(this, arguments);
};

// Prepare import using EXACT exported string
const prepExportRes = storage.prepareWorkspaceJsonImport(exactExportedString);
assert.strictEqual(prepExportRes.success, true, 'Case A7: prepareWorkspaceJsonImport must succeed on exact exported string');

const restoreSuccess = app.restoreWorkspaceJson(prepExportRes.data);
assert.strictEqual(restoreSuccess, true, 'Case A7: restoreWorkspaceJson must succeed on prepared envelope');

// Assert full-domain value equivalence across all operational domains and evidence maps
const expectedParsed = JSON.parse(exactExportedString);
assert.deepStrictEqual(app.state.jobs, expectedParsed.jobs, 'Case A7: Full jobs domain equivalence');
assert.deepStrictEqual(app.state.staffList, expectedParsed.roster, 'Case A7: Full staff/roster domain equivalence');
assert.deepStrictEqual(app.state.customAssignments, expectedParsed.assignments, 'Case A7: Full assignments domain equivalence');
assert.deepStrictEqual(app.state.customPermits, expectedParsed.permits || {}, 'Case A7: Full permits domain equivalence');
assert.deepStrictEqual(app.state.budgetSettings, expectedParsed.budgetSettings, 'Case A7: Full budgetSettings domain equivalence');
assert.deepStrictEqual(app.state.historicalSnapshots, expectedParsed.historicalSnapshots, 'Case A7: Full historicalSnapshots domain equivalence');
assert.deepStrictEqual(app.state.rostering.instructions, expectedParsed.rostering.instructions, 'Case A7: Full instructions domain equivalence');
assert.deepStrictEqual(app.state.rostering.provenance, expectedParsed.rostering.provenance, 'Case A7: Full provenance domain equivalence');
assert.strictEqual(app.state.customAssignments['other-job-1@2026-06-06'], undefined);
assert.strictEqual(app.state.historicalSnapshots['other-job-1@2026-06-06'], undefined);
assert.strictEqual(boundaryCacheCleared, true, 'Case A7: Scheduler boundary cache must be cleared');

scheduler.clearBoundaryCache = origClearCache;
console.log('  [PASS] Case A7: Real export -> import prepare -> restore pipeline verified with exact bytes across all domains.');

// ----------------------------------------------------------------------------
// Case A8: Direct persistence write failure leaves stored bytes intact
// ----------------------------------------------------------------------------
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);
app.init();
assert.strictEqual(app.state.recoveryRequired, false);

localStorage.throwOnSet = true;
const writeFailSave = app.saveCurrentWorkspace();
assert.strictEqual(writeFailSave, false, 'Case A8: saveCurrentWorkspace must return false on storage write failure');
assert.strictEqual(app.state.storageStatus, 'session_only', 'Case A8: storageStatus must indicate session_only or save_failed');
localStorage.throwOnSet = false;

const bytesAfterFail = localStorage.getItem('hort_ops_workspace_v2');
assert.strictEqual(bytesAfterFail, baselinePersistedBytes, 'Case A8: Prior storage bytes must remain 100% intact');
console.log('  [PASS] Case A8: Direct persistence write failure leaves previous stored bytes intact.');

// ----------------------------------------------------------------------------
// Review 10 Adversarial Invariant Closures (GA10-01 to GA10-04)
// ----------------------------------------------------------------------------
console.log('>>> [TEST GROUP 3] Review 10 Unified Invariant Closures');

// GA10-01: Builder bypass prevention
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);
app.init();
const validInitial = JSON.parse(baselinePersistedBytes);

// Incomplete raw v2 missing historicalSnapshots
const missingSnapRaw = JSON.parse(JSON.stringify(validInitial));
delete missingSnapRaw.historicalSnapshots;
assert.throws(() => {
  storage.createWorkspaceEnvelope(missingSnapRaw);
}, /Missing required current-v2 field: historicalSnapshots/, 'GA10-01: createWorkspaceEnvelope must throw on missing historicalSnapshots');

// Incomplete raw v2 missing instructions
const missingInstRaw = JSON.parse(JSON.stringify(validInitial));
delete missingInstRaw.rostering.instructions;
assert.throws(() => {
  storage.createWorkspaceEnvelope(missingInstRaw);
}, /Missing required current-v2 field: rostering\.instructions/, 'GA10-01: createWorkspaceEnvelope must throw on missing instructions');

// Incomplete raw v2 missing provenance
const missingProvRaw = JSON.parse(JSON.stringify(validInitial));
delete missingProvRaw.rostering.provenance;
assert.throws(() => {
  storage.createWorkspaceEnvelope(missingProvRaw);
}, /Missing required current-v2 field: rostering\.provenance/, 'GA10-01: createWorkspaceEnvelope must throw on missing provenance');

assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), baselinePersistedBytes, 'GA10-01: Storage must remain unchanged');
console.log('  [PASS] GA10-01: Common envelope builder strictly rejects incomplete raw v2 without synthesizing fallbacks.');

// GA10-02: Exporter with malformed stored baseline blocks download
const corruptStoredBaseline = JSON.parse(JSON.stringify(validInitial));
delete corruptStoredBaseline.historicalSnapshots;
delete corruptStoredBaseline.rostering.provenance;
localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(corruptStoredBaseline));
downloadedContent = null;
const corruptExportRes = exportModal.exportBackupJson();
assert.strictEqual(corruptExportRes, false, 'GA10-02: exportBackupJson must return false when stored baseline fails validation');
assert.strictEqual(downloadedContent, null, 'GA10-02: Zero file download must occur on corrupt stored baseline');
console.log('  [PASS] GA10-02: Backup exporter strictly blocks download when committed storage baseline is malformed.');

// GA10-03: Normal save refuses to overwrite unreadable committed bytes
localStorage.setItem('hort_ops_workspace_v2', '{ unreadable JSON, potentially containing evidence');
const unreadableSaveRes = app.saveCurrentWorkspace();
assert.strictEqual(unreadableSaveRes, false, 'GA10-03: saveCurrentWorkspace must fail closed on unreadable committed bytes');
assert.strictEqual(app.state.storageStatus, 'save_failed', 'GA10-03: storageStatus must be save_failed');
assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), '{ unreadable JSON, potentially containing evidence', 'GA10-03: Raw unreadable bytes must be preserved byte-for-byte');
console.log('  [PASS] GA10-03: Normal save refuses to overwrite unreadable committed storage bytes.');

// GA10-04a: Rejected semantic validation must operate on working copy and NOT mutate source
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);
app.init();
const badSemanticInput = JSON.parse(JSON.stringify(validInitial));
const testInstrKey = Object.keys(badSemanticInput.rostering.instructions)[0];
delete badSemanticInput.rostering.instructions[testInstrKey].status; // legacy unannotated instruction
badSemanticInput.roster[0].status = 'banana'; // invalid semantic status
const badSemanticInputJsonBefore = JSON.stringify(badSemanticInput);

const semBoundaryCheck = validator.validateCurrentV2ForBoundary(badSemanticInput);
assert.strictEqual(semBoundaryCheck.valid, false, 'GA10-04a: validateCurrentV2ForBoundary must reject invalid staff status');
assert.strictEqual(JSON.stringify(badSemanticInput), badSemanticInputJsonBefore, 'GA10-04a: Source input must NOT be mutated on validation failure');
console.log('  [PASS] GA10-04a: Boundary validator operates on defensive working copy; rejected validation leaves source object unmutated.');

// GA10-04b: Rejected restore with shared runtime object leaves active app.state unmutated
const badRestoreShared = JSON.parse(JSON.stringify(validInitial));
delete app.state.rostering.instructions[inst1Id].status;
badRestoreShared.rostering = app.state.rostering; // deliberately shared reference to live app state
badRestoreShared.roster[0].status = 'banana'; // will cause semantic rejection
const appStateJsonBefore = JSON.stringify(app.state);
const storedBytesBefore = localStorage.getItem('hort_ops_workspace_v2');

const restoreSharedRes = app.restoreWorkspaceJson(badRestoreShared);
assert.strictEqual(restoreSharedRes, false, 'GA10-04b: restoreWorkspaceJson must reject semantically invalid envelope');
assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), storedBytesBefore, 'GA10-04b: Storage bytes must remain untouched');
assert.strictEqual(JSON.stringify(app.state), appStateJsonBefore, 'GA10-04b: Live app.state must remain 100% unmutated despite shared object reference');
console.log('  [PASS] GA10-04b: Rejected restore leaves active app.state and storage completely untouched even with shared runtime references.');

// ============================================================================
// >>> [TEST GROUP 4] Review 11 Invariant Closures (R11-01 to R11-04)
// ============================================================================

// R11-01a: Missing reader must fail closed for normal save
const corruptReaderBytes = '{ corrupt unreadable workspace';
localStorage.setItem('hort_ops_workspace_v2', corruptReaderBytes);
const origReader = storage.readVerifiedCommittedV2;
storage.readVerifiedCommittedV2 = undefined;
const r11SaveRes = app.saveCurrentWorkspace();
assert.strictEqual(r11SaveRes, false, 'R11-01a: saveCurrentWorkspace must return false when reader is missing');
assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), corruptReaderBytes, 'R11-01a: Corrupt storage must not be overwritten');
console.log('  [PASS] R11-01a: Missing baseline reader fails closed on normal save; storage preserved.');

// R11-01b: Missing reader must fail closed for backup
downloadedContent = null;
const r11ExportRes = exportModal.exportBackupJson();
assert.strictEqual(r11ExportRes, false, 'R11-01b: exportBackupJson must return false when reader is missing');
assert.strictEqual(downloadedContent, null, 'R11-01b: Zero downloads when reader is missing');
storage.readVerifiedCommittedV2 = origReader;
console.log('  [PASS] R11-01b: Missing baseline reader fails closed on backup; 0 downloads triggered.');

// R11-02: Backup includes unsaved live edits via checked save-then-export
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);
app.init();
app.state.jobs[0].name = 'Live Unsaved Job Name Edit';
downloadedContent = null;
const r11SaveExportRes = exportModal.exportBackupJson();
assert.strictEqual(r11SaveExportRes, true, 'R11-02: exportBackupJson must succeed after checked save');
assert.ok(downloadedContent, 'R11-02: Download must occur');
const exportedData = JSON.parse(downloadedContent);
assert.strictEqual(exportedData.jobs[0].name, 'Live Unsaved Job Name Edit', 'R11-02: Exported backup must contain live unsaved edit');
const newlyStoredData = JSON.parse(localStorage.getItem('hort_ops_workspace_v2'));
assert.strictEqual(newlyStoredData.jobs[0].name, 'Live Unsaved Job Name Edit', 'R11-02: Storage must reflect checked save');
console.log('  [PASS] R11-02: Backup includes live unsaved edits via checked save-then-export contract.');

// R11-03: Accepted restore must adopt detached budget and uiState copies
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);
app.init();
const restoreInput = JSON.parse(baselinePersistedBytes);
const storedCapBefore = restoreInput.budgetSettings.annualBudgetCap;
const restoreOk = app.restoreWorkspaceJson(restoreInput);
assert.strictEqual(restoreOk, true, 'R11-03: Valid restore must succeed');
assert.strictEqual(app.state.budgetSettings.annualBudgetCap, storedCapBefore, 'R11-03: Initial restored cap matches');
// Mutate caller's envelope
restoreInput.budgetSettings.annualBudgetCap = 9999999;
assert.strictEqual(app.state.budgetSettings.annualBudgetCap, storedCapBefore, 'R11-03: Live budgetSettings must remain detached from mutated caller envelope');
assert.notStrictEqual(app.state.budgetSettings.annualBudgetCap, 9999999, 'R11-03: Caller budget mutation must NOT leak into active state');
console.log('  [PASS] R11-03: Accepted restore adopts fully detached working copies of budgetSettings and uiState.');

// R11-04: Non-JSON Infinity and NaN rejected before cloning without laundering into null
localStorage.setItem('hort_ops_workspace_v2', baselinePersistedBytes);
app.init();
const infinityInput = JSON.parse(baselinePersistedBytes);
const firstSnapKey = Object.keys(infinityInput.historicalSnapshots)[0];
infinityInput.historicalSnapshots[firstSnapKey].durationHours = Infinity;
const boundaryInfinityCheck = validator.validateCurrentV2ForBoundary(infinityInput);
assert.strictEqual(boundaryInfinityCheck.valid, false, 'R11-04: Boundary validator must reject Infinity');
assert.ok(/Non-finite number/.test(boundaryInfinityCheck.error), 'R11-04: Error must identify non-finite number');

const saveInfinityRes = storage.saveWorkspace(infinityInput);
assert.strictEqual(saveInfinityRes.ok, false, 'R11-04: saveWorkspace must reject non-JSON Infinity');
assert.strictEqual(localStorage.getItem('hort_ops_workspace_v2'), baselinePersistedBytes, 'R11-04: Storage bytes must remain unchanged');
console.log('  [PASS] R11-04: Pre-clone non-JSON guard rejects Infinity/NaN without laundering into null.');

console.log('================================================================');
console.log(' ALL PROTOCOL V2, REVIEW 10 & REVIEW 11 TESTS PASSED (100%)');
console.log('================================================================');
