const assert = require('assert');
const path = require('path');

console.log('=== RUNNING ARCHITECTURE DEPENDENCY CONTRACT FAILURE SUITE (OFFLINE15.1) ===');

// Setup mock window and LocalStorage environment
const mockStorage = {};
global.window = {
  localStorage: {
    getItem: (k) => mockStorage[k] !== undefined ? mockStorage[k] : null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
    key: (i) => Object.keys(mockStorage)[i] || null,
    get length() { return Object.keys(mockStorage).length; }
  },
  HortOpsApp: { state: { allShifts: [] } }
};
global.alert = () => {};

// Load base modules
const offlineDir = path.resolve(__dirname, '..');
require(path.join(offlineDir, 'js/data/staffRoster.js'));
require(path.join(offlineDir, 'js/data/initialJobs.js'));
require(path.join(offlineDir, 'js/data/holidays.js'));
require(path.join(offlineDir, 'js/data/historicalOccurrences.js'));
require(path.join(offlineDir, 'js/utils/dateUtils.js'));
require(path.join(offlineDir, 'js/utils/icons.js'));
require(path.join(offlineDir, 'js/utils/securityUtils.js'));

function reloadModule(relPath) {
  const fullPath = path.join(offlineDir, relPath);
  delete require.cache[require.resolve(fullPath)];
  return require(fullPath);
}

// ----------------------------------------------------------------------------
// 1. HortOpsSchemaValidator Missing
// ----------------------------------------------------------------------------
console.log('\n>>> [CONTRACT 1/6] Testing HortOpsSchemaValidator Withheld Contract...');
{
  delete window.HortOpsSchemaValidator;
  reloadModule('js/utils/storage/migrationEngine.js');
  reloadModule('js/utils/storage/storageDriver.js');
  reloadModule('js/utils/storage.js');
  delete window.HortOpsSchemaValidator; // Ensure removed

  // Setup valid stored workspace initially
  const validEnvelope = {
    schemaVersion: 2,
    lastSaved: '2026-03-01T00:00:00.000Z',
    jobs: window.HortOpsData.INITIAL_JOBS,
    roster: window.HortOpsData.STAFF_ROSTER,
    assignments: {},
    permits: {},
    budgetSettings: {},
    uiState: {}
  };
  window.localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(validEnvelope));
  const preStorageSnapshot = window.localStorage.getItem('hort_ops_workspace_v2');

  // Attempt to validate malformed schema 99
  const badWorkspace = {
    schemaVersion: 99,
    jobs: [{ id: 'bad id', title: 'Invalid' }],
    roster: []
  };

  const valRes = window.HortOpsStorage.validateWorkspaceSchema(badWorkspace);
  assert.strictEqual(valRes.valid, false, 'FAIL: validateWorkspaceSchema must return valid: false when validator is missing');
  assert.ok(valRes.error && valRes.error.includes('window.HortOpsSchemaValidator is required'), 'FAIL: error must indicate missing validator');

  // Attempt to save malformed schema 99
  const saveRes = window.HortOpsStorage.saveWorkspace(badWorkspace);
  assert.strictEqual(saveRes.ok, false, 'FAIL: saveWorkspace must return ok: false when validator is missing');
  assert.strictEqual(saveRes.stage, 'validation', 'FAIL: saveWorkspace must fail at validation stage');

  // Verify storage was NOT mutated or overwritten
  const postStorageSnapshot = window.localStorage.getItem('hort_ops_workspace_v2');
  assert.strictEqual(preStorageSnapshot, postStorageSnapshot, 'FAIL: Storage must not be mutated when validator is missing');

  // Verify prepareWorkspaceJsonImport fails closed
  const importPrep = window.HortOpsStorage.prepareWorkspaceJsonImport(JSON.stringify(badWorkspace));
  assert.strictEqual(importPrep.success, false, 'FAIL: prepareWorkspaceJsonImport must fail when validator is missing');

  console.log('  [PASS] HortOpsSchemaValidator fail-closed: validation rejected, save blocked, storage untouched.');
}

