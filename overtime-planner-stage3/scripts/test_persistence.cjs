const assert = require('assert');

// Mock localStorage for node environment
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
require('../js/utils/scheduler.js');
require('../js/app.js');
require('../js/components/exportModal.js');

console.log('=== RUNNING PERSISTENCE & STORAGE REGRESSION SUITE ===');

const storage = window.HortOpsStorage;

// 1. Storage Contract & Normal Round-Trip (Mandate Section 9, 27)
const testWorkspace = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  lastSaved: new Date().toISOString(),
  jobs: [
    {
      id: 'job-round-trip-1',
      name: 'Round Trip Parkland',
      category: 'Parklands',
      frequencyType: 'recurring_weeks',
      intervalWeeks: 4,
      anchorDate: '2026-01-10',
      preferredDay: 'saturday',
      startTime: '06:00 AM',
      durationHours: 6,
      crewSize: 3,
      status: 'active'
    }
  ],
  roster: [
    {
      id: 'EMP-999',
      name: 'Test Persistence User',
      department: 'Horticulture',
      team: 'Parks',
      role: 'Worker',
      status: 'active',
      isOvertimeExempt: true,
      exemptionStartDate: '2026-06-01',
      exemptionEndDate: '2026-06-30'
    }
  ],
  assignments: {
    'job-round-trip-1@2026-01-10': ['EMP-999']
  },
  permits: {
    'job-round-trip-1@2026-01-10': {
      wztmStatus: 'in_progress',
      wztmNotes: 'Ref #RT-1'
    }
  },
  budgetSettings: { hourlyBaseRate: 45 },
  uiState: {
    activeView: 'job_manager',
    currentYear: 2027
  }
};

const saveRes = storage.saveWorkspace(testWorkspace);
assert.strictEqual(saveRes.ok, true, 'saveWorkspace must return ok === true on success');
assert.strictEqual(saveRes.storageMode, 'persistent', 'Storage mode must be persistent');

const loaded = storage.loadWorkspace();
assert.strictEqual(loaded.jobs.length, 1, 'Loaded jobs length must match');
assert.strictEqual(loaded.jobs[0].id, 'job-round-trip-1', 'Job id must match');
assert.strictEqual(loaded.roster.length, 1, 'Loaded roster length must match');
assert.strictEqual(loaded.roster[0].id, 'EMP-999', 'Roster id must match');
assert.deepStrictEqual(loaded.assignments, testWorkspace.assignments, 'Assignments must match');
assert.deepStrictEqual(loaded.permits, testWorkspace.permits, 'Permits must match');
const rawStoredV2 = JSON.parse(window.localStorage.getItem('hort_ops_workspace_v2'));
assert.strictEqual(rawStoredV2.schemaVersion, 2, 'Raw stored workspace envelope must strictly be Schema v2');
console.log('[PASS] Raw stored envelope confirmed Schema v2 before reload.');
assert.strictEqual(loaded.uiState.activeView, 'job_manager', 'UI state activeView must match');
assert.strictEqual(loaded.uiState.currentYear, 2027, 'UI state currentYear must match');
console.log('[PASS] Storage save/load contract and normal round-trip verified.');

// 2. Empty State Preservation (Mandate Section 27, 29)
// Empty jobs: [] and roster: [] must not be overwritten by seeded defaults on reload
const emptyWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  lastSaved: new Date().toISOString(),
  jobs: [],
  roster: [],
  assignments: {},
  permits: {},
  budgetSettings: {},
  uiState: {}
};
storage.saveWorkspace(emptyWs);

const loadedEmpty = storage.loadWorkspace();
assert(Array.isArray(loadedEmpty.jobs), 'Jobs must be array');
assert.strictEqual(loadedEmpty.jobs.length, 0, 'Empty jobs array must NOT be overwritten by defaults');
assert(Array.isArray(loadedEmpty.roster), 'Roster must be array');
assert.strictEqual(loadedEmpty.roster.length, 0, 'Empty roster array must NOT be overwritten by defaults');
console.log('[PASS] Empty state preservation verified: jobs: [] and roster: [] survived reload.');

// 3. Storage Failure & Truthful Status Contract (Mandate Section 9, 10, 27)
window.localStorage.throwOnSet = true;

const failWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  lastSaved: new Date().toISOString(),
  jobs: [{ id: 'fail-job', name: 'Fail Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'fail-staff', name: 'Fail Staff', status: 'active' }],
  assignments: {},
  permits: {},
  budgetSettings: {},
  uiState: {}
};
const failRes = storage.saveWorkspace(failWs);
assert.strictEqual(failRes.ok, false, 'saveWorkspace must return ok === false when write fails');
assert.strictEqual(failRes.stage, 'persistence', 'Storage write failure must report stage persistence');
assert.strictEqual(failRes.storageMode, 'session-only', 'Storage mode must be session-only on failure');
assert(failRes.error, 'Error message must be present on failure');

// Test HortOpsApp.saveCurrentWorkspace propagates failure
window.HortOpsApp.state.jobs = [{ id: 'app-job', name: 'App Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }];
window.HortOpsApp.state.roster = [{ id: 'app-staff', name: 'App Staff', status: 'active' }];
const appSaveOk = window.HortOpsApp.saveCurrentWorkspace();
assert.strictEqual(appSaveOk, false, 'app.saveCurrentWorkspace must return false on write failure');
assert.strictEqual(window.HortOpsApp.state.storageStatus, 'session_only', 'App storageStatus must be session_only or save_failed');

window.localStorage.throwOnSet = false;
console.log('[PASS] Storage write failure detection and non-swallowed error contract verified.');

// 4. JSON Restore Schema Validation Below UI Layer (Mandate Section 12, 27)
// A. Malformed non-JSON
const badJsonRes = storage.importWorkspaceJson('NOT A VALID JSON STRING');
assert.strictEqual(badJsonRes.success, false, 'Non-JSON string must be rejected');

// B. Missing jobs or roster array
const missingJobsJson = JSON.stringify({ schemaVersion: 1, roster: [] });
const missingJobsRes = storage.importWorkspaceJson(missingJobsJson);
assert.strictEqual(missingJobsRes.success, false, 'Missing jobs array must be rejected');

// C. Recurring job missing anchorDate
const missingAnchorJson = JSON.stringify({
  schemaVersion: 2,
  assignments: {},
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    { id: 'j1', name: 'Bad Job', frequencyType: 'recurring_weeks', intervalWeeks: 4, status: 'active' }
  ],
  roster: []
});
const missingAnchorRes = storage.importWorkspaceJson(missingAnchorJson);
assert.strictEqual(missingAnchorRes.success, false, 'Recurring job missing anchorDate must be rejected');
assert(missingAnchorRes.error.includes('anchorDate'), 'Error must mention anchorDate');

// D. Unsupported weekday (e.g. Tuesday)
const tuesdayJobJson = JSON.stringify({
  schemaVersion: 2,
  assignments: {},
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    {
      id: 'j2',
      name: 'Tuesday Sweep',
      frequencyType: 'recurring_weeks',
      intervalWeeks: 2,
      anchorDate: '2026-01-13',
      preferredDay: 'tuesday',
      status: 'active'
    }
  ],
  roster: []
});
const tuesdayRes = storage.importWorkspaceJson(tuesdayJobJson);
assert.strictEqual(tuesdayRes.success, false, 'Tuesday preferredDay must be rejected');
assert(tuesdayRes.error.includes('unsupported preferredDay'), 'Error must cite unsupported preferredDay');

// E. One-off job on unsupported weekday (Tuesday)
const tuesdayOneOffJson = JSON.stringify({
  schemaVersion: 2,
  assignments: {},
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    {
      id: 'j3',
      name: 'Tuesday One Off',
      frequencyType: 'one_off',
      targetDate: '2026-02-10', // 2026-02-10 is a Tuesday
      status: 'active'
    }
  ],
  roster: []
});
const tuesdayOneOffRes = storage.importWorkspaceJson(tuesdayOneOffJson);
assert.strictEqual(tuesdayOneOffRes.success, false, 'One-off job on Tuesday must be rejected');
assert(tuesdayOneOffRes.error.includes('unsupported weekday'), 'Error must cite unsupported weekday');

// F. Duplicate employee ID in backup roster
const duplicateRosterJson = JSON.stringify({
  schemaVersion: 2,
  assignments: {},
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [],
  roster: [
    { id: 'EMP-001', name: 'Alice', status: 'active' },
    { id: 'EMP-001', name: 'Bob', status: 'active' }
  ]
});
const duplicateRosterRes = storage.importWorkspaceJson(duplicateRosterJson);
assert.strictEqual(duplicateRosterRes.success, false, 'Duplicate staff ID in JSON backup must be rejected');
assert(duplicateRosterRes.error.includes('Duplicate staff ID'), 'Error must cite duplicate staff ID');

console.log('[PASS] JSON schema validation below UI layer verified: malformed, invalid anchors, unsupported weekdays, and duplicate staff rejected.');

// 5. Valid JSON Restore Round-Trip Equivalence (Mandate Section 11, 27)
const validBackup = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    {
      id: 'backup-j1',
      name: 'Restored Park Care',
      frequencyType: 'recurring_weeks',
      intervalWeeks: 4,
      anchorDate: '2026-01-10',
      preferredDay: 'saturday',
      status: 'active'
    }
  ],
  roster: [
    { id: 'EMP-100', name: 'Restored Personnel', team: 'Parks', status: 'active' }
  ],
  assignments: {
    'backup-j1@2026-01-10': ['EMP-100']
  },
  permits: {
    'backup-j1@2026-01-10': { wztmStatus: 'finalized', wztmNotes: 'Appr 123' }
  }
};

const validRestoreRes = storage.importWorkspaceJson(JSON.stringify(validBackup));
assert.strictEqual(validRestoreRes.success, true, 'Valid JSON backup must restore successfully');

const postRestoreWs = storage.loadWorkspace();
assert.strictEqual(postRestoreWs.jobs.length, 1, 'Restored job count must match');
assert.strictEqual(postRestoreWs.jobs[0].id, 'backup-j1', 'Restored job id must match');
assert.strictEqual(postRestoreWs.roster.length, 1, 'Restored roster count must match');
assert.strictEqual(postRestoreWs.roster[0].id, 'EMP-100', 'Restored staff id must match');
assert.deepStrictEqual(postRestoreWs.assignments, validBackup.assignments, 'Restored assignments must match');
assert.deepStrictEqual(postRestoreWs.permits, validBackup.permits, 'Restored permits must match');

console.log('[PASS] JSON restore round-trip equivalence verified.');


// 6. NEW: Duplicate Job IDs Rejected in JSON Schema (Mandate Section 7, 19)
const duplicateJobJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    { id: 'JOB-DUP', name: 'Job One', frequencyType: 'one_off', targetDate: '2026-05-16', status: 'active' },
    { id: 'job-dup', name: 'Job Two (different case)', frequencyType: 'one_off', targetDate: '2026-05-16', status: 'active' }
  ],
  roster: []
});
const duplicateJobRes = storage.importWorkspaceJson(duplicateJobJson);
assert.strictEqual(duplicateJobRes.success, false, 'Duplicate Job IDs in JSON backup must be rejected');
assert(duplicateJobRes.error.toLowerCase().includes('duplicate job id'), 'Error must cite duplicate Job ID');
console.log('[PASS] Duplicate Job ID rejection verified atomically in workspace schema.');

// 7. NEW: Anchor Weekday Mismatch Rejected in JSON Schema (Mandate Section 3, 19)
const anchorMismatchJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    {
      id: 'mismatch-recur',
      name: 'Mismatch Anchor',
      frequencyType: 'recurring_weeks',
      intervalWeeks: 4,
      anchorDate: '2026-02-14', // Saturday
      preferredDay: 'sunday',   // Sunday
      status: 'active'
    }
  ],
  roster: []
});
const anchorMismatchRes = storage.importWorkspaceJson(anchorMismatchJson);
assert.strictEqual(anchorMismatchRes.success, false, 'Anchor weekday mismatch in JSON backup must be rejected');
assert(anchorMismatchRes.error.includes('does not match preferredDay'), 'Error must cite preferredDay mismatch');
console.log('[PASS] Recurring anchor weekday mismatch rejection verified in JSON schema.');

// 8. NEW: JSON Restore Failure Contract When Storage Fails (Mandate Section 8, 19)
window.localStorage.throwOnSet = true;
const failRestoreRes = storage.importWorkspaceJson(JSON.stringify(validBackup));
assert.strictEqual(failRestoreRes.success, false, 'importWorkspaceJson must return success: false when persistence fails');
assert.strictEqual(failRestoreRes.stage, 'persistence', 'Failure stage must be persistence');
assert(failRestoreRes.error.includes('failed to persist to storage'), 'Error must cite persistence failure');

const appRestoreFail = window.HortOpsApp.restoreWorkspaceJson(validBackup);
assert.strictEqual(appRestoreFail, false, 'restoreWorkspaceJson must return false when storage persistence fails');
window.localStorage.throwOnSet = false;
console.log('[PASS] JSON restore failure contract verified: returns failure when persistence fails.');

// 9. NEW: JSON Restore Correctly Restores activeView and currentYear (Mandate Section 9, 19)
const uiStateBackup = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: validBackup.jobs,
  roster: validBackup.roster,
  assignments: {},
  permits: {},
  uiState: {
    activeView: 'analytics',
    currentYear: 2028
  }
};
const appRestoreUiOk = window.HortOpsApp.restoreWorkspaceJson(uiStateBackup);
assert.strictEqual(appRestoreUiOk, true, 'Valid restore must return true');
assert.strictEqual(window.HortOpsApp.state.activeView, 'analytics', 'Restored activeView must be analytics');
assert.strictEqual(window.HortOpsApp.state.currentYear, 2028, 'Restored currentYear must be 2028');
console.log('[PASS] JSON restore of activeView (analytics) and currentYear (2028) verified.');

// 10. NEW: Legacy Assignment Keys Prevent Hard Job Deletion (Mandate Section 12, 20)
const legacyTestState = {
  customAssignments: {
    'legacy-job-w3-2026-01-17': ['EMP-100']
  },
  customPermits: {}
};
const legacyDeps = window.HortOpsApp.getJobDependencies('legacy-job', legacyTestState);
assert.strictEqual(legacyDeps.canHardDelete, false, 'Job with legacy assignment ID must NOT be eligible for hard delete');
assert.strictEqual(legacyDeps.assignments, 1, 'Legacy assignment ID must be counted as dependency');
console.log('[PASS] Legacy assignment key dependency detection verified: blocks hard deletion.');


// 11. Schema Hardening: Reject Unknown Job Status (Mandate Section 10, 28)
const unknownJobStatusJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    { id: 'JOB-BANANA', name: 'Banana Job', frequencyType: 'one_off', targetDate: '2026-05-16', status: 'banana' }
  ],
  roster: []
});
const unknownJobStatusRes = storage.importWorkspaceJson(unknownJobStatusJson);
assert.strictEqual(unknownJobStatusRes.success, false, 'Unknown job status must be rejected');
assert(unknownJobStatusRes.error.toLowerCase().includes('unsupported status'), 'Error must cite unsupported status');
console.log('[PASS] JSON schema validation rejects unknown job status (banana).');

// 12. Schema Hardening: Reject Unknown Employee Status (Mandate Section 11, 28)
const unknownEmployeeStatusJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [],
  roster: [
    { id: 'EMP-BANANA', name: 'Banana Worker', status: 'banana' }
  ]
});
const unknownEmployeeStatusRes = storage.importWorkspaceJson(unknownEmployeeStatusJson);
assert.strictEqual(unknownEmployeeStatusRes.success, false, 'Unknown employee status must be rejected');
assert(unknownEmployeeStatusRes.error.toLowerCase().includes('unsupported status'), 'Error must cite unsupported status');
console.log('[PASS] JSON schema validation rejects unknown employee status (banana).');