// ----------------------------------------------------------------------------
// 2. HortOpsMigrationEngine Missing
// ----------------------------------------------------------------------------
console.log('\n>>> [CONTRACT 2/6] Testing HortOpsMigrationEngine Withheld Contract...');
{
  reloadModule('js/utils/storage/schemaValidator.js');
  delete window.HortOpsMigrationEngine;
  reloadModule('js/utils/storage.js');
  delete window.HortOpsMigrationEngine; // Ensure removed

  // Setup Schema 1 payload under v1 key
  const v1Payload = {
    schemaVersion: 1,
    jobs: [{ id: 'job_1', name: 'Job 1' }], // Missing status
    roster: [{ id: 'EMP-001', name: 'Alice' }] // Missing status
  };
  window.localStorage.setItem('hort_ops_workspace_v1', JSON.stringify(v1Payload));
  window.localStorage.removeItem('hort_ops_workspace_v2');

  const loaded = window.HortOpsStorage.loadWorkspace();
  assert.strictEqual(loaded.recoveryRequired, true, 'FAIL: Missing migration engine must trigger recovery mode for Schema 1');
  assert.ok(loaded.recoveryError && loaded.recoveryError.includes('Migration engine unavailable'), 'FAIL: Recovery error must identify missing migration engine');

  // Verify unmigrated payload was NOT relabelled or persisted as v2
  assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), null, 'FAIL: Storage v2 must not be written when migration engine is missing');

  // Test direct migrateWorkspaceV1toV2 throws
  assert.throws(() => {
    window.HortOpsStorage.migrateWorkspaceV1toV2(v1Payload);
  }, /Migration engine unavailable/, 'FAIL: migrateWorkspaceV1toV2 must throw explicit error');

  console.log('  [PASS] HortOpsMigrationEngine fail-closed: Schema 1 quarantined, no relabelling, explicit failure.');
}

// ----------------------------------------------------------------------------
// 3. HortOpsStorageDriver Missing
// ----------------------------------------------------------------------------
console.log('\n>>> [CONTRACT 3/6] Testing HortOpsStorageDriver Withheld Contract...');
{
  delete window.HortOpsStorageDriver;
  reloadModule('js/utils/storage.js');
  delete window.HortOpsStorageDriver; // Ensure removed

  const health = window.HortOpsStorage.getStorageHealth();
  assert.notStrictEqual(health.status, 'healthy', 'FAIL: Storage health must NEVER report healthy when driver is missing');
  assert.strictEqual(health.probeOk, false, 'FAIL: probeOk must NOT be true when driver is missing');
  assert.strictEqual(health.status, 'unavailable', 'FAIL: Status must report unavailable when driver is missing');
  assert.ok(health.error && health.error.includes('window.HortOpsStorageDriver is required'), 'FAIL: Error must state driver required');

  console.log('  [PASS] HortOpsStorageDriver fail-closed: health reported unavailable, probeOk is false.');
}

// Restore all storage modules
reloadModule('js/utils/storage/schemaValidator.js');
reloadModule('js/utils/storage/migrationEngine.js');
reloadModule('js/utils/storage/storageDriver.js');
reloadModule('js/utils/storage.js');

// ----------------------------------------------------------------------------
// 4. HortOpsSchedulerEngine Missing
// ----------------------------------------------------------------------------
console.log('\n>>> [CONTRACT 4/6] Testing HortOpsSchedulerEngine Withheld Contract...');
{
  delete window.HortOpsSchedulerEngine;
  reloadModule('js/utils/scheduler/costCalculator.js');
  reloadModule('js/utils/scheduler.js');
  delete window.HortOpsSchedulerEngine; // Ensure removed

  assert.throws(() => {
    window.HortOpsScheduler.generateOperationalDigest([], 2026, false);
  }, /Scheduler engine unavailable/, 'FAIL: generateOperationalDigest must throw when engine missing');

  assert.throws(() => {
    window.HortOpsScheduler.resolveExplicitOccurrenceLifecycle({});
  }, /Scheduler engine unavailable/, 'FAIL: resolveExplicitOccurrenceLifecycle must throw when engine missing');

  assert.throws(() => {
    window.HortOpsScheduler.generateWeekendSlots(2026);
  }, /Scheduler engine unavailable/, 'FAIL: generateWeekendSlots must throw when engine missing');

  assert.throws(() => {
    window.HortOpsScheduler.resolvePermitMeta({}, '2026-03-01', 'e1');
  }, /Scheduler engine unavailable/, 'FAIL: resolvePermitMeta must throw when engine missing');

  console.log('  [PASS] HortOpsSchedulerEngine fail-closed: throws explicit errors, never fabricates fake output.');
}