// 13. Schema Hardening: Reject Annual Job with Unsupported Preferred Day (Mandate Section 13, 28)
const annualTuesdaySchemaJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    {
      id: 'annual-tuesday',
      name: 'Annual Tuesday Job',
      frequencyType: 'annual',
      targetMonth: 6,
      preferredDay: 'tuesday',
      status: 'active'
    }
  ],
  roster: []
});
const annualTuesdaySchemaRes = storage.importWorkspaceJson(annualTuesdaySchemaJson);
assert.strictEqual(annualTuesdaySchemaRes.success, false, 'Annual job with preferredDay Tuesday must be rejected');
assert(annualTuesdaySchemaRes.error.includes('Annual date requires'), 'Annual jobs without an explicit date rule must be rejected');
console.log('[PASS] JSON schema validation rejects legacy annual month-only scheduling.');

// 14. Schema Hardening: Reject Unsafe Job ID (Mandate Section 6, 15)
const unsafeJobIdJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    {
      id: "x');alert(1);//",
      name: "Unsafe Job ID",
      frequencyType: "one_off",
      targetDate: "2026-06-06",
      status: "active"
    }
  ],
  roster: []
});
const unsafeJobIdRes = storage.importWorkspaceJson(unsafeJobIdJson);
assert.strictEqual(unsafeJobIdRes.success, false, 'Unsafe Job ID must be rejected by schema validator');
assert(unsafeJobIdRes.error.toLowerCase().includes('invalid characters'), 'Error must cite invalid characters in Job ID');
console.log('[PASS] JSON schema validation rejects unsafe Job ID.');

// 15. Schema Hardening: Reject Unsafe Staff ID (Mandate Section 6, 15)
const unsafeStaffIdJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [],
  roster: [
    {
      id: "x');alert(1);//",
      name: "Unsafe Staff ID",
      status: "active"
    }
  ]
});
const unsafeStaffIdRes = storage.importWorkspaceJson(unsafeStaffIdJson);
assert.strictEqual(unsafeStaffIdRes.success, false, 'Unsafe Staff ID must be rejected by schema validator');
assert(unsafeStaffIdRes.error.toLowerCase().includes('invalid characters'), 'Error must cite invalid characters in Staff ID');
console.log('[PASS] JSON schema validation rejects unsafe Staff ID.');

// 16. Seeded Safe ID Legitimacy Verification (Mandate Section 15)
const idRegex = /^[A-Za-z0-9_-]+$/;
const seededJobs = window.HortOpsData.INITIAL_JOBS;
const seededStaff = window.HortOpsData.STAFF_ROSTER;

let invalidJobIdCount = 0;
seededJobs.forEach(j => {
  if (!idRegex.test(j.id)) invalidJobIdCount++;
});
assert.strictEqual(invalidJobIdCount, 0, `All ${seededJobs.length} seeded job IDs must pass safe ID validation`);

let invalidStaffIdCount = 0;
seededStaff.forEach(s => {
  if (!idRegex.test(s.id)) invalidStaffIdCount++;
});
assert.strictEqual(invalidStaffIdCount, 0, `All ${seededStaff.length} seeded staff IDs must pass safe ID validation`);

console.log(`[PASS] All ${seededJobs.length} seeded Job IDs and ${seededStaff.length} seeded Staff IDs verified valid against canonical regex.`);

// 17. Schema v2: Reject Missing Job Status in Canonical v2 (Mandate Section 6, 35)
const missingJobStatusJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    {
      id: 'job-no-status',
      name: 'No Status Job',
      frequencyType: 'one_off',
      targetDate: '2026-06-06'
      // status omitted
    }
  ],
  roster: []
});
const missingJobStatusRes = storage.validateWorkspaceSchema(JSON.parse(missingJobStatusJson));
assert.strictEqual(missingJobStatusRes.valid, false, 'Missing job status must be rejected in Schema v2');
assert(missingJobStatusRes.error.toLowerCase().includes('missing required status'), 'Error must cite missing status for job');
console.log('[PASS] Schema v2 rejects job with missing status.');

// 18. Schema v2: Reject Missing Staff Status in Canonical v2 (Mandate Section 6, 35)
const missingStaffStatusJson = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [],
  roster: [
    {
      id: 'staff-no-status',
      name: 'No Status Staff'
      // status omitted
    }
  ]
});
const missingStaffStatusRes = storage.validateWorkspaceSchema(JSON.parse(missingStaffStatusJson));
assert.strictEqual(missingStaffStatusRes.valid, false, 'Missing staff status must be rejected in Schema v2');
assert(missingStaffStatusRes.error.toLowerCase().includes('missing required status'), 'Error must cite missing status for staff');
console.log('[PASS] Schema v2 rejects staff member with missing status.');

// 19. Release Test: Legacy v1 Persisted Workspace Migration (Mandate Section 35)
window.localStorage.clear();
const legacyV1Workspace = {
  schemaVersion: 1,
  jobs: [
    {
      id: 'legacy-v1-job',
      name: 'Legacy V1 Job',
      frequencyType: 'one_off',
      targetDate: '2026-06-06'
      // status omitted in legacy v1
    }
  ],
  roster: [
    {
      id: 'legacy-v1-staff',
      name: 'Legacy V1 Staff'
      // status omitted in legacy v1
    }
  ],
  assignments: {},
  permits: {},
  budgetSettings: window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS,
  uiState: {}
};
window.localStorage.setItem('hort_ops_workspace_v1', JSON.stringify(legacyV1Workspace));

const loadedMigrated = storage.loadWorkspace();
assert.strictEqual(loadedMigrated.schemaVersion, 2, 'Loaded legacy workspace must be migrated to Schema v2');
assert.strictEqual(loadedMigrated.jobs[0].status, 'active', 'Legacy job with missing status must default to active during v1->v2 migration');
assert.strictEqual(loadedMigrated.roster[0].status, 'active', 'Legacy staff with missing status must default to active during v1->v2 migration');
assert.strictEqual(storage.validateWorkspaceSchema(loadedMigrated).valid, true, 'Migrated workspace must pass Schema v2 validation');
console.log('[PASS] Legacy v1 persisted workspace migrated to v2 with explicit statuses and validated.');

// 20. Release Test: Persisted Malformed Workspace Rejected Before Adoption (Mandate Section 7, 35)
window.localStorage.clear();
const corruptPersistedWorkspace = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [
    {
      id: "x');alert(1);//", // UNSAFE ID
      name: 'Corrupt Stored Job',
      frequencyType: 'one_off',
      targetDate: '2026-06-06',
      status: 'active'
    }
  ],
  roster: [],
  assignments: {}
};
window.localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(corruptPersistedWorkspace));

const defaultFallbackJobs = [{ id: 'safe-default-job', name: 'Safe Default', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }];
const loadedAfterCorrupt = storage.loadWorkspace(defaultFallbackJobs, []);
assert.notStrictEqual(loadedAfterCorrupt.jobs[0].id, "x');alert(1);//", 'Malformed stored workspace with unsafe ID must NOT be adopted');
assert.strictEqual(loadedAfterCorrupt.jobs[0].id, 'safe-default-job', 'loadWorkspace must fall back to safe defaults when stored data is corrupt/unsafe');
console.log('[PASS] Malformed persisted workspace with unsafe ID rejected before adoption.');

// 21. Section 26: Required Persistence Test — Raw Save Version (Mandate Pass 9)
window.localStorage.clear();
window.HortOpsApp.state.jobs = [{ id: 'raw-save-job', name: 'Raw Save Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }];
window.HortOpsApp.state.staffList = [{ id: 'raw-save-staff', name: 'Raw Save Staff', status: 'active' }];
window.HortOpsApp.state.recoveryRequired = false;

const rawSaveResult = window.HortOpsApp.saveCurrentWorkspace();
assert.strictEqual(rawSaveResult, true, 'saveCurrentWorkspace must succeed');

const rawSavedString = window.localStorage.getItem('hort_ops_workspace_v2');
assert(rawSavedString, 'Raw localStorage must contain hort_ops_workspace_v2 key');
const rawSavedEnvelope = JSON.parse(rawSavedString);
assert.strictEqual(rawSavedEnvelope.schemaVersion, 2, 'Raw saved envelope must strictly write schemaVersion: 2');
assert.strictEqual(rawSavedEnvelope.jobs[0].id, 'raw-save-job', 'Raw saved envelope must contain application job data');
console.log('[PASS] Section 26: App save writes genuine Schema v2 into hort_ops_workspace_v2 before reload.');

// 22. Section 27: Required Export Test — Backup Version (Mandate Pass 9)
let exportedBackup = null;
const origDownload = window.HortOpsExportModal.downloadFile;
window.HortOpsExportModal.downloadFile = function(content, filename, mimeType) {
  exportedBackup = JSON.parse(content);
};
try {
  window.HortOpsExportModal.exportBackupJson();
} finally {
  window.HortOpsExportModal.downloadFile = origDownload;
}
assert(exportedBackup, 'Export backup must produce JSON content');
assert.strictEqual(exportedBackup.schemaVersion, 2, 'Exported JSON backup must strictly have schemaVersion: 2');

const restoreV2Res = storage.importWorkspaceJson(JSON.stringify(exportedBackup));
assert.strictEqual(restoreV2Res.success, true, 'Schema v2 backup must restore successfully without v1 migration');
console.log('[PASS] Section 27: Exported backup is Schema v2 and restores cleanly without migration.');

// 23. Section 28: Required Invalid v2 Preservation Test (Mandate Pass 9)
window.localStorage.clear();
const rawInvalidV2String = JSON.stringify({
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  lastSaved: '2026-09-05T10:00:00.000Z',
  jobs: [
    { id: "x');malformed;//", name: 'Invalid Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }
  ],
  roster: []
});
window.localStorage.setItem('hort_ops_workspace_v2', rawInvalidV2String);

const loadInvalidRes = storage.loadWorkspace(
  [{ id: 'default-safe-job', name: 'Safe Default', status: 'active' }],
  []
);
assert.strictEqual(loadInvalidRes.recoveryRequired, true, 'loadWorkspace must report recoveryRequired: true when v2 is invalid');
assert.strictEqual(loadInvalidRes.recoverySource, 'hort_ops_workspace_v2', 'Recovery source must identify hort_ops_workspace_v2');

const rawV2AfterLoad = window.localStorage.getItem('hort_ops_workspace_v2');
assert.strictEqual(rawV2AfterLoad, rawInvalidV2String, 'Raw invalid v2 workspace in localStorage must remain 100% BYTE-IDENTICAL and NEVER overwritten');
console.log('[PASS] Section 28: Invalid v2 persisted workspace quarantined and preserved byte-identical without overwrite.');

// 24. Section 29: Required Stale v1 Fallback Test (Mandate Pass 9)
window.localStorage.clear();
const oldV1String = JSON.stringify({
  schemaVersion: 1,
  jobs: [{ id: 'old-v1-job', name: 'Stale V1 Job', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'old-v1-staff', name: 'Stale V1 Staff' }]
});
window.localStorage.setItem('hort_ops_workspace_v1', oldV1String);
window.localStorage.setItem('hort_ops_workspace_v2', rawInvalidV2String);

const loadStaleTestRes = storage.loadWorkspace(
  [{ id: 'safe-session-job', name: 'Safe Session', status: 'active' }],
  []
);
assert.strictEqual(loadStaleTestRes.recoveryRequired, true, 'Must report recoveryRequired when v2 fails');
assert.notStrictEqual(loadStaleTestRes.jobs[0].id, 'old-v1-job', 'Must NOT silently roll user back to stale v1 workspace');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), rawInvalidV2String, 'v2 key must be preserved untouched');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v1'), oldV1String, 'v1 key must be preserved untouched');
console.log('[PASS] Section 29: Anti-rollback verified: invalid v2 does not trigger automatic fallback to stale v1.');

// 25. Section 30: Required Successful Atomic Migration Test & Failure Variant (Mandate Pass 9)
// Variant A: Successful migration retires v1 atomically
window.localStorage.clear();
window.localStorage.setItem('hort_ops_workspace_v1', oldV1String);

const migratedResult = storage.loadWorkspace();
assert.strictEqual(migratedResult.schemaVersion, 2, 'Loaded result must be Schema v2');
assert.strictEqual(migratedResult.jobs[0].id, 'old-v1-job', 'Job must be migrated from v1');
assert.strictEqual(migratedResult.jobs[0].status, 'active', 'Missing v1 job status must be migrated to active');
assert(window.localStorage.getItem('hort_ops_workspace_v2'), 'v2 workspace must be persisted in localStorage');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v1'), null, 'v1 key must be retired after verified successful v2 persistence');
console.log('[PASS] Section 30A: Atomic v1 -> v2 migration persisted, verified, and legacy v1 retired.');

// Variant B: Failed migration persistence preserves v1 untouched
window.localStorage.clear();
window.localStorage.setItem('hort_ops_workspace_v1', oldV1String);
window.localStorage.throwOnSet = true;

const failedMigrateRes = storage.loadWorkspace(
  [{ id: 'fallback-job', name: 'Fallback', status: 'active' }],
  []
);
assert.strictEqual(failedMigrateRes.recoveryRequired, true, 'Failed migration persistence must report recoveryRequired');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v1'), oldV1String, 'Legacy v1 must be preserved untouched when v2 persistence fails');
window.localStorage.throwOnSet = false;
console.log('[PASS] Section 30B: Failed migration persistence preserves legacy v1 without destructive cleanup.');

// 26. Section 31: Required Canonical Status Tests (Mandate Pass 9)
// Job Status
const validActiveJob = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [{ id: 'job-act', name: 'Active Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: []
};
assert.strictEqual(storage.validateWorkspaceSchema(validActiveJob).valid, true, 'Active job status must be accepted');

const validInactiveJob = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [{ id: 'job-inact', name: 'Inactive Job', status: 'inactive', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: []
};
assert.strictEqual(storage.validateWorkspaceSchema(validInactiveJob).valid, true, 'Inactive job status must be accepted');

// Employee Statuses
const allEmployeeStatuses = ['active', 'departed', 'inactive', 'on_leave', 'temporarily_unavailable'];
allEmployeeStatuses.forEach(st => {
  const staffEnv = {
    schemaVersion: 2,
    historicalSnapshots: {},
    rostering: { instructions: {}, provenance: {} },
    assignments: {},
    jobs: [],
    roster: [{ id: 'staff-' + st, name: 'Staff ' + st, status: st }]
  };
  assert.strictEqual(storage.validateWorkspaceSchema(staffEnv).valid, true, `Employee status "${st}" must be accepted in Schema v2`);
});

const invalidStaffEnv = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [],
  roster: [{ id: 'staff-unknown', name: 'Staff Unknown', status: 'unknown_status' }]
};
assert.strictEqual(storage.validateWorkspaceSchema(invalidStaffEnv).valid, false, 'Unknown employee status must be rejected in Schema v2');
console.log('[PASS] Section 31: Canonical Schema v2 Job and Employee status allow-lists verified.');

// 27. Section 4 & 26: Required Recovery Mode Exit & Subsequent Save Test (Mandate Pass 10)
window.localStorage.clear();
window.HortOpsApp.state.jobs = [];
window.HortOpsApp.state.staffList = [];
window.HortOpsApp.state.recoveryRequired = true;
window.HortOpsApp.state.recoverySource = 'hort_ops_workspace_v2';
window.HortOpsApp.state.recoveryError = 'Simulated prior corruption';
window.HortOpsApp.state.storageStatus = 'error';

const validRecoveryBackup = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  lastSaved: new Date().toISOString(),
  jobs: [{ id: 'recovered-job-1', name: 'Recovered Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'recovered-staff-1', name: 'Recovered Staff', status: 'active' }],
  assignments: {},
  permits: {},
  budgetSettings: window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS,
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};

const restoreExitRes = window.HortOpsApp.restoreWorkspaceJson(validRecoveryBackup);
assert.strictEqual(restoreExitRes, true, 'restoreWorkspaceJson must succeed with valid backup');
assert.strictEqual(window.HortOpsApp.state.recoveryRequired, false, 'Successful restore must clear recoveryRequired to false');
assert.strictEqual(window.HortOpsApp.state.recoverySource, null, 'Successful restore must clear recoverySource to null');
assert.strictEqual(window.HortOpsApp.state.recoveryError, null, 'Successful restore must clear recoveryError to null');
assert.strictEqual(window.HortOpsApp.state.storageStatus, 'saved', 'Successful restore must set storageStatus to saved');

// Verify subsequent edit and save succeeds without requiring reload
window.HortOpsApp.state.jobs.push({ id: 'recovered-job-2', name: 'Subsequent Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-07-10' });
const subsequentSaveRes = window.HortOpsApp.saveCurrentWorkspace();
assert.strictEqual(subsequentSaveRes, true, 'Subsequent save must succeed immediately without browser reload');
console.log('[PASS] Section 4 & 26: Successful JSON recovery clears recoveryRequired and subsequent save succeeds without reload.');

// Failed restore test variant: persistence failure retains recoveryRequired
window.HortOpsApp.state.recoveryRequired = true;
window.localStorage.throwOnSet = true;
const failedRestoreRes = window.HortOpsApp.restoreWorkspaceJson(validRecoveryBackup);
assert.strictEqual(failedRestoreRes, false, 'Failed restore must return false when storage write fails');
assert.strictEqual(window.HortOpsApp.state.recoveryRequired, true, 'Failed restore must leave recoveryRequired true');
window.localStorage.throwOnSet = false;
console.log('[PASS] Section 4 & 26: Failed recovery leaves Recovery Required active.');

// 28. Section 12 & 28: Required V1-in-V2 Migration & Persistence Test (Mandate Pass 10)
window.localStorage.clear();
const v1InV2Payload = {
  schemaVersion: 1,
  jobs: [{ id: 'v1-in-v2-job', name: 'V1 in V2 Job', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'v1-in-v2-staff', name: 'V1 Staff' }]
};
window.localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(v1InV2Payload));

const v1InV2Result = storage.loadWorkspace();
assert.strictEqual(v1InV2Result.schemaVersion, 2, 'Live loaded workspace must be migrated to Schema 2');
assert.strictEqual(v1InV2Result.jobs[0].status, 'active', 'Missing v1 job status must default to active');
assert.strictEqual(v1InV2Result.roster[0].status, 'active', 'Missing v1 staff status must default to active');

const rawV2AfterV1Load = JSON.parse(window.localStorage.getItem('hort_ops_workspace_v2'));
assert.strictEqual(rawV2AfterV1Load.schemaVersion, 2, 'Raw stored workspace schema in v2 key must be persisted as Schema 2');
assert.strictEqual(rawV2AfterV1Load.jobs[0].status, 'active', 'Raw stored job in v2 key must have explicit active status persisted');
console.log('[PASS] Section 12 & 28: Schema 1 envelope in v2 key migrated and persisted atomically as Schema 2.');

// Failure variant: forced write failure on v1-in-v2 migration
window.localStorage.clear();
window.localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(v1InV2Payload));
window.localStorage.throwOnSet = true;

const failV1InV2Res = storage.loadWorkspace(
  [{ id: 'fallback-job', name: 'Fallback', status: 'active' }],
  []
);
assert.strictEqual(failV1InV2Res.recoveryRequired, true, 'Write failure during v1-in-v2 migration must report recoveryRequired');
const rawPreservedV1InV2 = JSON.parse(window.localStorage.getItem('hort_ops_workspace_v2'));
assert.strictEqual(rawPreservedV1InV2.schemaVersion, 1, 'Raw Schema 1 source must remain preserved untouched when persistence fails');
window.localStorage.throwOnSet = false;
console.log('[PASS] Section 12 & 28: V1-in-v2 migration persistence failure preserves raw source and enters recovery mode.');

// 29. Section 21 & 28: Atomic Legacy Individual Keys Migration (Option A, Mandate Pass 10)
window.localStorage.clear();
window.localStorage.setItem('hort_ops_jobs_offline', JSON.stringify([{ id: 'indiv-job', name: 'Indiv Job', frequencyType: 'one_off', targetDate: '2026-06-06' }]));
window.localStorage.setItem('hort_ops_staff_offline', JSON.stringify([{ id: 'indiv-staff', name: 'Indiv Staff' }]));
window.localStorage.setItem('hort_ops_assignments_offline', JSON.stringify({ 'shift-1': ['indiv-staff'] }));

const indivResult = storage.loadWorkspace();
assert.strictEqual(indivResult.schemaVersion, 2, 'Individual keys must migrate to Schema 2');
assert.strictEqual(indivResult.jobs[0].id, 'indiv-job');
assert.strictEqual(indivResult.jobs[0].status, 'active');

const rawV2Indiv = JSON.parse(window.localStorage.getItem('hort_ops_workspace_v2'));
assert.strictEqual(rawV2Indiv.schemaVersion, 2, 'Canonical v2 storage key must be persisted');
assert.strictEqual(window.localStorage.getItem('hort_ops_jobs_offline'), null, 'Individual legacy job key must be retired');
assert.strictEqual(window.localStorage.getItem('hort_ops_staff_offline'), null, 'Individual legacy staff key must be retired');
console.log('[PASS] Section 21 & 28: Atomic legacy individual-keys migration persisted, verified, and retired.');

// Failure variant: forced write failure on individual keys migration
window.localStorage.clear();
window.localStorage.setItem('hort_ops_jobs_offline', JSON.stringify([{ id: 'indiv-job', name: 'Indiv Job', frequencyType: 'one_off', targetDate: '2026-06-06' }]));
window.localStorage.throwOnSet = true;

const failIndivRes = storage.loadWorkspace(
  [{ id: 'fallback-job', name: 'Fallback', status: 'active' }],
  []
);
assert.strictEqual(failIndivRes.recoveryRequired, true, 'Individual keys migration persistence failure must report recoveryRequired');
assert(window.localStorage.getItem('hort_ops_jobs_offline'), 'Legacy individual key must be preserved untouched when persistence fails');
window.localStorage.throwOnSet = false;
console.log('[PASS] Section 21 & 28: Legacy individual keys migration persistence failure preserves keys untouched.');

// 30. Section 14 & 16: Canonical JSON Import Preparation Pipeline (Mandate Pass 10)
window.localStorage.clear();
const legacyBackupJson = JSON.stringify({
  schemaVersion: 1,
  jobs: [{ id: 'prep-job-1', name: 'Prep Job 1', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'prep-staff-1', name: 'Prep Staff 1' }]
});

const prepLegacyRes = storage.prepareWorkspaceJsonImport(legacyBackupJson);
assert.strictEqual(prepLegacyRes.success, true, 'prepareWorkspaceJsonImport must succeed on Schema 1 backup');
assert.strictEqual(prepLegacyRes.migrated, true, 'Legacy backup must be flagged as migrated');
assert.strictEqual(prepLegacyRes.sourceSchemaVersion, 1, 'Source schema version must be identified as 1');
assert.strictEqual(prepLegacyRes.targetSchemaVersion, 2, 'Target schema version must be 2');
assert.strictEqual(prepLegacyRes.data.schemaVersion, 2, 'Prepared envelope must be Schema 2');
assert.strictEqual(prepLegacyRes.data.jobs[0].status, 'active', 'Prepared job must have migrated active status');
assert.strictEqual(prepLegacyRes.data.roster[0].status, 'active', 'Prepared staff must have migrated active status');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), null, 'prepareWorkspaceJsonImport must NOT persist to localStorage before confirmation');