// ----------------------------------------------------------------------------
// 5. HortOpsCostCalculator Missing
// ----------------------------------------------------------------------------
console.log('\n>>> [CONTRACT 5/6] Testing HortOpsCostCalculator Withheld Contract...');
{
  reloadModule('js/utils/scheduler/engine.js');
  delete window.HortOpsCostCalculator;
  reloadModule('js/utils/scheduler.js');
  delete window.HortOpsCostCalculator; // Ensure removed

  const sundayShift = {
    date: '2026-03-15', // Sunday
    durationHours: 6,
    crewSize: 3,
    crewSizeRequired: 3
  };

  assert.throws(() => {
    window.HortOpsScheduler.calculateShiftCost(sundayShift);
  }, /Cost calculator unavailable/, 'FAIL: calculateShiftCost must throw explicit Error when calculator missing');

  console.log('  [PASS] HortOpsCostCalculator fail-closed: throws explicit error, never falls back to base rate.');
}

// Restore scheduler modules
reloadModule('js/utils/scheduler/costCalculator.js');
reloadModule('js/utils/scheduler/engine.js');
reloadModule('js/utils/scheduler.js');

// ----------------------------------------------------------------------------
// 6. HortOpsEligibilityEngine Missing
// ----------------------------------------------------------------------------
console.log('\n>>> [CONTRACT 6/6] Testing HortOpsEligibilityEngine Withheld Contract...');
{
  delete window.HortOpsEligibilityEngine;

  // Test Scheduler Engine revalidation fail-closed
  const testShift = {
    shiftId: 'shift_test',
    date: '2026-04-11',
    durationHours: 6,
    crewSize: 2,
    assignedStaffIds: ['EMP-001', 'EMP-002']
  };
  const roster = window.HortOpsData.STAFF_ROSTER;
  const job = window.HortOpsData.INITIAL_JOBS[0];

  window.HortOpsScheduler.revalidateShiftAssignments(testShift, roster, job, [testShift]);

  assert.strictEqual(testShift.invalidAssignees.length, 2, 'FAIL: All assigned staff must be invalid when eligibility engine is missing');
  assert.strictEqual(testShift.invalidAssignees[0].code, 'ELIGIBILITY_ENGINE_UNAVAILABLE', 'FAIL: Code must be ELIGIBILITY_ENGINE_UNAVAILABLE');
  assert.strictEqual(testShift.hasCrewConflict, true, 'FAIL: Shift must be flagged with crew conflict');
  assert.ok(testShift.crewIntegrityIssues.length > 0, 'FAIL: Crew integrity issues must record engine unavailable');

  // Test StaffAssignCandidateModel fail-closed
  reloadModule('js/components/staffAssignModal/candidateModel.js');
  const candidateRes = window.HortOpsStaffAssignCandidateModel.filterCandidates(roster, {
    shift: testShift,
    allShifts: [testShift],
    stagedAssignedStaffIds: []
  });
  assert.strictEqual(candidateRes.length, 0, 'FAIL: Candidate model must return 0 eligible candidates when engine missing');

  console.log('  [PASS] HortOpsEligibilityEngine fail-closed: assigned staff invalidated with ELIGIBILITY_ENGINE_UNAVAILABLE, 0 candidates eligible.');
}

console.log('\n================================================================');
console.log(' ALL 6 ARCHITECTURE DEPENDENCY FAILURE CONTRACTS PASSED (100%)');
console.log(' ZERO SILENT FALLBACKS DETECTED. SAFE FAIL-CLOSED CONTRACTS PROVEN.');
console.log('================================================================\n');