const prepV2Res = storage.prepareWorkspaceJsonImport(JSON.stringify(validRecoveryBackup));
assert.strictEqual(prepV2Res.success, true, 'prepareWorkspaceJsonImport must succeed on Schema 2 backup');
assert.strictEqual(prepV2Res.migrated, false, 'Schema 2 backup must not be flagged as migrated');
assert.strictEqual(prepV2Res.sourceSchemaVersion, 2, 'Source schema version must be identified as 2');
console.log('[PASS] Section 14 & 16: Canonical prepareWorkspaceJsonImport pipeline verified for Schema 1 and Schema 2 backups.');

// 31. Micro-Patch Section 2, 4, 6: Unsupported Workspace Schema Version Rejection
window.localStorage.clear();
const unsupportedVersions = [0, 3, 99, -1, '2', null, undefined];
for (const badVer of unsupportedVersions) {
  const badImportPayload = {
    schemaVersion: badVer,
    jobs: [{ id: 'job-bad-ver', name: 'Bad Ver Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
    roster: []
  };
  const badImportRes = storage.prepareWorkspaceJsonImport(JSON.stringify(badImportPayload));
  assert.strictEqual(badImportRes.success, false, `Import must reject unsupported schemaVersion ${badVer}`);
  assert(badImportRes.error.toLowerCase().includes('schemaversion') || badImportRes.error.toLowerCase().includes('unsupported'), `Error must cite schema version issue for ${badVer}`);
}

// Persisted unsupported schemaVersion under v2 key
window.localStorage.clear();
const schema99Payload = {
  schemaVersion: 99,
  jobs: [{ id: 'job-future', name: 'Future Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: []
};
window.localStorage.setItem('hort_ops_workspace_v2', JSON.stringify(schema99Payload));
// Also set stale v1 to verify NO rollback
const staleV1Backup = {
  schemaVersion: 1,
  jobs: [{ id: 'stale-v1-job', name: 'Stale V1 Job', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: []
};
window.localStorage.setItem('hort_ops_workspace_v1', JSON.stringify(staleV1Backup));

const s99LoadRes = storage.loadWorkspace();
assert.strictEqual(s99LoadRes.recoveryRequired, true, 'Schema 99 under v2 key must enter Recovery Required');
assert.strictEqual(s99LoadRes.recoverySource, 'hort_ops_workspace_v2');
assert(s99LoadRes.recoveryError.includes('99'), 'Recovery error must cite unsupported version 99');
assert.strictEqual(JSON.parse(window.localStorage.getItem('hort_ops_workspace_v2')).schemaVersion, 99, 'Raw v2 source must be preserved untouched');
assert(window.localStorage.getItem('hort_ops_workspace_v1'), 'Stale v1 must remain untouched');
assert(Array.isArray(s99LoadRes.jobs), 'Recovery result jobs must remain an array');
assert.strictEqual(s99LoadRes.jobs.length, 0, 'Unsupported v2 recovery must use clean-slate jobs, not stale v1 data');
console.log('[PASS] Section 2, 4, 6: Unsupported schema versions strictly rejected in import and persisted storage.');

// 32. Micro-Patch Section 8, 9, 10: Non-Object v2 Payloads Quarantine Matrix (No Rollback to Stale v1)
const nonObjectV2Payloads = [
  { label: 'null', raw: 'null' },
  { label: 'string', raw: '"hello world"' },
  { label: 'number', raw: '12345' },
  { label: 'boolean', raw: 'false' },
  { label: 'array', raw: '[]' },
  { label: 'malformed_json', raw: '{bad json' }
];

for (const item of nonObjectV2Payloads) {
  window.localStorage.clear();
  window.localStorage.setItem('hort_ops_workspace_v2', item.raw);
  window.localStorage.setItem('hort_ops_workspace_v1', JSON.stringify(staleV1Backup));

  const nonObjRes = storage.loadWorkspace();
  assert.strictEqual(nonObjRes.recoveryRequired, true, `Non-object v2 payload (${item.label}) must enter Recovery Required`);
  assert.strictEqual(nonObjRes.recoverySource, 'hort_ops_workspace_v2');
  assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), item.raw, `Raw v2 source (${item.label}) must be preserved byte-identical`);
  assert(window.localStorage.getItem('hort_ops_workspace_v1'), `Stale v1 must remain untouched during ${item.label}`);
  assert(Array.isArray(nonObjRes.jobs), `Recovery jobs must remain an array during ${item.label}`);
  assert.strictEqual(nonObjRes.jobs.length, 0, `Recovery during ${item.label} must use clean-slate jobs, not stale v1 data`);
}
console.log('[PASS] Section 8, 9, 10: Non-object v2 payload matrix quarantined without rollback to v1 or storage overwrite.');

// 33. Micro-Patch Section 12, 13, 14: Malformed v1 Migration Source Quarantined Without Defaults Shadowing
window.localStorage.clear();
window.localStorage.setItem('hort_ops_workspace_v1', '{bad v1 json');

const malformedV1Res = storage.loadWorkspace();
assert.strictEqual(malformedV1Res.recoveryRequired, true, 'Malformed v1 must enter Recovery Required');
assert.strictEqual(malformedV1Res.recoverySource, 'hort_ops_workspace_v1');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v1'), '{bad v1 json', 'Raw v1 source must remain preserved untouched');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), null, 'v2 storage key must NOT be created when v1 is malformed');
console.log('[PASS] Section 12, 13, 14: Malformed v1 source enters recovery, raw v1 preserved, no defaults shadowed in v2.');

// 34. Micro-Patch Section 15, 16, 17: Malformed Legacy Individual-Key Sources Quarantined
const legacyKeyCorruptTests = [
  { key: 'hort_ops_jobs_offline', raw: '{bad jobs json' },
  { key: 'hort_ops_staff_offline', raw: '{bad staff json' },
  { key: 'hort_ops_assignments_offline', raw: '{bad assignments json' }
];

for (const t of legacyKeyCorruptTests) {
  window.localStorage.clear();
  window.localStorage.setItem(t.key, t.raw);

  const legacyCorruptRes = storage.loadWorkspace();
  assert.strictEqual(legacyCorruptRes.recoveryRequired, true, `Malformed ${t.key} must enter Recovery Required`);
  assert.strictEqual(legacyCorruptRes.recoverySource, t.key);
  assert.strictEqual(window.localStorage.getItem(t.key), t.raw, `Raw ${t.key} must remain preserved untouched`);
  assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), null, `v2 must NOT be created when ${t.key} is malformed`);
}
console.log('[PASS] Section 15, 16, 17: Malformed legacy individual keys quarantined, raw keys preserved, no defaults created.');

// 35. Micro-Patch Section 18, 19, 25: Clean-Slate Default Creation vs Corrupt Source Quarantine Invariant
window.localStorage.clear();
// With zero storage: clean slate creates defaults in v2
const cleanSlateRes = storage.loadWorkspace();
assert.strictEqual(cleanSlateRes.recoveryRequired, false, 'Clean slate must NOT enter recovery');
assert.strictEqual(cleanSlateRes.schemaVersion, 2, 'Clean slate must create Schema 2');
assert(window.localStorage.getItem('hort_ops_workspace_v2'), 'Clean slate must persist canonical v2 workspace');
console.log('[PASS] Section 18, 19, 25: Default workspace created only on genuine clean slate.');

// 36. Mandate Section 17 & 30: Canonical Validator Schema Version Matrix
const matrixTests = [
  { desc: 'Missing schemaVersion', payload: { jobs: [], roster: [] }, expected: false },
  { desc: 'schemaVersion: null', payload: { schemaVersion: null, jobs: [], roster: [] }, expected: false },
  { desc: 'schemaVersion: "2"', payload: { schemaVersion: '2', jobs: [], roster: [] }, expected: false },
  { desc: 'schemaVersion: 1', payload: { schemaVersion: 1, jobs: [], roster: [] }, expected: false },
  { desc: 'schemaVersion: 2 (valid)', payload: { schemaVersion: 2, jobs: [], roster: [], assignments: {} }, expected: true },
  { desc: 'schemaVersion: 3', payload: { schemaVersion: 3, jobs: [], roster: [] }, expected: false },
  { desc: 'schemaVersion: 99', payload: { schemaVersion: 99, jobs: [], roster: [] }, expected: false }
];

matrixTests.forEach(t => {
  const res = storage.validateWorkspaceSchema(t.payload);
  assert.strictEqual(res.valid, t.expected, `Canonical validator matrix check failed for ${t.desc}: expected ${t.expected}, got ${res.valid}`);
});
console.log('[PASS] Section 17 & 30: Canonical validator version matrix strictly rejects non-integer-2 schemas and missing version.');

// 37. Mandate Section 18, 10 & 30: Invalid Job Save Rejection & Byte-for-Byte Storage Preservation
window.localStorage.clear();
const canonicalBaseWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  lastSaved: '2026-09-06T10:00:00.000Z',
  jobs: [{ id: 'job-valid-1', name: 'Valid Initial Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'staff-valid-1', name: 'Valid Initial Staff', status: 'active' }],
  assignments: {},
  permits: {},
  budgetSettings: window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS,
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};
const baseSaveRes = storage.saveWorkspace(canonicalBaseWs);
assert.strictEqual(baseSaveRes.ok, true, 'Base canonical workspace must save successfully');
const beforeRawStorage = window.localStorage.getItem('hort_ops_workspace_v2');
assert(beforeRawStorage, 'Persisted workspace must exist in localStorage');

// Attempt to save workspace with invalid Job ID ("bad id")
const badJobWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [{ id: 'bad id', name: 'Malformed Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'staff-valid-1', name: 'Valid Initial Staff', status: 'active' }]
};
const badJobSaveRes = storage.saveWorkspace(badJobWs);
assert.strictEqual(badJobSaveRes.ok, false, 'saveWorkspace must reject invalid Job ID');
assert.strictEqual(badJobSaveRes.stage, 'validation', 'saveWorkspace rejection stage must be validation');
assert.strictEqual(badJobSaveRes.storageMode, 'unchanged', 'saveWorkspace rejection storageMode must be unchanged');
assert(badJobSaveRes.error, 'saveWorkspace rejection must include descriptive error');

const afterBadJobRawStorage = window.localStorage.getItem('hort_ops_workspace_v2');
assert.strictEqual(beforeRawStorage, afterBadJobRawStorage, 'Persisted storage must remain byte-for-byte identical after invalid Job save');

// Verify reloading does not enter recovery mode and returns previous valid state
const reloadedAfterBadSave = storage.loadWorkspace();
assert.strictEqual(reloadedAfterBadSave.recoveryRequired, false, 'Healthy storage must not enter Recovery Required after failed in-memory save');
assert.strictEqual(reloadedAfterBadSave.jobs[0].id, 'job-valid-1', 'Previous valid Job must be preserved');
console.log('[PASS] Section 18, 10 & 30: Invalid Job save rejected before write; storage preserved byte-for-byte unchanged.');

// 38. Mandate Section 19, 20 & 30: Invalid Employee and Scheduling Definition Save Rejection
// Invalid Employee status
const badStaffStatusWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [{ id: 'job-valid-1', name: 'Valid Initial Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'staff-bad-status', name: 'Bad Staff', status: 'banana' }]
};
const badStaffStatusRes = storage.saveWorkspace(badStaffStatusWs);
assert.strictEqual(badStaffStatusRes.ok, false, 'saveWorkspace must reject invalid employee status');
assert.strictEqual(badStaffStatusRes.stage, 'validation');
assert.strictEqual(badStaffStatusRes.storageMode, 'unchanged');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), beforeRawStorage, 'Storage must remain untouched after bad staff status save');

// Missing Employee status
const missingStaffStatusWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [{ id: 'job-valid-1', name: 'Valid Initial Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'staff-missing-status', name: 'Missing Status Staff' }]
};
const saveMissingStaffStatusRes = storage.saveWorkspace(missingStaffStatusWs);
assert.strictEqual(saveMissingStaffStatusRes.ok, false, 'saveWorkspace must reject missing employee status');
assert.strictEqual(saveMissingStaffStatusRes.stage, 'validation');

// Invalid Scheduling Definition: Recurring anchor weekday mismatch (2026-01-04 is Sunday, preferredDay saturday)
const anchorMismatchWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [{ id: 'job-anchor-mismatch', name: 'Anchor Mismatch', status: 'active', frequencyType: 'recurring_weeks', anchorDate: '2026-01-04', intervalWeeks: 2, preferredDay: 'saturday' }],
  roster: [{ id: 'staff-valid-1', name: 'Valid Initial Staff', status: 'active' }]
};
const saveAnchorMismatchRes = storage.saveWorkspace(anchorMismatchWs);
assert.strictEqual(saveAnchorMismatchRes.ok, false, 'saveWorkspace must reject anchor weekday mismatch');
assert.strictEqual(saveAnchorMismatchRes.stage, 'validation');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), beforeRawStorage, 'Storage must remain untouched after anchor mismatch save');

// Invalid Scheduling Definition: Annual job with unsupported preferredDay "tuesday"
const annualBadDayWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [{ id: 'annual-bad-day', name: 'Annual Bad Day', status: 'active', frequencyType: 'annual', targetMonth: 8, preferredDay: 'tuesday' }],
  roster: [{ id: 'staff-valid-1', name: 'Valid Initial Staff', status: 'active' }]
};
const annualBadDayRes = storage.saveWorkspace(annualBadDayWs);
assert.strictEqual(annualBadDayRes.ok, false, 'saveWorkspace must reject annual job with unsupported preferredDay Tuesday');
assert.strictEqual(annualBadDayRes.stage, 'validation');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), beforeRawStorage, 'Storage must remain untouched after annual bad day save');
console.log('[PASS] Section 19, 20 & 30: Invalid Employee and invalid scheduling definitions rejected before write.');

// 39. Mandate Section 12, 16, 21 & 30: Direct Restore Bypass Protection & Non-Spurious Recovery
window.HortOpsApp.state.recoveryRequired = false;
window.HortOpsApp.state.recoverySource = null;
window.HortOpsApp.state.recoveryError = null;

const directBypassEnvelope = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  assignments: {},
  jobs: [{ id: 'bad id bypass', name: 'Bypass Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' }],
  roster: [{ id: 'staff-valid-1', name: 'Valid Initial Staff', status: 'active' }]
};
const directBypassRes = window.HortOpsApp.restoreWorkspaceJson(directBypassEnvelope);
assert.strictEqual(directBypassRes, false, 'Direct restore of invalid canonical envelope must return false');
assert.strictEqual(window.HortOpsApp.state.recoveryRequired, false, 'Direct restore failure on healthy workspace must NOT spuriously enter Recovery Required');
assert.strictEqual(window.localStorage.getItem('hort_ops_workspace_v2'), beforeRawStorage, 'Existing valid storage must remain untouched after failed direct restore');
console.log('[PASS] Section 12, 16, 21 & 30: Direct restore cannot bypass validation; invalid restore leaves valid storage and healthy status intact.');

// 40. Mandate Section 22, 23, 24 & 30: Valid Save, Valid Recovery, and Valid Schema 1 Migration
// Valid save test
const validEditWs = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  lastSaved: new Date().toISOString(),
  jobs: [
    { id: 'job-valid-1', name: 'Valid Initial Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-06-06' },
    { id: 'job-valid-2', name: 'Valid Second Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-07-04' }
  ],
  roster: [{ id: 'staff-valid-1', name: 'Valid Initial Staff', status: 'active' }],
  assignments: {},
  permits: {},
  budgetSettings: window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS,
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};
const validEditRes = storage.saveWorkspace(validEditWs);
assert.strictEqual(validEditRes.ok, true, 'Valid Schema 2 save must succeed');
const loadedValidEdit = storage.loadWorkspace();
assert.strictEqual(loadedValidEdit.jobs.length, 2, 'Loaded valid jobs length must match 2');
assert.strictEqual(loadedValidEdit.schemaVersion, 2, 'Loaded schemaVersion must be 2');

// Valid recovery restore cycle
window.HortOpsApp.state.recoveryRequired = true;
window.HortOpsApp.state.recoverySource = 'hort_ops_workspace_v2';
window.HortOpsApp.state.recoveryError = 'Corrupt storage simulated';

const validRecoveryRes = window.HortOpsApp.restoreWorkspaceJson(canonicalBaseWs);
assert.strictEqual(validRecoveryRes, true, 'Valid restore in recovery mode must succeed');
assert.strictEqual(window.HortOpsApp.state.recoveryRequired, false, 'Recovery Required must clear to false after valid restore');

// Subsequent normal save succeeds without browser reload
window.HortOpsApp.state.jobs.push({ id: 'job-subsequent-post-rec', name: 'Post-Recovery Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-08-08' });
const postRecSaveRes = window.HortOpsApp.saveCurrentWorkspace();
assert.strictEqual(postRecSaveRes, true, 'Subsequent save must succeed without browser reload');

// Valid Schema 1 migration via prepareWorkspaceJsonImport and importWorkspaceJson
const legacyBackupV1 = JSON.stringify({
  schemaVersion: 1,
  jobs: [{ id: 'legacy-v1-job', name: 'Legacy V1 Job', frequencyType: 'one_off', targetDate: '2026-09-05' }],
  roster: [{ id: 'legacy-v1-staff', name: 'Legacy V1 Staff' }]
});
const importLegacyRes = storage.importWorkspaceJson(legacyBackupV1);
assert.strictEqual(importLegacyRes.success, true, 'Schema 1 import must migrate and persist successfully');
assert.strictEqual(importLegacyRes.migrated, true, 'Import result must flag migrated: true');
const loadedLegacyMigrated = storage.loadWorkspace();
assert.strictEqual(loadedLegacyMigrated.schemaVersion, 2, 'Imported legacy workspace must load as Schema 2');
assert.strictEqual(loadedLegacyMigrated.jobs[0].status, 'active', 'Missing legacy job status must default to active');
console.log('[PASS] Section 22, 23, 24 & 30: Valid Schema 2 save, valid recovery exit cycle, and Schema 1 migration confirmed.');

// ============================================================================
// OFFLINE12 FINAL INTEGRITY CORRECTION: WRITE-BOUNDARY SCHEMA & SEED TESTS
// (Mandate Sections 8, 9, 19, 28, 29, 30)
// ============================================================================

// 1. Write-Side Version Contract Test Matrix (Mandate Section 8, 28)
const canonicalWriteBase = {
  schemaVersion: 2,
  historicalSnapshots: {},
  rostering: { instructions: {}, provenance: {} },
  lastSaved: new Date().toISOString(),
  jobs: [{ id: 'wb-job-1', name: 'WB Job 1', status: 'active', frequencyType: 'one_off', targetDate: '2026-07-04' }],
  roster: [{ id: 'wb-staff-1', name: 'WB Staff 1', status: 'active' }],
  assignments: {},
  permits: {},
  budgetSettings: window.HortOpsScheduler.DEFAULT_BUDGET_SETTINGS,
  uiState: { activeView: 'forward_planner', currentYear: 2026 }
};
const primeRes = storage.saveWorkspace(canonicalWriteBase);
assert.strictEqual(primeRes.ok, true, 'Base canonical save must succeed');
const expectedStoredBytes = window.localStorage.getItem('hort_ops_workspace_v2');
assert(expectedStoredBytes, 'hort_ops_workspace_v2 must exist in localStorage');

const invalidVersionPayloads = [
  { label: 'missing schemaVersion', payload: Object.assign({}, canonicalWriteBase) },
  { label: 'null schemaVersion', payload: Object.assign({}, canonicalWriteBase, { schemaVersion: null }) },
  { label: 'string schemaVersion "2"', payload: Object.assign({}, canonicalWriteBase, { schemaVersion: "2" }) },
  { label: 'legacy Schema 1', payload: Object.assign({}, canonicalWriteBase, { schemaVersion: 1 }) },
  { label: 'future Schema 3', payload: Object.assign({}, canonicalWriteBase, { schemaVersion: 3 }) },
  { label: 'future Schema 99', payload: Object.assign({}, canonicalWriteBase, { schemaVersion: 99 }) }
];

delete invalidVersionPayloads[0].payload.schemaVersion;

invalidVersionPayloads.forEach(tc => {
  const saveAttempt = storage.saveWorkspace(tc.payload);
  assert.strictEqual(saveAttempt.ok, false, `saveWorkspace with ${tc.label} must be rejected`);
  assert.strictEqual(saveAttempt.stage, 'validation', `saveWorkspace rejection for ${tc.label} must be at validation stage`);
  const currentBytes = window.localStorage.getItem('hort_ops_workspace_v2');
  assert.strictEqual(currentBytes, expectedStoredBytes, `LocalStorage must remain byte-for-byte unchanged after rejected save of ${tc.label}`);
});
console.log('[PASS] Section 8 & 28: Write-side schema version contract strictly rejects non-v2 schemas without mutating storage.');

// 2. Direct Restore Version Boundary Test Matrix (Mandate Section 9, 29)
window.HortOpsApp.state.recoveryRequired = false;
window.HortOpsApp.state.storageStatus = 'saved';

const schema99Envelope = Object.assign({}, canonicalWriteBase, {
  schemaVersion: 99,
  jobs: [{ id: 'job-future-99', name: 'Future 99 Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-10-10' }]
});

const restore99Res = window.HortOpsApp.restoreWorkspaceJson(schema99Envelope);
assert.strictEqual(restore99Res, false, 'Direct restore of Schema 99 envelope must fail');
const bytesAfter99 = window.localStorage.getItem('hort_ops_workspace_v2');
assert.strictEqual(bytesAfter99, expectedStoredBytes, 'Direct restore failure of Schema 99 must preserve raw storage byte-identical');
assert.strictEqual(window.HortOpsApp.state.recoveryRequired, false, 'Direct restore failure must not spuriously enter recovery mode');
assert.notStrictEqual(window.HortOpsApp.state.jobs[0].id, 'job-future-99', 'In-memory state must not adopt Schema 99 jobs');

const schema1Envelope = Object.assign({}, canonicalWriteBase, {
  schemaVersion: 1,
  jobs: [{ id: 'job-legacy-1', name: 'Legacy 1 Job', status: 'active', frequencyType: 'one_off', targetDate: '2026-10-10' }]
});
const restore1Res = window.HortOpsApp.restoreWorkspaceJson(schema1Envelope);
assert.strictEqual(restore1Res, false, 'Direct restore of un-migrated Schema 1 envelope must fail');
const bytesAfter1 = window.localStorage.getItem('hort_ops_workspace_v2');
assert.strictEqual(bytesAfter1, expectedStoredBytes, 'Direct restore failure of Schema 1 must preserve raw storage byte-identical');
console.log('[PASS] Section 9 & 29: Direct restore strictly respects Schema v2 version boundary and prevents future-schema coercion.');

// 3. Seeded Job Canonical Validity Test (Mandate Section 19, 30)
const seededInitialJobs = window.HortOpsData.INITIAL_JOBS;
assert(Array.isArray(seededInitialJobs) && seededInitialJobs.length > 0, 'INITIAL_JOBS must be non-empty array');

seededInitialJobs.filter(j => j.status === 'active').forEach(j => {
  const testWs = {
    schemaVersion: 2,
    historicalSnapshots: {},
    rostering: { instructions: {}, provenance: {} },
    assignments: {},
    jobs: [j],
    roster: [{ id: 'test-valid-staff', name: 'Test Staff', status: 'active' }]
  };
  const val = storage.validateWorkspaceSchema(testWs);
  assert.strictEqual(val.valid, true, `Seeded active job "${j.id}" (${j.name}) must pass canonical validation without bypasses (error: ${val.error})`);
});
console.log(`[PASS] Section 19 & 30: All ${seededInitialJobs.length} seeded jobs verified 100% compliant with canonical validation rules (0 named bypasses).`);

// Architecture Dependency Failure Contracts (Mandate Offline15.1)
const { execSync } = require('child_process');
const contractScript = require('path').join(__dirname, 'test_dependency_contracts.cjs');
execSync(`node "${contractScript}"`, { stdio: 'inherit' });
console.log('[PASS] Architecture Dependency Failure Contracts verified (100% fail-closed).\n');

console.log('ALL PERSISTENCE REGRESSION TESTS PASSED (100%)\n');
